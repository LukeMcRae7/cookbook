/**
 * On-device text recognition for screenshots, via Tesseract (compiled to
 * WebAssembly). This is optical character recognition only — the recipe itself
 * is still read by the rule-based parser.
 *
 * The library is loaded on first use, so it costs nothing until someone picks a
 * screenshot. Tesseract fetches its WebAssembly core and English model (~10 MB,
 * cached afterwards) from the jsDelivr CDN; no image ever leaves the device.
 */

type Progress = (progress: number, label: string) => void

/**
 * TikTok captions are white text over video; recipe-site screenshots are dark
 * text on white. Tesseract reads dark-on-light best, so a dark image is
 * inverted first. Upscaling small images also helps it considerably.
 */
async function prepareImage(file: Blob): Promise<HTMLCanvasElement | Blob> {
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return file

  const bitmap = await createImageBitmap(file)
  const scale = bitmap.width < 1000 ? 2 : 1
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width * scale
  canvas.height = bitmap.height * scale
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return file

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = image.data
  let total = 0
  for (let i = 0; i < pixels.length; i += 4) {
    total += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]
  }
  const invert = total / (pixels.length / 4) < 140

  for (let i = 0; i < pixels.length; i += 4) {
    let gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]
    if (invert) gray = 255 - gray
    // A gentle contrast stretch sharpens text edges without binarising.
    gray = Math.max(0, Math.min(255, (gray - 128) * 1.4 + 128))
    pixels[i] = pixels[i + 1] = pixels[i + 2] = gray
  }
  context.putImageData(image, 0, 0)
  return canvas
}

export async function recognizeText(file: Blob, onProgress?: Progress): Promise<string> {
  onProgress?.(0.02, 'Preparing image')
  const image = await prepareImage(file)

  onProgress?.(0.05, 'Loading text recognition')
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    logger: (message) => {
      if (message.status === 'recognizing text') {
        onProgress?.(0.3 + message.progress * 0.7, 'Reading text')
      } else if (/load|initiali/i.test(message.status)) {
        onProgress?.(0.05 + message.progress * 0.25, 'Loading text recognition')
      }
    },
  })

  try {
    const { data } = await worker.recognize(image)
    onProgress?.(1, 'Done')
    return data.text
  } finally {
    await worker.terminate()
  }
}
