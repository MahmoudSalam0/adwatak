export async function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (progress: number) => void,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("x-upsert", "true");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error("فشل رفع الملف"));
      }
    };

    xhr.onerror = () => reject(new Error("فشل الاتصال أثناء رفع الملف"));
    xhr.send(file);
  });
}
