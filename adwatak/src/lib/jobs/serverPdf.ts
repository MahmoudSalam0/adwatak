import { PDFDocument } from "pdf-lib";

interface InputFile {
  bytes: Uint8Array;
  mime: string;
}

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN = 24;

export async function buildPdfFromImages(files: InputFile[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();

  for (const file of files) {
    let image;

    if (file.mime === "image/jpeg" || file.mime === "image/jpg") {
      image = await pdf.embedJpg(file.bytes);
    } else if (file.mime === "image/png") {
      image = await pdf.embedPng(file.bytes);
    } else {
      throw new Error(`نوع الصورة غير مدعوم على السيرفر: ${file.mime}`);
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

  return pdf.save();
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

  return merged.save();
}
