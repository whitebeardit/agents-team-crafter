/** Descarrega um valor JSON para ficheiro no browser. */
export function downloadJsonFile(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Copia JSON formatado (indent 2) para a área de transferência. */
export async function copyJsonToClipboard(data: unknown) {
  await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
}
