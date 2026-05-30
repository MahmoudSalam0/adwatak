import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { createCanvas } from "@napi-rs/canvas";

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

const PDF_TO_IMAGES_MAX_PAGES = 120;
const PDF_TO_IMAGES_RENDER_SCALE = 1.5;

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
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { getDocument, GlobalWorkerOptions } = pdfjs;
  GlobalWorkerOptions.workerSrc = "";
  const pdfBytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  const loadingTask = getDocument({ data: pdfBytes, disableWorker: true, useSystemFonts: true } as any);
  const pdfDoc = await loadingTask.promise;
  const pageCount = pdfDoc.numPages;

  if (pageCount > PDF_TO_IMAGES_MAX_PAGES) {
    throw new Error(`عدد صفحات PDF كبير جداً. الحد الأقصى ${PDF_TO_IMAGES_MAX_PAGES} صفحة.`);
  }

  const jpgQuality = qualityToJpegValue(quality);
  const pages: PdfPageImage[] = [];

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const page = await pdfDoc.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: PDF_TO_IMAGES_RENDER_SCALE });
    const canvas = createCanvas(Math.max(1, Math.floor(viewport.width)), Math.max(1, Math.floor(viewport.height)));
    const context = canvas.getContext("2d");

    await page.render({
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    const renderedPage = canvas.toBuffer("image/png");

    console.info("[pdf_to_images] page-rendered", {
      page: pageIndex + 1,
      viewportWidth: Math.floor(viewport.width),
      viewportHeight: Math.floor(viewport.height),
      renderedPngBytes: renderedPage.byteLength,
      renderedPngSignature: renderedPage.subarray(0, 8).toString("hex"),
    });

    const output =
      format === "png"
        ? await sharp(renderedPage).png({ compressionLevel: 9 }).toBuffer()
        : await sharp(renderedPage).jpeg({ quality: jpgQuality, mozjpeg: true }).toBuffer();

    console.info("[pdf_to_images] page-output", {
      page: pageIndex + 1,
      outputFormat: format,
      sharpInputSignature: renderedPage.subarray(0, 8).toString("hex"),
      outputBytes: output.byteLength,
    });

    pages.push({
      fileName: `page-${pageIndex + 1}.${format}`,
      bytes: output,
    });
  }

  return pages;
}
