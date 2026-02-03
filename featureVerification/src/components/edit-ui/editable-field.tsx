import { DateTimeField, TimeField } from './date-time-field'
import { SubdistrictSelect } from './subdistrict-select'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ENUM_OPTIONS } from '@/lib/schema'

interface EditableFieldProps {
  value: any
  isEditing: boolean
  onChange: (value: any) => void
  onSourceHover: (text: string | null) => void
  fieldName?: string
  parentField?: string
  isComputed?: boolean
}

// Helper function to find enum key
function findEnumKey(
  fieldName: string | undefined,
  parentField?: string,
): string | undefined {
  if (!fieldName) return undefined

  // First try parentField_fieldName format (most specific, handles fields with same name in different contexts)
  if (parentField) {
    const key = `${parentField}_${fieldName}`
    if (key in ENUM_OPTIONS) {
      return key
    }
  }

  // Then try fieldName directly (for non-array fields without parent context)
  if (fieldName in ENUM_OPTIONS) {
    return fieldName
  }

  return undefined
}

export function EditableField({
  value,
  isEditing,
  onChange,
  fieldName,
  parentField,
  isComputed,
}: EditableFieldProps) {
  const shouldShowEditControls = isEditing && !isComputed

  if (!shouldShowEditControls) {
    if (value === null || value === undefined) {
      return <span className="text-gray-400 italic">null</span>
    }
    if (typeof value === 'string') {
      return (
        <span
          className={
            isComputed
              ? 'text-gray-500 dark:text-gray-400'
              : 'text-gray-700 dark:text-gray-300'
          }
        >
          "{value}"
        </span>
      )
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return (
        <span
          className={
            isComputed
              ? 'text-gray-500 dark:text-gray-400'
              : 'text-blue-600 dark:text-blue-400'
          }
        >
          {String(value)}
        </span>
      )
    }
    return (
      <span className="text-gray-500 dark:text-gray-400">{String(value)}</span>
    )
  }

  // console.log(fieldName, value)
  if (fieldName === 'subDistrict') {
    return <SubdistrictSelect value={value} onValueChange={onChange} />
  }

  // Check if this is an enumerated string field
  // Use findEnumKey to look up enum options
  const enumKey = findEnumKey(fieldName, parentField)

  // Enum field - use Select dropdown
  if (enumKey) {
    return (
      <Select
        value={value ?? ''}
        onValueChange={(val) => {
          onChange(val === 'placeholder' ? null : val)
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Not specified" />
        </SelectTrigger>
        <SelectContent>
          {ENUM_OPTIONS[enumKey].map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
          <SelectItem key="placeholder" value="placeholder">
            Not specified
          </SelectItem>
        </SelectContent>
      </Select>
    )
  }

  // Boolean field - use select
  if (typeof value === 'boolean') {
    return (
      <Select
        value={String(value)}
        onValueChange={(val) => {
          onChange(val === 'null' ? null : val === 'true')
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={fieldName} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="null">null</SelectItem>
          <SelectItem value="true">true</SelectItem>
          <SelectItem value="false">false</SelectItem>
        </SelectContent>
      </Select>
    )
  }

  if (fieldName === 'time' && typeof value === 'string') {
    return (
      <TimeField
        value={value}
        isEditing={isEditing}
        onChange={(val) => onChange(val)}
        isComputed={isComputed}
      />
    )
  }

  if (fieldName?.endsWith('date_time') && typeof value === 'string') {
    return (
      <DateTimeField
        value={value}
        isEditing={isEditing}
        onChange={(val) => onChange(val)}
        isComputed={isComputed}
      />
    )
  }

  if (typeof value === 'number') {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const val = e.target.value === '' ? null : Number(e.target.value)
          onChange(val)
        }}
        className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      />
    )
  }

  // String or default
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => {
        const val = e.target.value === '' ? null : e.target.value
        onChange(val)
      }}
      className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
    />
  )
}
