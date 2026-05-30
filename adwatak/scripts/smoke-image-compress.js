#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const sharp = require("sharp");
const JSZip = require("jszip");

function loadLocalEnvFile() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function env(name) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing env: ${name}`);
  return v.trim();
}

async function main() {
  loadLocalEnvFile();
  const supabase = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const userId = env("SMOKE_USER_ID");
  const now = Date.now();

  const bucketUpdate = await supabase.storage.updateBucket("job-outputs", {
    allowedMimeTypes: ["application/pdf", "application/zip"],
  });
  if (bucketUpdate.error) throw new Error(`bucket update failed: ${bucketUpdate.error.message}`);

  const inputA = await sharp({ create: { width: 600, height: 400, channels: 3, background: "#0ea5e9" } }).jpeg({ quality: 95 }).toBuffer();
  const inputB = await sharp({ create: { width: 640, height: 420, channels: 3, background: "#22c55e" } }).png().toBuffer();

  const p1 = `${userId}/smoke-img-${now}-1.jpg`;
  const p2 = `${userId}/smoke-img-${now}-2.png`;
  const u1 = await supabase.storage.from("job-inputs").upload(p1, inputA, { upsert: true, contentType: "image/jpeg" });
  const u2 = await supabase.storage.from("job-inputs").upload(p2, inputB, { upsert: true, contentType: "image/png" });
  if (u1.error || u2.error) throw new Error(u1.error?.message || u2.error?.message);

  const job = await supabase.from("jobs").insert({ user_id: userId, tool_type: "image_compress", status: "queued", progress: 0, options: { quality: 70 } }).select("id").single();
  if (job.error || !job.data) throw new Error(`job insert failed: ${job.error?.message}`);
  const jobId = job.data.id;

  await supabase.from("job_files").insert([
    { job_id: jobId, kind: "input", path: p1, mime: "image/jpeg", size_bytes: inputA.length, order_index: 0 },
    { job_id: jobId, kind: "input", path: p2, mime: "image/png", size_bytes: inputB.length, order_index: 1 },
  ]);

  await supabase.from("jobs").update({ status: "processing", progress: 40, started_at: new Date().toISOString() }).eq("id", jobId);
  const c1 = await sharp(inputA).jpeg({ quality: 70, mozjpeg: true }).toBuffer();
  const c2 = await sharp(inputB).png({ compressionLevel: 9 }).toBuffer();
  const zip = new JSZip();
  zip.file("compressed-1.jpg", c1);
  zip.file("compressed-2.png", c2);
  const out = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 9 } });

  const outputPath = `${userId}/${jobId}/output.zip`;
  const upOut = await supabase.storage.from("job-outputs").upload(outputPath, out, { upsert: true, contentType: "application/zip" });
  if (upOut.error) throw new Error(`output upload failed: ${upOut.error.message}`);

  await supabase.from("job_files").insert({ job_id: jobId, kind: "output", path: outputPath, mime: "application/zip", size_bytes: out.length, order_index: 0 });
  const inputTotal = inputA.length + inputB.length;
  if (out.length >= inputTotal) {
    throw new Error(`output is not smaller than input (input=${inputTotal}, output=${out.length})`);
  }

  await supabase
    .from("jobs")
    .update({
      status: "completed",
      progress: 100,
      finished_at: new Date().toISOString(),
      error_message: null,
      options: {
        quality: 70,
        force: false,
        pngMode: "auto",
        resultReport: {
          originalSize: inputTotal,
          outputSize: out.length,
          savingsPercentage: ((inputTotal - out.length) / inputTotal) * 100,
          skippedCount: 0,
        },
      },
    })
    .eq("id", jobId);
  await supabase
    .from("usage_logs")
    .insert({ user_id: userId, tool_type: "image_compress", job_id: jobId, input_total_bytes: inputTotal, output_total_bytes: out.length, duration_ms: 1, status: "completed" });

  const signed = await supabase.storage.from("job-outputs").createSignedUrl(outputPath, 600);
  if (signed.error || !signed.data?.signedUrl) throw new Error(`signed url failed: ${signed.error?.message}`);
  const resp = await fetch(signed.data.signedUrl);
  if (!resp.ok) throw new Error(`download failed: ${resp.status}`);
  const bytes = new Uint8Array(await resp.arrayBuffer());
  if (!bytes.length) throw new Error("downloaded file is empty");

  console.log("SMOKE TEST PASSED");
  console.log(JSON.stringify({ jobId, outputPath, bytes: bytes.length }, null, 2));
}

main().catch((e) => {
  console.error("SMOKE TEST FAILED");
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
