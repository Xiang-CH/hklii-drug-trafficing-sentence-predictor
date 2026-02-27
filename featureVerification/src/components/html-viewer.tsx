import { useEffect, useRef } from 'react'
import { findAndHighlightText } from '../lib/text-matching'

interface HtmlViewerProps {
  html: string
  highlightedText: string | null
}

function sanitizeJudgementHtml(rawHtml: string) {
  // Legacy source files often contain full documents with head/scripts/stylesheets.
  // Strip document-level wrappers so we render a stable body fragment in React.
  return rawHtml
    .replaceAll(/<\?xml[\s\S]*?\?>/gi, '')
    .replaceAll(/<!doctype[\s\S]*?>/gi, '')
    .replaceAll(/<head[\s\S]*?<\/head>/gi, '')
    .replaceAll(/<html[^>]*>/gi, '')
    .replaceAll(/<\/html>/gi, '')
    .replaceAll(/<body[^>]*>/gi, '')
    .replaceAll(/<\/body>/gi, '')
    .replaceAll(/<script[\s\S]*?<\/script>/gi, '')
    .replaceAll(/<link\b[^>]*>/gi, '')
    .replaceAll(/<meta\b[^>]*>/gi, '')
    .replaceAll(/<object[\s\S]*?<\/object>/gi, '')
    .replaceAll(/<style[\s\S]*?<\/style>/gi, '')
    .replaceAll(/<link[\s\S]*?\/?>/gi, '')
    .replaceAll(/<img[^>]*>/gi, '')
    .replaceAll(/<script[\s\S]*?<\/script>/gi, '')
}

export default function HtmlViewer({ html, highlightedText }: HtmlViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const highlightedRef = useRef<number | null>(null)

  const htmlContent = sanitizeJudgementHtml(html)

  useEffect(() => {
    if (!containerRef.current) return

    // Clear previous highlights
    if (highlightedRef.current) {
      clearTimeout(highlightedRef.current)
    }

    // Remove all existing highlights
    const highlights = containerRef.current.querySelectorAll('.text-highlight')
    highlights.forEach((el) => {
      const parent = el.parentNode
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent || ''), el)
        parent.normalize()
      }
    })

    if (highlightedText) {
      // Small delay to ensure DOM is ready
      highlightedRef.current = window.setTimeout(() => {
        findAndHighlightText(containerRef.current!, highlightedText)
      }, 10)
    }

    return () => {
      if (highlightedRef.current) {
        clearTimeout(highlightedRef.current)
      }
    }
  }, [highlightedText, html])

  return (
    <div
      ref={containerRef}
      suppressHydrationWarning
      className="judgment p-6 prose prose-sm max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: htmlContent }}
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        lineHeight: '1.9',
      }}
    />
  )
}
