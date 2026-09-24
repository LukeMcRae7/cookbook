import { ImportError } from './types'

const TIMEOUT_MS = 12000

async function request(url: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { signal: controller.signal, headers: { Accept: 'text/html,*/*' } })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Fetches a page's HTML from the browser. Most recipe sites refuse cross-origin
 * reads (no CORS header), which surfaces as a network error — indistinguishable
 * from being offline. If the user configured a relay, try it before giving up.
 */
export async function fetchPageHtml(url: string, relay?: string): Promise<string> {
  const attempts: string[] = [url]
  if (relay?.includes('{url}')) attempts.push(relay.replace('{url}', encodeURIComponent(url)))

  let lastStatus: number | undefined
  for (const attempt of attempts) {
    try {
      const response = await request(attempt)
      if (response.ok) return await response.text()
      lastStatus = response.status
    } catch {
      // CORS refusal or offline; try the next route.
    }
  }

  if (lastStatus === 404 || lastStatus === 410) {
    throw new ImportError('not-found', 'That page could not be found.')
  }
  throw new ImportError(
    'blocked',
    relay
      ? 'Neither this site nor your relay would return the page.'
      : "This site doesn't let other websites read its pages.",
  )
}
