/**
 * Strips HTML tags and returns plain text
 */
function stripHtmlTags(html: string): string {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  // console.log(tmp.textContent)
  return tmp.textContent || tmp.innerText || ''
}

/**
 * Normalizes text for comparison (removes extra whitespace, converts to lowercase)
 */
function normalizeText(text: string): string {
  return stripHtmlTags(text).replace(/\s+/g, ' ').trim().toLowerCase()
}

/**
 * Normalizes plain text and tracks the original text boundaries for each
 * normalized character so normalized ranges can be mapped back accurately.
 */
function normalizePlainTextWithBoundaries(originalText: string): {
  normalizedText: string
  boundaries: Array<number>
} {
  const normalizedChars: Array<string> = []
  const boundaries: Array<number> = []

  let pendingWhitespaceStart: number | null = null
  let pendingWhitespaceEnd = 0

  for (let i = 0; i < originalText.length; i++) {
    const char = originalText[i]

    if (/\s/.test(char)) {
      if (normalizedChars.length > 0 && pendingWhitespaceStart === null) {
        pendingWhitespaceStart = i
      }
      pendingWhitespaceEnd = i + 1
      continue
    }

    if (pendingWhitespaceStart !== null) {
      if (boundaries.length === 0) {
        boundaries.push(pendingWhitespaceStart)
      }
      normalizedChars.push(' ')
      boundaries.push(pendingWhitespaceEnd)
      pendingWhitespaceStart = null
    }

    if (boundaries.length === 0) {
      boundaries.push(i)
    }
    normalizedChars.push(char.toLowerCase())
    boundaries.push(i + 1)
  }

  return {
    normalizedText: normalizedChars.join(''),
    boundaries: boundaries.length > 0 ? boundaries : [originalText.length],
  }
}

/**
 * Calculates similarity between two strings using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeText(str1)
  const s2 = normalizeText(str2)

  if (s1 === s2) return 1.0
  if (s1.length === 0 || s2.length === 0) return 0.0

  const maxLen = Math.max(s1.length, s2.length)
  const distance = levenshteinDistance(s1, s2)
  return 1 - distance / maxLen
}

/**
 * Levenshtein distance algorithm
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: Array<Array<number>> = []

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        )
      }
    }
  }

  return matrix[str2.length][str1.length]
}

/**
 * Finds the best matching text in the HTML and highlights it
 */
export function findAndHighlightText(
  container: HTMLElement,
  searchText: string,
) {
  const startTime = performance.now()
  const timeout = 1000 // 1 second timeout

  const normalizedSearch = normalizeText(searchText)
  if (!normalizedSearch || normalizedSearch.length === 0) return

  // Check if search text contains ellipsis indicating multiple fragments
  const hasEllipsis =
    searchText.includes('...') ||
    searchText.includes('…') ||
    searchText.includes('\n')

  if (hasEllipsis) {
    // Split by ellipsis and highlight each fragment
    const fragments = searchText
      .split(/\.{3,}|…|\n/)
      .map((f) => f.trim())
      .filter((f) => f.length > 0)
    const highlights: Array<HTMLElement> = []

    for (const fragment of fragments) {
      if (performance.now() - startTime > timeout) break
      const highlight = findAndHighlightSingleFragment(
        container,
        fragment,
        timeout - (performance.now() - startTime),
      )
      if (highlight) {
        highlights.push(highlight)
      }
    }

    // Scroll to the first highlight
    if (highlights.length > 0) {
      setTimeout(() => {
        highlights[0].scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 10)
    }
    return
  }

  // Original single-match logic
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null,
  )

  let bestMatch: {
    node: Text
    start: number
    end: number
    score: number
  } | null = null
  const nodes: Array<Text> = []

  // Collect all text nodes
  let node: Text | null
  while ((node = walker.nextNode() as Text | null)) {
    if (node.textContent && node.textContent.trim().length > 0) {
      nodes.push(node)
    }
  }

  // Strategy 1: Try to find exact substring matches
  for (const textNode of nodes) {
    const text = textNode.textContent || ''
    const { normalizedText, boundaries } =
      normalizePlainTextWithBoundaries(text)

    // Check if the search text is contained in this node (exact match)
    const index = normalizedText.indexOf(normalizedSearch)
    if (index !== -1) {
      const score = 1.0
      // Map normalized position back to original text
      const originalStart = mapNormalizedToOriginal(boundaries, index)
      const originalEnd = mapNormalizedToOriginal(
        boundaries,
        index + normalizedSearch.length,
      )

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          node: textNode,
          start: originalStart,
          end: originalEnd,
          score,
        }
      }
    }
  }

  // Strategy 2: Try fuzzy matching with sliding window
  if (!bestMatch || bestMatch.score < 0.9) {
    outerLoop: for (const textNode of nodes) {
      if (performance.now() - startTime > timeout) break

      const text = textNode.textContent || ''
      const { normalizedText, boundaries } =
        normalizePlainTextWithBoundaries(text)

      // Use a sliding window that's slightly larger than search text
      const minWindow = normalizedSearch.length
      const maxWindow = Math.min(
        normalizedSearch.length * 3,
        normalizedText.length,
      )

      for (let windowSize = minWindow; windowSize <= maxWindow; windowSize++) {
        if (performance.now() - startTime > timeout) break outerLoop

        for (let i = 0; i <= normalizedText.length - windowSize; i++) {
          const window = normalizedText.substring(i, i + windowSize)
          const similarity = calculateSimilarity(normalizedSearch, window)

          if (
            similarity > 0.6 &&
            (!bestMatch || similarity > bestMatch.score)
          ) {
            const originalStart = mapNormalizedToOriginal(boundaries, i)
            const originalEnd = mapNormalizedToOriginal(
              boundaries,
              i + windowSize,
            )
            bestMatch = {
              node: textNode,
              start: originalStart,
              end: originalEnd,
              score: similarity,
            }
          }
        }
      }
    }
  }

  // Strategy 3: Word-based matching (fallback)
  if (!bestMatch || bestMatch.score < 0.5) {
    for (const textNode of nodes) {
      if (performance.now() - startTime > timeout) break

      const text = textNode.textContent || ''
      const { normalizedText, boundaries } =
        normalizePlainTextWithBoundaries(text)

      const searchWords = normalizedSearch
        .split(/\s+/)
        .filter((w) => w.length > 2) // Ignore very short words
      if (searchWords.length === 0) continue

      const wordPositions: Array<{ word: string; index: number }> = []
      for (const word of searchWords) {
        const index = normalizedText.indexOf(word)
        if (index !== -1) {
          wordPositions.push({ word, index })
        }
      }

      if (wordPositions.length >= Math.ceil(searchWords.length * 0.5)) {
        // At least 50% of words match
        wordPositions.sort((a, b) => a.index - b.index)
        const firstIndex = wordPositions[0].index
        const lastIndex =
          wordPositions[wordPositions.length - 1].index +
          wordPositions[wordPositions.length - 1].word.length

        const score = wordPositions.length / searchWords.length
        if (!bestMatch || score > bestMatch.score) {
          const originalStart = mapNormalizedToOriginal(boundaries, firstIndex)
          const originalEnd = mapNormalizedToOriginal(boundaries, lastIndex)
          bestMatch = {
            node: textNode,
            start: originalStart,
            end: originalEnd,
            score,
          }
        }
      }
    }
  }

  // Highlight the best match
  if (bestMatch && bestMatch.score > 0.3) {
    highlightTextNode(bestMatch.node, bestMatch.start, bestMatch.end)

    // Scroll to the highlighted element
    setTimeout(() => {
      const highlight = container.querySelector('.text-highlight')
      if (highlight) {
        highlight.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 10)
  }
}

/**
 * Finds and highlights a single text fragment
 */
function findAndHighlightSingleFragment(
  container: HTMLElement,
  searchText: string,
  remainingTime: number = 1000,
): HTMLElement | null {
  const startTime = performance.now()
  const timeout = remainingTime

  const normalizedSearch = normalizeText(searchText)
  if (!normalizedSearch || normalizedSearch.length === 0) return null

  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null,
  )

  let bestMatch: {
    node: Text
    start: number
    end: number
    score: number
  } | null = null
  const nodes: Array<Text> = []

  // Collect all text nodes that haven't been highlighted yet
  let node: Text | null
  while ((node = walker.nextNode() as Text | null)) {
    if (node.textContent && node.textContent.trim().length > 0) {
      // Skip already highlighted nodes
      if (node.parentElement?.classList.contains('text-highlight')) {
        continue
      }
      nodes.push(node)
    }
  }

  // Try exact match first
  for (const textNode of nodes) {
    const text = textNode.textContent || ''
    const { normalizedText, boundaries } =
      normalizePlainTextWithBoundaries(text)

    const index = normalizedText.indexOf(normalizedSearch)
    if (index !== -1) {
      const score = 1.0
      const originalStart = mapNormalizedToOriginal(boundaries, index)
      const originalEnd = mapNormalizedToOriginal(
        boundaries,
        index + normalizedSearch.length,
      )

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          node: textNode,
          start: originalStart,
          end: originalEnd,
          score,
        }
      }
    }
  }

  // Try fuzzy matching if no exact match
  if (!bestMatch || bestMatch.score < 0.9) {
    outerLoop: for (const textNode of nodes) {
      if (performance.now() - startTime > timeout) break

      const text = textNode.textContent || ''
      const { normalizedText, boundaries } =
        normalizePlainTextWithBoundaries(text)

      const minWindow = Math.min(normalizedSearch.length, normalizedText.length)
      const maxWindow = Math.min(
        normalizedSearch.length * 2,
        normalizedText.length,
      )

      for (let windowSize = minWindow; windowSize <= maxWindow; windowSize++) {
        if (performance.now() - startTime > timeout) break outerLoop

        for (let i = 0; i <= normalizedText.length - windowSize; i++) {
          const window = normalizedText.substring(i, i + windowSize)
          const similarity = calculateSimilarity(normalizedSearch, window)

          if (
            similarity > 0.6 &&
            (!bestMatch || similarity > bestMatch.score)
          ) {
            const originalStart = mapNormalizedToOriginal(boundaries, i)
            const originalEnd = mapNormalizedToOriginal(
              boundaries,
              i + windowSize,
            )
            bestMatch = {
              node: textNode,
              start: originalStart,
              end: originalEnd,
              score: similarity,
            }
          }
        }
      }
    }
  }

  // Highlight if found
  if (bestMatch && bestMatch.score > 0.5) {
    return highlightTextNode(bestMatch.node, bestMatch.start, bestMatch.end)
  }

  return null
}

/**
 * Maps a position in normalized text back to original text position
 */
function mapNormalizedToOriginal(
  boundaries: Array<number>,
  normalizedPos: number,
): number {
  if (normalizedPos <= 0) {
    return boundaries[0] ?? 0
  }

  if (normalizedPos >= boundaries.length) {
    return boundaries[boundaries.length - 1] ?? 0
  }

  return boundaries[normalizedPos]
}

/**
 * Highlights a portion of a text node and returns the highlight element
 */
function highlightTextNode(
  node: Text,
  start: number,
  end: number,
): HTMLElement {
  const text = node.textContent || ''
  const before = text.substring(0, start)
  const match = text.substring(start, end)
  const after = text.substring(end)

  const highlight = document.createElement('mark')
  highlight.className = 'text-highlight'
  highlight.style.backgroundColor = '#fef08a'
  highlight.style.color = '#000'
  highlight.style.padding = '2px 4px'
  highlight.style.borderRadius = '3px'
  highlight.style.boxShadow = '0 0 0 2px rgba(254, 240, 138, 0.5)'
  highlight.style.transition = 'all 0.2s ease'
  highlight.textContent = match

  const parent = node.parentNode
  if (!parent) return highlight

  const fragment = document.createDocumentFragment()
  if (before) fragment.appendChild(document.createTextNode(before))
  fragment.appendChild(highlight)
  if (after) fragment.appendChild(document.createTextNode(after))

  parent.replaceChild(fragment, node)

  return highlight
}
