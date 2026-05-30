import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

interface InputFile {
  bytes: Uint8Array;
  mime: string;
}

type PdfQuality = "low" | "medium" | "high";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN = 24;

function qualityToJpegValue(quality: PdfQuality): number {
  if (quality === "low") return 70;
  if (quality === "high") return 86;
  return 78;
}

export async function buildPdfFromImages(files: InputFile[], quality: PdfQuality = "medium"): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const jpegQuality = qualityToJpegValue(quality);

  for (const file of files) {
    let image;
    const metadata = await sharp(file.bytes).metadata();
    const hasAlpha = Boolean(metadata.hasAlpha);

    if (hasAlpha) {
      const pngBytes = await sharp(file.bytes).png({ compressionLevel: 9 }).toBuffer();
      image = await pdf.embedPng(pngBytes);
    } else {
      const jpgBytes = await sharp(file.bytes).jpeg({ quality: jpegQuality, mozjpeg: true }).toBuffer();
      image = await pdf.embedJpg(jpgBytes);
    }

    const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
    const maxWidth = A4_WIDTH - PAGE_MARGIN * 2;
    const maxHeight = A4_HEIGHT - PAGE_MARGIN * 2;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    const x = (A4_WIDTH - width) / 2;
    const y = (A4_HEIGHT - height) / 2;

    page.drawImage(image, { x, y, width, height });
  }

  return pdf.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 50 });
}

export async function mergePdfFiles(files: Uint8Array[]): Promise<Uint8Array> {
  if (files.length === 0) {
    throw new Error("لا توجد ملفات PDF للدمج");
  }

  const merged = await PDFDocument.create();

  for (const bytes of files) {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: false });
    const pageIndices = src.getPageIndices();
    const copiedPages = await merged.copyPages(src, pageIndices);
    for (const page of copiedPages) {
      merged.addPage(page);
    }
  }

  return merged.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 50 });
}
