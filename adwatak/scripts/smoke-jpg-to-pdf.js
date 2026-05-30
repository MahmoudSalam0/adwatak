#!/usr/bin/env node

const { createClient } = require("@supabase/supabase-js");
const { PDFDocument } = require("pdf-lib");
const fs = require("fs");
const path = require("path");

function loadLocalEnvFile() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function getEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function logStep(step, message, extra) {
  const prefix = `[${step}] ${message}`;
  if (extra) {
    console.log(prefix, extra);
  } else {
    console.log(prefix);
  }
}

async function buildPdfFromPngBytes(bytes, pagesCount) {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pagesCount; i++) {
    const image = await pdf.embedPng(bytes);
    const page = pdf.addPage([595.28, 841.89]);
    const margin = 24;
    const maxWidth = 595.28 - margin * 2;
    const maxHeight = 841.89 - margin * 2;
    const ratio = Math.min(maxWidth / image.width, maxHeight / image.height);
    const width = image.width * ratio;
    const height = image.height * ratio;
    page.drawImage(image, {
      x: (595.28 - width) / 2,
      y: (841.89 - height) / 2,
      width,
      height,
    });
  }
  return pdf.save();
}

async function main() {
  loadLocalEnvFile();

  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const userId = process.env.SMOKE_USER_ID ? process.env.SMOKE_USER_ID.trim() : null;
  if (!userId) {
    throw new Error("Missing required environment variable: SMOKE_USER_ID");
  }

  const now = Date.now();
  const inputPngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9W7fV4QAAAAASUVORK5CYII=";
  const inputBytes = Buffer.from(inputPngBase64, "base64");

  const inputPath1 = `${userId}/smoke-${now}-1.png`;
  const inputPath2 = `${userId}/smoke-${now}-2.png`;

  logStep("1/6", "Uploading input files to job-inputs");
  const up1 = await admin.storage
    .from("job-inputs")
    .upload(inputPath1, inputBytes, { contentType: "image/png", upsert: true });
  if (up1.error) throw new Error(`Input upload failed (1): ${up1.error.message}`);

  const up2 = await admin.storage
    .from("job-inputs")
    .upload(inputPath2, inputBytes, { contentType: "image/png", upsert: true });
  if (up2.error) throw new Error(`Input upload failed (2): ${up2.error.message}`);

  logStep("2/6", "Creating job record");
  const jobInsert = await admin
    .from("jobs")
    .insert({
      user_id: userId,
      tool_type: "jpg_to_pdf",
      status: "queued",
      progress: 0,
      options: { source: "smoke-script" },
    })
    .select("id,status")
    .single();

  if (jobInsert.error || !jobInsert.data) {
    throw new Error(`Job creation failed: ${jobInsert.error?.message ?? "unknown"}`);
  }

  const jobId = jobInsert.data.id;
  logStep("2/6", "Job created", { jobId });

  const inputInsert = await admin.from("job_files").insert([
    {
      job_id: jobId,
      kind: "input",
      path: inputPath1,
      mime: "image/png",
      size_bytes: inputBytes.length,
      order_index: 0,
    },
    {
      job_id: jobId,
      kind: "input",
      path: inputPath2,
      mime: "image/png",
      size_bytes: inputBytes.length,
      order_index: 1,
    },
  ]);

  if (inputInsert.error) {
    throw new Error(`Input job_files insert failed: ${inputInsert.error.message}`);
  }

  logStep("3/6", "Processing job and generating PDF");
  const startAt = Date.now();
  const processingUpdate = await admin
    .from("jobs")
    .update({ status: "processing", progress: 15, started_at: new Date().toISOString() })
    .eq("id", jobId);
  if (processingUpdate.error) throw new Error(`Job update to processing failed: ${processingUpdate.error.message}`);

  const pdfBytes = await buildPdfFromPngBytes(inputBytes, 2);
  const outputPath = `${userId}/${jobId}/output.pdf`;

  const outputUpload = await admin.storage
    .from("job-outputs")
    .upload(outputPath, pdfBytes, { upsert: true, contentType: "application/pdf" });

  if (outputUpload.error) {
    throw new Error(`Output upload failed: ${outputUpload.error.message}`);
  }

  const outputInsert = await admin.from("job_files").insert({
    job_id: jobId,
    kind: "output",
    path: outputPath,
    mime: "application/pdf",
    size_bytes: pdfBytes.length,
    order_index: 0,
  });
  if (outputInsert.error) throw new Error(`Output job_files insert failed: ${outputInsert.error.message}`);

  const completedUpdate = await admin
    .from("jobs")
    .update({ status: "completed", progress: 100, finished_at: new Date().toISOString(), error_message: null })
    .eq("id", jobId);
  if (completedUpdate.error) throw new Error(`Job update to completed failed: ${completedUpdate.error.message}`);

  const usageInsert = await admin.from("usage_logs").insert({
    user_id: userId,
    tool_type: "jpg_to_pdf",
    job_id: jobId,
    duration_ms: Date.now() - startAt,
    input_total_bytes: inputBytes.length * 2,
    output_total_bytes: pdfBytes.length,
    status: "completed",
  });
  if (usageInsert.error) throw new Error(`usage_logs insert failed: ${usageInsert.error.message}`);

  logStep("4/6", "Polling job until completed");
  let attempts = 0;
  while (attempts < 10) {
    attempts += 1;
    const readJob = await admin
      .from("jobs")
      .select("status,progress,error_message")
      .eq("id", jobId)
      .single();
    if (readJob.error || !readJob.data) throw new Error(`Polling failed: ${readJob.error?.message ?? "missing job"}`);
    if (readJob.data.status === "completed") break;
    if (readJob.data.status === "failed") {
      throw new Error(`Job failed while polling: ${readJob.data.error_message ?? "no error_message"}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  logStep("5/6", "Creating and downloading signed output URL");
  const signed = await admin.storage.from("job-outputs").createSignedUrl(outputPath, 600);
  if (signed.error || !signed.data?.signedUrl) {
    throw new Error(`Signed URL creation failed: ${signed.error?.message ?? "empty signedUrl"}`);
  }

  const downloadResponse = await fetch(signed.data.signedUrl);
  if (!downloadResponse.ok) {
    throw new Error(`Download failed: HTTP ${downloadResponse.status}`);
  }
  const downloaded = new Uint8Array(await downloadResponse.arrayBuffer());
  if (!downloaded.length) {
    throw new Error("Downloaded PDF is empty");
  }

  logStep("6/6", "Validating final records");
  const finalJob = await admin
    .from("jobs")
    .select("status,error_message")
    .eq("id", jobId)
    .single();
  if (finalJob.error || !finalJob.data) throw new Error(`Final job read failed: ${finalJob.error?.message ?? "missing"}`);

  const finalFiles = await admin
    .from("job_files")
    .select("kind,path")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });
  if (finalFiles.error || !finalFiles.data) {
    throw new Error(`Final job_files read failed: ${finalFiles.error?.message ?? "missing"}`);
  }

  const inputCount = finalFiles.data.filter((file) => file.kind === "input").length;
  const outputCount = finalFiles.data.filter((file) => file.kind === "output").length;

  if (finalJob.data.status !== "completed") {
    throw new Error(`Final status is not completed: ${finalJob.data.status}`);
  }
  if (inputCount < 2 || outputCount < 1) {
    throw new Error(`Unexpected job_files counts: inputs=${inputCount}, outputs=${outputCount}`);
  }

  console.log("\nSMOKE TEST PASSED");
  console.log(
    JSON.stringify(
      {
        jobId,
        outputPath,
        downloadBytes: downloaded.length,
        finalStatus: finalJob.data.status,
        inputCount,
        outputCount,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("\nSMOKE TEST FAILED");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
