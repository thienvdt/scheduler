/** Tải dữ liệu về máy dưới dạng file. */
export function downloadBlob(filename: string, content: BlobPart, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Tải một chuỗi về máy dưới dạng file. */
export function downloadText(filename: string, content: string, mime: string) {
  downloadBlob(filename, content, mime);
}
