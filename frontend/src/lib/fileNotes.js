export const NOTES_FILE_ACCEPT = '.txt,.md,.pdf,.docx,.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp'
export const IMAGE_NOTES_ACCEPT = 'image/png,image/jpeg,image/webp'
export const MAX_NOTES_FILE_BYTES = 10 * 1024 * 1024

function extensionOf(name = '') {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

/**
 * Normalize parser output without flattening the document into one giant line.
 * PDF readers often emit repeated spaces while DOCX readers use several blank
 * lines between blocks; both make worse source material for card generation.
 */
export function normalizeExtractedText(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function extractPdf(arrayBuffer) {
  // PDF.js is loaded only when needed so ordinary topic/manual creation does
  // not pay the cost of the PDF parser. The worker URL is resolved by Vite and
  // stays same-origin in the production build.
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).href

  const document = await pdfjs.getDocument({ data: arrayBuffer }).promise
  const pages = []
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()
    pages.push(content.items.map((item) => item.str || '').join(' '))
  }
  return pages.join('\n\n')
}

async function extractDocx(arrayBuffer) {
  // Mammoth extracts semantic text instead of attempting to preserve Word's
  // visual layout, which is exactly what the notes-to-cards prompt needs.
  const module = await import('mammoth/mammoth.browser')
  const mammoth = module.default || module
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}

async function extractImage(file, onProgress) {
  // Tesseract and its language worker are lazy-loaded because OCR is much
  // larger than the ordinary authoring experience. Recognition happens in the
  // browser; the original photo is never uploaded by CardSparks.
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', undefined, {
    logger: (message) => {
      if (message.status === 'recognizing text') onProgress?.(Math.round((message.progress || 0) * 100))
    },
  })
  try {
    const result = await worker.recognize(file)
    return result.data.text
  } finally {
    await worker.terminate()
  }
}

/**
 * Extract notes entirely in the browser. The caller receives a truncation flag
 * rather than silently exceeding the generation API's 20,000-character limit.
 */
export async function extractNotesFile(file, maxCharacters = 20000, onProgress) {
  if (!file) throw new Error('Choose a study-notes file first.')
  if (file.size > MAX_NOTES_FILE_BYTES) throw new Error('Choose a file smaller than 10 MB.')

  const extension = extensionOf(file.name)
  let source
  if (extension === '.txt' || extension === '.md') {
    source = await file.text()
  } else if (extension === '.pdf') {
    source = await extractPdf(await file.arrayBuffer())
  } else if (extension === '.docx') {
    source = await extractDocx(await file.arrayBuffer())
  } else if (['.png', '.jpg', '.jpeg', '.webp'].includes(extension)) {
    source = await extractImage(file, onProgress)
  } else {
    throw new Error('CardSparks supports PDF, DOCX, TXT, and Markdown files, plus PNG, JPG, and WebP images.')
  }

  const normalized = normalizeExtractedText(source)
  if (!normalized) throw new Error('No readable text was found in that file.')

  const limit = Math.max(1, Number(maxCharacters) || 20000)
  return {
    text: normalized.slice(0, limit),
    truncated: normalized.length > limit,
    originalLength: normalized.length,
  }
}
