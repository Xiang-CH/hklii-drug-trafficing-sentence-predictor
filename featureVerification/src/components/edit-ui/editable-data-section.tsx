import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { EditableDataObject } from './editable-data-object'
import type { UndoState } from '@/components/editable-data-viewer'

interface EditableDataSectionProps {
  title: string
  data: any
  onSourceHover: (text: string | null) => void
  isEditing: boolean
  onChange: (data: any) => void
  notGivenMap: Record<string, boolean>
  onToggleNotGiven: (path: string, next: boolean) => void
  lastCleared: UndoState
  onClearField: (path: string, previousValue: any) => void
  onUndoClear: () => void
  onRemoveItem: (path: string, index: number, removedItem: any) => void
  onUndoRemove: () => void
}

export function EditableDataSection({
  title,
  data,
  onSourceHover,
  isEditing,
  onChange,
  notGivenMap,
  onToggleNotGiven,
  lastCleared,
  onClearField,
  onUndoClear,
  onRemoveItem,
  onUndoRemove,
}: EditableDataSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const rootPath = title.toLowerCase()

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
            parentField={rootPath}
            path={rootPath}
            notGivenMap={notGivenMap}
            onToggleNotGiven={onToggleNotGiven}
            lastCleared={lastCleared}
            onClearField={onClearField}
            onUndoClear={onUndoClear}
            onRemoveItem={onRemoveItem}
            onUndoRemove={onUndoRemove}
          />
        </div>
      )}
    </div>
  )
}
