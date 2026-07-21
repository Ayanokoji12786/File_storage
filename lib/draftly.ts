/**
 * Extensions Draftly (a Tiptap-based rich-text editor) can meaningfully open.
 * Deliberately excludes PDFs — a PDF's fixed layout can't survive a round
 * trip through plain-text extraction, so it stays preview/download-only.
 */
const DRAFTLY_ELIGIBLE_EXTS = new Set(['txt', 'md', 'markdown', 'docx'])

export function isDraftlyEligible(name: string, isEncrypted: boolean, isCompressed: boolean): boolean {
  if (isEncrypted || isCompressed) return false
  const ext = name.includes('.') ? (name.split('.').pop() ?? '').toLowerCase() : ''
  return DRAFTLY_ELIGIBLE_EXTS.has(ext)
}
