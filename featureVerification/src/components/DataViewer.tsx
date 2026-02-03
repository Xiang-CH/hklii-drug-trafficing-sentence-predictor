import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface DataViewerProps {
  data: {
    judgement: any
    defendants: any
    trials: any
  }
  onSourceHover: (text: string | null) => void
}

export default function DataViewer({ data, onSourceHover }: DataViewerProps) {
  return (
    <div className="space-y-4">
      {data.judgement && (
        <DataSection
          title="Judgement"
          data={data.judgement}
          onSourceHover={onSourceHover}
        />
      )}
      {data.defendants && (
        <DataSection
          title="Defendants"
          data={data.defendants}
          onSourceHover={onSourceHover}
        />
      )}
      {data.trials && (
        <DataSection
          title="Trials"
          data={data.trials}
          onSourceHover={onSourceHover}
        />
      )}
    </div>
  )
}

interface DataSectionProps {
  title: string
  data: any
  onSourceHover: (text: string | null) => void
}

function DataSection({ title, data, onSourceHover }: DataSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center gap-2 text-left font-semibold text-gray-900 dark:text-white"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        {title}
      </button>
      {isExpanded && (
        <div className="p-4">
          <DataObject data={data} onSourceHover={onSourceHover} />
        </div>
      )}
    </div>
  )
}

interface DataObjectProps {
  data: any
  onSourceHover: (text: string | null) => void
  level?: number
}

function DataObject({ data, onSourceHover, level = 0 }: DataObjectProps) {
  if (data === null || data === undefined) {
    return <span className="text-gray-400 italic">null</span>
  }

  if (typeof data === 'string') {
    return <span className="text-gray-700 dark:text-gray-300">"{data}"</span>
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return (
      <span className="text-blue-600 dark:text-blue-400">{String(data)}</span>
    )
  }

  if (Array.isArray(data)) {
    return (
      <div className="ml-4 space-y-2">
        {data.map((item, index) => (
          <div
            key={index}
            className="border-l-2 border-gray-200 dark:border-gray-700 pl-3"
          >
            <span className="text-gray-500 dark:text-gray-400 text-sm">
              [{index}]
            </span>
            <DataObject
              data={item}
              onSourceHover={onSourceHover}
              level={level + 1}
            />
          </div>
        ))}
      </div>
    )
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data)
    return (
      <div className="space-y-2">
        {entries.map(([key, value]) => (
          <div key={key} className="ml-4">
            <div className="flex items-start gap-2">
              <span className="text-purple-600 dark:text-purple-400 font-medium">
                {key}:
              </span>
              {key === 'source' && typeof value === 'string' ? (
                <SourceField source={value} onHover={onSourceHover} />
              ) : (
                <div className="flex-1">
                  <DataObject
                    data={value}
                    onSourceHover={onSourceHover}
                    level={level + 1}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return null
}

interface SourceFieldProps {
  source: string
  onHover: (text: string | null) => void
}

function SourceField({ source, onHover }: SourceFieldProps) {
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
