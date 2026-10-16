export function downloadHtml(html: string, filename: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

export async function fetchAsDataUrl(
  url: string,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`Falha ao carregar screenshot (${response.status})`);
  }
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Não foi possível converter o screenshot"));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader falhou"));
    reader.readAsDataURL(blob);
  });
}
