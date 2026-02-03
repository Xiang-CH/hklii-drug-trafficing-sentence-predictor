import { DateRangeField, TimeField } from './date-time-field'
import { EditableField } from './editable-field'
import { SourceField } from './source-field'
import { COMPUTED_FIELDS } from '@/lib/schema'

interface EditableDataObjectProps {
  data: any
  onSourceHover: (text: string | null) => void
  isEditing: boolean
  onChange: (data: any) => void
  fieldName?: string
  parentField?: string // Parent field name to determine enum context
  isComputed?: boolean // Whether this field is computed/read-only
}

export function EditableDataObject({
  data,
  onSourceHover,
  isEditing,
  onChange,
  fieldName,
  parentField,
  isComputed,
}: EditableDataObjectProps) {
  const isFieldComputed =
    isComputed || COMPUTED_FIELDS.includes(fieldName || '')

  if (data === null || data === undefined) {
    return (
      <div>
        <span className="text-gray-400 italic">Not Specified</span>
        {isEditing && !isFieldComputed && (
          <button
            onClick={() => onChange('')}
            className="ml-2 text-blue-500 hover:text-blue-700 text-xs"
          >
            Set Value
          </button>
        )}
      </div>
    )
  }

  // Special handling for date field (can be single date or date range)
  if (
    fieldName === 'date' &&
    (typeof data === 'string' || (Array.isArray(data) && data.length === 2))
  ) {
    return (
      <DateRangeField
        value={data}
        isEditing={isEditing}
        onChange={(val) => onChange(val)}
        isComputed={isFieldComputed}
      />
    )
  }

  if (
    typeof data === 'string' ||
    typeof data === 'number' ||
    typeof data === 'boolean'
  ) {
    return (
      <EditableField
        value={data}
        isEditing={isEditing}
        onChange={(val) => onChange(val)}
        onSourceHover={onSourceHover}
        fieldName={fieldName}
        parentField={parentField}
        isComputed={isFieldComputed}
      />
    )
  }

  if (Array.isArray(data)) {
    if (isFieldComputed) {
      return (
        <div className="ml-4 w-full">
          <span className="text-gray-500 dark:text-gray-400 font-medium min-w-30">
            {fieldName}*:
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            [Array - computed]
          </span>
        </div>
      )
    }

    return (
      <div className="ml-2 space-y-2">
        {data.map((item, index) => (
          <div
            key={index}
            className="border-l-2 border-gray-200 dark:border-gray-700 pl-3"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-gray-500 dark:text-gray-400 text-sm">
                [{index}]
              </span>
              {isEditing && (
                <button
                  onClick={() => {
                    const newData = [...data]
                    newData.splice(index, 1)
                    onChange(newData)
                  }}
                  className="text-red-500 hover:text-red-700 text-xs hover:underline hover:cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>
            <EditableDataObject
              data={item}
              onSourceHover={onSourceHover}
              isEditing={isEditing}
              onChange={(val) => {
                const newData = [...data]
                newData[index] = val
                onChange(newData)
              }}
              parentField={fieldName}
              isComputed={isFieldComputed}
            />
          </div>
        ))}
        {isEditing && (
          <button
            onClick={() => {
              onChange([...data, null])
            }}
            className="text-blue-500 hover:text-blue-700 text-sm ml-3"
          >
            + Add Item
          </button>
        )}
      </div>
    )
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data)

    return (
      <div className="space-y-2">
        {entries.map(([key, value]) => {
          const isEntryComputed = COMPUTED_FIELDS.includes(key)
          const isArray = Array.isArray(value)

          return (
            <div
              key={key}
              className={`flex ${isArray ? 'flex-col' : ' items-start'} w-full`}
            >
              <div className="text-purple-600 dark:text-purple-400 font-medium">
                {key}:
              </div>
              <div className={`${isArray ? 'ml-6 mt-1' : 'ml-2'} flex-1`}>
                {key === 'source' && typeof value === 'string' ? (
                  <SourceField source={value} onHover={onSourceHover} />
                ) : (
                  <EditableDataObject
                    data={value}
                    onSourceHover={onSourceHover}
                    isEditing={isEditing}
                    onChange={(val) => {
                      onChange({ ...data, [key]: val })
                    }}
                    fieldName={key}
                    parentField={fieldName || parentField}
                    isComputed={isEntryComputed}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return null
}
