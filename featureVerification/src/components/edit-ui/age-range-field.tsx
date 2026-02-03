import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'

interface AgeRangeFieldProps {
  value: number | Array<number>
  isEditing: boolean
  onChange: (value: number | Array<number>) => void
  isComputed?: boolean
}

export function AgeRangeField({
  value,
  isEditing,
  onChange,
  isComputed,
}: AgeRangeFieldProps) {
  const isRange = Array.isArray(value)
  const shouldShowEditControls = isEditing && !isComputed

  if (!shouldShowEditControls) {
    if (isRange) {
      return (
        <span
          className={
            isComputed
              ? 'text-gray-500 dark:text-gray-400'
              : 'text-gray-700 dark:text-gray-300'
          }
        >
          [{value[0]}, {value[1]}]
        </span>
      )
    }
    return (
      <span
        className={
          isComputed
            ? 'text-gray-500 dark:text-gray-400'
            : 'text-gray-700 dark:text-gray-300'
        }
      >
        {value}
      </span>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <span className="text-sm">Single age</span>
        <Switch
          checked={isRange}
          onCheckedChange={(checked) => {
            if (checked && !isRange) {
              // Convert single age to range
              onChange([value, value])
            } else if (!checked && isRange) {
              // Convert range to single age (use first age)
              onChange(value[0])
            }
          }}
        />
        <span className="text-sm">Age range</span>
      </div>

      {isRange ? (
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            min={0}
            max={120}
            value={value[0]}
            onChange={(e) => {
              const newMin = parseInt(e.target.value) || 0
              onChange([newMin, value[1]])
            }}
            className="w-20"
            placeholder="Min"
          />
          <span className="text-gray-500">to</span>
          <Input
            type="number"
            min={0}
            max={120}
            value={value[1]}
            onChange={(e) => {
              const newMax = parseInt(e.target.value) || 0
              onChange([value[0], newMax])
            }}
            className="w-20"
            placeholder="Max"
          />
        </div>
      ) : (
        <Input
          type="number"
          min={0}
          max={120}
          value={value}
          onChange={(e) => {
            const newValue = parseInt(e.target.value) || 0
            onChange(newValue)
          }}
          className="w-24"
          placeholder="Age"
        />
      )}
    </div>
  )
}
