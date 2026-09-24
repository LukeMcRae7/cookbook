import type { MealType, ParsedRecipe } from '../../types/recipe'

/** Where an import came from. The UI uses it for labels and for what it offers next. */
export type ImportOrigin = 'tiktok' | 'web' | 'screenshot' | 'text'

export interface ImportNotice {
  tone: 'info' | 'warn'
  message: string
}

/**
 * The one shape every importer produces, whatever the source. The UI renders
 * it and turns it into a Recipe; it never needs to know how it was obtained.
 */
export interface ImportResult {
  origin: ImportOrigin
  sourceUrl: string
  /** "TikTok", "budgetbytes.com", "Screenshot" — shown next to the preview. */
  sourceLabel: string
  title?: string
  author?: string
  thumbnailUrl?: string
  parsed: ParsedRecipe
  prepTime?: number
  cookTime?: number
  rating?: number
  mealTypes: MealType[]
  /**
   * The text the recipe was read from. When present the UI shows it for
   * correction and re-parses on every edit.
   */
  text?: string
  notices: ImportNotice[]
}

export type ImportFailureKind =
  | 'invalid-url'
  | 'blocked'
  | 'not-found'
  | 'network'
  | 'unreadable'

/** A failure the UI can explain and suggest a next step for. */
export class ImportError extends Error {
  readonly kind: ImportFailureKind

  constructor(kind: ImportFailureKind, message: string) {
    super(message)
    this.name = 'ImportError'
    this.kind = kind
  }
}

export interface ImportOptions {
  /** Optional CORS relay template containing "{url}". */
  relay?: string
  /** 0–1 progress for slow work such as OCR. */
  onProgress?(progress: number, label: string): void
}
