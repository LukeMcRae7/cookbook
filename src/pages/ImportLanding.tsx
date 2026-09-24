import { Navigate, useSearchParams } from 'react-router-dom'
import { decodeBookmarkletPayload, recipeFromBookmarklet, type ImportResult } from '../services/import'

/**
 * Where the "Save to cookbook" bookmark lands: /#/import?data=…
 * Reads the recipe out of the fragment, then hands it to the import screen and
 * drops the payload from the address bar.
 */
export function ImportLanding() {
  const [params] = useSearchParams()
  let importResult: ImportResult | undefined
  const payload = decodeBookmarkletPayload(params.get('data') ?? '')
  if (payload) {
    try {
      importResult = recipeFromBookmarklet(payload)
    } catch {
      importResult = undefined
    }
  }
  return <Navigate to="/" replace state={importResult ? { importResult } : undefined} />
}
