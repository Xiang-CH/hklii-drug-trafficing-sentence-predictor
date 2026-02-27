import { DateRangeField } from './date-time-field'
import { AgeRangeField } from './age-range-field'
import { EditableField } from './editable-field'
import { SourceField } from './source-field'
import {
  COMPUTED_FIELDS,
  getDefaultValueForField,
  isFieldNullable,
  isMandatoryNotGivenField,
} from '@/lib/schema'

interface EditableDataObjectProps {
  data: any
  onSourceHover: (text: string | null) => void
  isEditing: boolean
  onChange: (data: any) => void
  fieldName?: string
  parentField?: string // Parent field name to determine enum context
  isComputed?: boolean // Whether this field is computed/read-only
  path?: string
  notGivenMap?: Record<string, boolean>
  onToggleNotGiven?: (path: string, next: boolean) => void
  disabled?: boolean
}

export function EditableDataObject({
  data,
  onSourceHover,
  isEditing,
  onChange,
  fieldName,
  parentField,
  isComputed,
  path = fieldName ?? '',
  notGivenMap = {},
  onToggleNotGiven,
  disabled = false,
}: EditableDataObjectProps) {
  const isFieldComputed =
    isComputed || COMPUTED_FIELDS.includes(fieldName || '')

  const isDisabled = disabled || !!notGivenMap[path]
  const canEdit = isEditing && !isFieldComputed && !isDisabled

  function NotGivenToggle({
    checked,
    onToggle,
  }: {
    checked: boolean
    onToggle: (next: boolean) => void
  }) {
    return (
      <label className={`ml-2 flex items-center gap-1 text-xs`}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <span className="text-gray-500 dark:text-gray-400">Not given</span>
      </label>
    )
  }

  function handleSetValue() {
    // For array items or nested fields, use parent context to infer schema
    const schemaKey = fieldName || parentField

    console.log('Schema:' + schemaKey)

    if (!schemaKey) {
      onChange('')
      return
    }

    // Get the default value based on the field schema
    // Pass parentField to help resolve array item types
    // TODO: Some field name cannot be matched
    const defaultValue = getDefaultValueForField(schemaKey, parentField, true)
    onChange(defaultValue)
  }

  if (data === null || data === undefined) {
    return (
      <div>
        <span className="text-gray-400 italic">Not Specified</span>
        {isEditing && !isFieldComputed && (
          <button
            onClick={handleSetValue}
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
        isEditing={isEditing && !isDisabled}
        onChange={(val) => onChange(val)}
        isComputed={isFieldComputed}
      />
    )
  }

  // Special handling for age field (can be single age or age range)
  if (
    fieldName === 'age' &&
    (parentField === 'age_at_offence' || parentField === 'age_at_sentencing') &&
    (typeof data === 'number' || (Array.isArray(data) && data.length === 2))
  ) {
    return (
      <AgeRangeField
        value={data}
        isEditing={isEditing && !isDisabled}
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
        isEditing={isEditing && !isDisabled}
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
              {canEdit && (
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
              disabled={isDisabled}
              path={`${path}[${index}]`}
              notGivenMap={notGivenMap}
              onToggleNotGiven={onToggleNotGiven}
            />
          </div>
        ))}
        {canEdit && (
          <button
            onClick={() => {
              // Get default value for array items
              const defaultItem = getDefaultValueForField(
                fieldName || '',
                parentField,
              )
              onChange([...data, defaultItem])
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

          const entryPath = path ? `${path}.${key}` : key
          const entryNotGiven = !!notGivenMap[entryPath]
          const entryDisabled = disabled || entryNotGiven

          const isNullable = isFieldNullable(key, fieldName || parentField)
          const hasValue = value !== null && value !== undefined
          const isMandatoryField = isMandatoryNotGivenField(key)
          const showNotGivenToggle = !isEntryComputed && isMandatoryField
          // TODO: DefaultValue not used because some fields has no matching schema and will cause errors
          /**
          let defaultValue: any
          defaultValue = getDefaultValueForField(key, fieldName || parentField, true)
          if ((typeof defaultValue === "object") && (Object.keys(defaultValue).length === 0)){
            if (typeof value === 'string') defaultValue = ''
            else if (typeof value === 'number') defaultValue = 0
            else if (typeof value === 'boolean') defaultValue = false
            else defaultValue = ''
          } */

          return (
            <div
              key={key}
              className={`flex ${isArray ? 'flex-col' : ' items-start'} w-full`}
            >
              <div className="flex items-center gap-2">
                <div className="text-purple-600 dark:text-purple-400 font-medium">
                  {key}:
                </div>
                {showNotGivenToggle && onToggleNotGiven && (
                  <NotGivenToggle
                    checked={entryNotGiven}
                    onToggle={(next) => onToggleNotGiven(entryPath, next)}
                  />
                )}
                {isEditing &&
                  isNullable &&
                  hasValue &&
                  !isEntryComputed &&
                  !entryNotGiven && (
                    <button
                      onClick={() => {
                        onChange({ ...data, [key]: null })
                      }}
                      className="text-xs text-red-500 hover:text-red-700 hover:underline"
                      title="Set to null"
                    >
                      Clear
                    </button>
                  )}
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
                    path={entryPath}
                    notGivenMap={notGivenMap}
                    onToggleNotGiven={onToggleNotGiven}
                    disabled={entryDisabled}
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
