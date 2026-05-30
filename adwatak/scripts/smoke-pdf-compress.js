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

function env(name) {
  const value = process.env[name];
  if (!value || !value.trim()) throw new Error(`Missing env: ${name}`);
  return value.trim();
}

async function createPdf(text) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([700, 700]);
  for (let i = 0; i < 60; i++) {
    page.drawText(`${text} - line ${i}`.repeat(8), { x: 20, y: 680 - i * 10, size: 10 });
  }
  return pdf.save({ useObjectStreams: false });
}

async function compressPdf(bytes) {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  return doc.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 50 });
}

async function main() {
  loadLocalEnvFile();
  const supabase = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const userId = env("SMOKE_USER_ID");
  const now = Date.now();

  const input1 = await createPdf("PDF COMPRESS SMOKE A");
  const input2 = await createPdf("PDF COMPRESS SMOKE B");
  const p1 = `${userId}/smoke-pdf-compress-${now}-1.pdf`;
  const p2 = `${userId}/smoke-pdf-compress-${now}-2.pdf`;

  const u1 = await supabase.storage.from("job-inputs").upload(p1, input1, { upsert: true, contentType: "application/pdf" });
  const u2 = await supabase.storage.from("job-inputs").upload(p2, input2, { upsert: true, contentType: "application/pdf" });
  if (u1.error || u2.error) throw new Error(u1.error?.message || u2.error?.message);

  const job = await supabase
    .from("jobs")
    .insert({ user_id: userId, tool_type: "pdf_compress", status: "queued", progress: 0, options: {} })
    .select("id")
    .single();
  if (job.error || !job.data) throw new Error(`job insert failed: ${job.error?.message}`);
  const jobId = job.data.id;

  await supabase.from("job_files").insert([
    { job_id: jobId, kind: "input", path: p1, mime: "application/pdf", size_bytes: input1.length, order_index: 0 },
    { job_id: jobId, kind: "input", path: p2, mime: "application/pdf", size_bytes: input2.length, order_index: 1 },
  ]);

  const c1 = await compressPdf(input1);
  const c2 = await compressPdf(input2);
  const improved = [];
  if (c1.length < input1.length) improved.push({ name: "compressed-1.pdf", bytes: c1, input: input1.length });
  if (c2.length < input2.length) improved.push({ name: "compressed-2.pdf", bytes: c2, input: input2.length });
  if (improved.length === 0) throw new Error("no improved PDF produced in smoke test");

  let outputBytes;
  let outputPath;
  let outputMime;
  if (improved.length === 1) {
    outputBytes = improved[0].bytes;
    outputPath = `${userId}/${jobId}/output.pdf`;
    outputMime = "application/pdf";
  } else {
    const JSZip = require("jszip");
    const zip = new JSZip();
    for (const item of improved) zip.file(item.name, item.bytes);
    outputBytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 9 } });
    outputPath = `${userId}/${jobId}/output.zip`;
    outputMime = "application/zip";
  }

  const inputTotal = input1.length + input2.length;
  if (outputBytes.length >= inputTotal) throw new Error(`output not smaller than input total (${outputBytes.length} >= ${inputTotal})`);

  const outUpload = await supabase.storage.from("job-outputs").upload(outputPath, outputBytes, { upsert: true, contentType: outputMime });
  if (outUpload.error) throw new Error(`output upload failed: ${outUpload.error.message}`);

  await supabase.from("job_files").insert({ job_id: jobId, kind: "output", path: outputPath, mime: outputMime, size_bytes: outputBytes.length, order_index: 0 });
  await supabase
    .from("jobs")
    .update({
      status: "completed",
      progress: 100,
      finished_at: new Date().toISOString(),
      options: {
        resultReport: {
          originalSize: inputTotal,
          outputSize: outputBytes.length,
          savingsPercentage: ((inputTotal - outputBytes.length) / inputTotal) * 100,
          skippedCount: 2 - improved.length,
        },
      },
      error_message: null,
    })
    .eq("id", jobId);

  await supabase.from("usage_logs").insert({
    user_id: userId,
    tool_type: "pdf_compress",
    job_id: jobId,
    input_total_bytes: inputTotal,
    output_total_bytes: outputBytes.length,
    duration_ms: 1,
    status: "completed",
  });

  const signed = await supabase.storage.from("job-outputs").createSignedUrl(outputPath, 600);
  if (signed.error || !signed.data?.signedUrl) throw new Error(`signed URL failed: ${signed.error?.message}`);
  const resp = await fetch(signed.data.signedUrl);
  if (!resp.ok) throw new Error(`download failed: ${resp.status}`);
  const bytes = new Uint8Array(await resp.arrayBuffer());
  if (!bytes.length) throw new Error("downloaded output is empty");

  console.log("SMOKE TEST PASSED");
  console.log(JSON.stringify({ jobId, outputPath, outputBytes: bytes.length }, null, 2));
}

main().catch((error) => {
  console.error("SMOKE TEST FAILED");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
