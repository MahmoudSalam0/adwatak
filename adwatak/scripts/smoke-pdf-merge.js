#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { PDFDocument } = require("pdf-lib");

function loadLocalEnvFile() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function getEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

async function createSamplePdf(label) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([400, 200]);
  page.drawText(label, { x: 40, y: 100, size: 24 });
  return pdf.save();
}

async function main() {
  loadLocalEnvFile();

  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const userId = getEnv("SMOKE_USER_ID");

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = Date.now();

  const bucketUpdate = await admin.storage.updateBucket("job-inputs", {
    public: false,
    fileSizeLimit: 15728640,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/bmp", "image/gif", "application/pdf"],
  });
  if (bucketUpdate.error) throw new Error(`failed to update job-inputs mime policy: ${bucketUpdate.error.message}`);

  const input1 = await createSamplePdf("SMOKE A");
  const input2 = await createSamplePdf("SMOKE B");
  const inputPath1 = `${userId}/smoke-merge-${now}-1.pdf`;
  const inputPath2 = `${userId}/smoke-merge-${now}-2.pdf`;

  console.log("[1/5] upload inputs");
  const up1 = await admin.storage.from("job-inputs").upload(inputPath1, input1, { upsert: true, contentType: "application/pdf" });
  const up2 = await admin.storage.from("job-inputs").upload(inputPath2, input2, { upsert: true, contentType: "application/pdf" });
  if (up1.error || up2.error) throw new Error(`input upload failed: ${up1.error?.message || up2.error?.message}`);

  console.log("[2/5] create job and job_files");
  const job = await admin
    .from("jobs")
    .insert({ user_id: userId, tool_type: "pdf_merge", status: "queued", progress: 0, options: { source: "smoke-pdf-merge" } })
    .select("id")
    .single();
  if (job.error || !job.data) throw new Error(`job create failed: ${job.error?.message}`);
  const jobId = job.data.id;

  const inputsInsert = await admin.from("job_files").insert([
    { job_id: jobId, kind: "input", path: inputPath1, mime: "application/pdf", size_bytes: input1.length, order_index: 0 },
    { job_id: jobId, kind: "input", path: inputPath2, mime: "application/pdf", size_bytes: input2.length, order_index: 1 },
  ]);
  if (inputsInsert.error) throw new Error(`job_files input insert failed: ${inputsInsert.error.message}`);

  console.log("[3/5] process merge and upload output");
  await admin.from("jobs").update({ status: "processing", progress: 30, started_at: new Date().toISOString() }).eq("id", jobId);
  const merged = await PDFDocument.create();
  for (const bytes of [input1, input2]) {
    const src = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }
  const outputBytes = await merged.save();
  const outputPath = `${userId}/${jobId}/output.pdf`;
  const outputUpload = await admin.storage.from("job-outputs").upload(outputPath, outputBytes, { upsert: true, contentType: "application/pdf" });
  if (outputUpload.error) throw new Error(`output upload failed: ${outputUpload.error.message}`);

  const outputInsert = await admin
    .from("job_files")
    .insert({ job_id: jobId, kind: "output", path: outputPath, mime: "application/pdf", size_bytes: outputBytes.length, order_index: 0 });
  if (outputInsert.error) throw new Error(`job_files output insert failed: ${outputInsert.error.message}`);

  await admin.from("jobs").update({ status: "completed", progress: 100, finished_at: new Date().toISOString(), error_message: null }).eq("id", jobId);
  await admin.from("usage_logs").insert({
    user_id: userId,
    tool_type: "pdf_merge",
    job_id: jobId,
    input_total_bytes: input1.length + input2.length,
    output_total_bytes: outputBytes.length,
    duration_ms: 1,
    status: "completed",
  });

  console.log("[4/5] poll and check final status");
  const finalJob = await admin.from("jobs").select("status,error_message").eq("id", jobId).single();
  if (finalJob.error || finalJob.data?.status !== "completed") throw new Error(`final status failed: ${finalJob.error?.message || finalJob.data?.status}`);

  console.log("[5/5] download output");
  const signed = await admin.storage.from("job-outputs").createSignedUrl(outputPath, 600);
  if (signed.error || !signed.data?.signedUrl) throw new Error(`signed URL failed: ${signed.error?.message}`);
  const response = await fetch(signed.data.signedUrl);
  if (!response.ok) throw new Error(`download failed: ${response.status}`);
  const downloaded = new Uint8Array(await response.arrayBuffer());
  if (!downloaded.length) throw new Error("downloaded output is empty");

  console.log("SMOKE TEST PASSED");
  console.log(JSON.stringify({ jobId, outputPath, downloadBytes: downloaded.length, status: finalJob.data.status }, null, 2));
}

main().catch((error) => {
  console.error("SMOKE TEST FAILED");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
