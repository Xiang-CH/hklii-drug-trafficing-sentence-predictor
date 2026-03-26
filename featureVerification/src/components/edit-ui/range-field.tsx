import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

export type RangeValue = number | [number, number]

interface RangeFieldBaseProps {
  value: RangeValue
  isEditing: boolean
  onChange: (value: RangeValue) => void
  isComputed?: boolean
}

interface GenericRangeFieldProps extends RangeFieldBaseProps {
  singleLabel: string
  rangeLabel: string
  singlePlaceholder: string
  rangeMinPlaceholder: string
  rangeMaxPlaceholder: string
  singleWidthClass: string
  rangeWidthClass: string
  max?: number
}

function GenericRangeField({
  value,
  isEditing,
  onChange,
  isComputed,
  singleLabel,
  rangeLabel,
  singlePlaceholder,
  rangeMinPlaceholder,
  rangeMaxPlaceholder,
  singleWidthClass,
  rangeWidthClass,
  max,
}: GenericRangeFieldProps) {
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
        <span className="text-sm">{singleLabel}</span>
        <Switch
          checked={isRange}
          onCheckedChange={(checked) => {
            if (checked && !isRange) {
              onChange([value, value])
            } else if (!checked && isRange) {
              onChange(value[0])
            }
          }}
        />
        <span className="text-sm">{rangeLabel}</span>
      </div>

      {isRange ? (
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            min={0}
            max={max}
            value={value[0]}
            onChange={(e) => {
              const newMin = parseInt(e.target.value) || 0
              onChange([newMin, value[1]])
            }}
            className={rangeWidthClass}
            placeholder={rangeMinPlaceholder}
          />
          <span className="text-gray-500">to</span>
          <Input
            type="number"
            min={0}
            max={max}
            value={value[1]}
            onChange={(e) => {
              const newMax = parseInt(e.target.value) || 0
              onChange([value[0], newMax])
            }}
            className={rangeWidthClass}
            placeholder={rangeMaxPlaceholder}
          />
        </div>
      ) : (
        <Input
          type="number"
          min={0}
          max={max}
          value={value}
          onChange={(e) => {
            const newValue = parseInt(e.target.value) || 0
            onChange(newValue)
          }}
          className={singleWidthClass}
          placeholder={singlePlaceholder}
        />
      )}
    </div>
  )
}

export function AgeRangeField(props: RangeFieldBaseProps) {
  return (
    <GenericRangeField
      {...props}
      singleLabel="Single age"
      rangeLabel="Age range"
      singlePlaceholder="Age"
      rangeMinPlaceholder="Min"
      rangeMaxPlaceholder="Max"
      singleWidthClass="w-24"
      rangeWidthClass="w-20"
      max={120}
    />
  )
}

export function WageRangeField(props: RangeFieldBaseProps) {
  return (
    <GenericRangeField
      {...props}
      singleLabel="Single wage"
      rangeLabel="Wage range"
      singlePlaceholder="Monthly wage"
      rangeMinPlaceholder="Min wage"
      rangeMaxPlaceholder="Max wage"
      singleWidthClass="w-32"
      rangeWidthClass="w-28"
    />
  )
}

export function AmountRangeField(props: RangeFieldBaseProps) {
  return (
    <GenericRangeField
      {...props}
      singleLabel="Single amount"
      rangeLabel="Amount range"
      singlePlaceholder="Amount"
      rangeMinPlaceholder="Min amount"
      rangeMaxPlaceholder="Max amount"
      singleWidthClass="w-32"
      rangeWidthClass="w-28"
    />
  )
}
