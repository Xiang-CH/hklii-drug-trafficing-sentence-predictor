interface SourceFieldProps {
  source: string
  onHover: (text: string | null) => void
}

export function SourceField({ source, onHover }: SourceFieldProps) {
  return (
    <span
      className="inline-block text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded cursor-help hover:bg-green-100 dark:hover:bg-green-900/50 transition-all border border-green-200 dark:border-green-800 hover:border-green-400 dark:hover:border-green-600"
      onMouseEnter={() => onHover(source)}
      onMouseLeave={() => onHover(null)}
      title="Hover to highlight source text in HTML"
    >
      <span className="text-xs text-green-600 dark:text-green-400 mr-1">
        📎
      </span>
      "{source.substring(0, 100)}
      {source.length > 100 ? '...' : ''}"
    </span>
  )
}
