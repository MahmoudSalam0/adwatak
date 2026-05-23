import { jsPDF } from "jspdf";

interface ImageInput {
  file: File;
  preview: string;
}

function getImageDataUrl(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("فشل إنشاء Canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      URL.revokeObjectURL(url);
      resolve({ dataUrl, width: img.naturalWidth, height: img.naturalHeight });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`فشل تحميل الصورة: ${file.name}`));
    };

    img.src = url;
  });
}

export async function convertToPdf(images: ImageInput[]): Promise<Blob> {
  if (images.length === 0) {
    throw new Error("لا توجد صور للتحويل");
  }

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;

  for (let i = 0; i < images.length; i++) {
    const { dataUrl, width, height } = await getImageDataUrl(images[i].file);

    let imgWidth = width;
    let imgHeight = height;

    const widthRatio = maxWidth / imgWidth;
    const heightRatio = maxHeight / imgHeight;
    const ratio = Math.min(widthRatio, heightRatio);

    imgWidth *= ratio;
    imgHeight *= ratio;

    const x = (pageWidth - imgWidth) / 2;
    const y = (pageHeight - imgHeight) / 2;

    if (i > 0) pdf.addPage();

    pdf.addImage(dataUrl, "JPEG", x, y, imgWidth, imgHeight);
  }

  return pdf.output("blob");
}

export function downloadPdf(blob: Blob, filename = "images.pdf") {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
