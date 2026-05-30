import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

interface InputFile {
  bytes: Uint8Array;
  mime: string;
}

type PdfQuality = "low" | "medium" | "high";
type PdfImageFormat = "jpg" | "png";

interface PdfPageImage {
  fileName: string;
  bytes: Buffer;
}

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

export async function compressPdfBytes(input: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(input, {
    ignoreEncryption: false,
    updateMetadata: false,
  });

  return doc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 50,
  });
}

export async function renderPdfPagesToImages(
  input: Uint8Array,
  format: PdfImageFormat,
  quality: PdfQuality,
): Promise<PdfPageImage[]> {
  const sourcePdfBuffer = Buffer.from(input);
  const doc = await PDFDocument.load(sourcePdfBuffer, { ignoreEncryption: false, updateMetadata: false });
  const pageCount = doc.getPageCount();
  const jpgQuality = qualityToJpegValue(quality);
  const pages: PdfPageImage[] = [];

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const pagePdf = await PDFDocument.create();
    const [copiedPage] = await pagePdf.copyPages(doc, [pageIndex]);
    pagePdf.addPage(copiedPage);
    const singlePagePdfBytes = await pagePdf.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 50 });

    const renderedPage = await sharp(Buffer.from(singlePagePdfBytes), { density: 160 }).png({ compressionLevel: 9 }).toBuffer();
    const output =
      format === "png"
        ? await sharp(renderedPage).png({ compressionLevel: 9 }).toBuffer()
        : await sharp(renderedPage).jpeg({ quality: jpgQuality, mozjpeg: true }).toBuffer();

    console.info("[pdf_to_images] page-rendered", {
      page: pageIndex + 1,
      renderedImageBytes: renderedPage.byteLength,
      outputFormat: format,
      outputBytes: output.byteLength,
    });

    pages.push({
      fileName: `page-${pageIndex + 1}.${format}`,
      bytes: output,
    });
  }

  return pages;
}
