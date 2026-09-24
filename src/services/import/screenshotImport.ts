import { recognizeText } from './ocr'
import { readScreenshotText } from './screenshotText'
import { importTikTok, recipeFromCaption } from './tiktokImport'
import { ImportError, type ImportOptions, type ImportResult } from './types'

/**
 * Screenshot -> text -> recipe. When the image shows a TikTok link, the full
 * caption is fetched from it (exact); otherwise the recognised caption is parsed
 * (approximate, and shown for correction).
 */
export async function importScreenshot(file: File, options: ImportOptions = {}): Promise<ImportResult> {
  if (!file.type.startsWith('image/')) {
    throw new ImportError('unreadable', 'That file is not an image.')
  }

  let raw: string
  try {
    raw = await recognizeText(file, options.onProgress)
  } catch {
    throw new ImportError(
      'network',
      "Couldn't load text recognition. It downloads once (about 10 MB) — check your connection and try again.",
    )
  }

  const reading = readScreenshotText(raw)

  if (reading.tiktokUrl) {
    try {
      const fromLink = await importTikTok(reading.tiktokUrl, options)
      return {
        ...fromLink,
        origin: 'screenshot',
        notices: [
          { tone: 'info', message: 'Found the TikTok link in your screenshot and read the full caption from it.' },
          ...fromLink.notices,
        ],
      }
    } catch {
      // The link was misread or the video is gone; the recognised text still helps.
    }
  }

  if (!reading.caption.trim()) {
    throw new ImportError('unreadable', 'No text could be read from that image.')
  }

  const result = recipeFromCaption(reading.caption, {
    origin: 'screenshot',
    sourceUrl: '',
    sourceLabel: 'Screenshot',
    author: reading.handle,
  })
  return {
    ...result,
    notices: [
      {
        tone: 'info',
        message: 'Read from the image — text recognition makes mistakes, so check the text below.',
      },
      ...result.notices,
    ],
  }
}
