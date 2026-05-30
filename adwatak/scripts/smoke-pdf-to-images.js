#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { PDFDocument } = require("pdf-lib");
const JSZip = require("jszip");
const sharp = require("sharp");

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

async function createSamplePdf() {
  const pdf = await PDFDocument.create();
  const page1 = pdf.addPage([500, 300]);
  page1.drawText("SMOKE PAGE 1", { x: 40, y: 150, size: 30 });
  const page2 = pdf.addPage([500, 300]);
  page2.drawText("SMOKE PAGE 2", { x: 40, y: 150, size: 30 });
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
  const inputPdf = await createSamplePdf();
  const inputPath = `${userId}/smoke-pdf-to-images-${now}.pdf`;

  console.log("[1/6] upload PDF input");
  const up = await admin.storage.from("job-inputs").upload(inputPath, inputPdf, { upsert: true, contentType: "application/pdf" });
  if (up.error) throw new Error(`input upload failed: ${up.error.message}`);

  console.log("[2/6] create job and input record");
  const job = await admin
    .from("jobs")
    .insert({ user_id: userId, tool_type: "pdf_to_images", status: "queued", progress: 0, options: { source: "smoke-pdf-to-images" } })
    .select("id")
    .single();
  if (job.error || !job.data) throw new Error(`job create failed: ${job.error?.message}`);
  const jobId = job.data.id;

  const inputInsert = await admin.from("job_files").insert({
    job_id: jobId,
    kind: "input",
    path: inputPath,
    mime: "application/pdf",
    size_bytes: inputPdf.length,
    order_index: 0,
  });
  if (inputInsert.error) throw new Error(`job_files input insert failed: ${inputInsert.error.message}`);

  console.log("[3/6] process and create ZIP output");
  await admin.from("jobs").update({ status: "processing", progress: 40, started_at: new Date().toISOString() }).eq("id", jobId);

  const zip = new JSZip();
  for (let i = 0; i < 2; i++) {
    const image = await sharp(inputPdf, { density: 160, page: i }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
    zip.file(`page-${i + 1}.jpg`, image);
  }
  const outputBytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 9 } });
  const outputPath = `${userId}/${jobId}/output.zip`;

  const outputUpload = await admin.storage.from("job-outputs").upload(outputPath, outputBytes, { upsert: true, contentType: "application/zip" });
  if (outputUpload.error) throw new Error(`output upload failed: ${outputUpload.error.message}`);

  const outputInsert = await admin.from("job_files").insert({
    job_id: jobId,
    kind: "output",
    path: outputPath,
    mime: "application/zip",
    size_bytes: outputBytes.length,
    order_index: 0,
  });
  if (outputInsert.error) throw new Error(`job_files output insert failed: ${outputInsert.error.message}`);

  await admin.from("jobs").update({ status: "completed", progress: 100, finished_at: new Date().toISOString(), error_message: null }).eq("id", jobId);

  console.log("[4/6] confirm completed status");
  const finalJob = await admin.from("jobs").select("status,error_message").eq("id", jobId).single();
  if (finalJob.error || finalJob.data?.status !== "completed") throw new Error(`final status failed: ${finalJob.error?.message || finalJob.data?.status}`);

  console.log("[5/6] signed download URL");
  const signed = await admin.storage.from("job-outputs").createSignedUrl(outputPath, 600);
  if (signed.error || !signed.data?.signedUrl) throw new Error(`signed URL failed: ${signed.error?.message}`);

  console.log("[6/6] download and verify ZIP");
  const response = await fetch(signed.data.signedUrl);
  if (!response.ok) throw new Error(`download failed: ${response.status}`);
  const downloaded = new Uint8Array(await response.arrayBuffer());
  if (!downloaded.length) throw new Error("downloaded ZIP is empty");

  console.log("SMOKE TEST PASSED");
  console.log(JSON.stringify({ jobId, outputPath, downloadBytes: downloaded.length, status: finalJob.data.status }, null, 2));
}

main().catch((error) => {
  console.error("SMOKE TEST FAILED");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
