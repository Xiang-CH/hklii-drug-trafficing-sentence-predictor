import { useEffect, useRef } from 'react'
import { findAndHighlightText } from '../lib/text-matching'

interface HtmlViewerProps {
  html: string
  highlightedText: string | null
}

export default function HtmlViewer({ html, highlightedText }: HtmlViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const highlightedRef = useRef<number | null>(null)

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
      className="judgment p-6 prose prose-sm max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        lineHeight: '1.9',
      }}
    />
  )
}
