import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { EditableDataObject } from './editable-data-object'

interface EditableDataSectionProps {
  title: string
  data: any
  onSourceHover: (text: string | null) => void
  isEditing: boolean
  onChange: (data: any) => void
}

export function EditableDataSection({
  title,
  data,
  onSourceHover,
  isEditing,
  onChange,
}: EditableDataSectionProps) {
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
          <EditableDataObject
            data={data}
            onSourceHover={onSourceHover}
            isEditing={isEditing}
            onChange={onChange}
            parentField={title.toLocaleLowerCase()}
          />
        </div>
      )}
    </div>
  )
}
