import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const primaryRoles = [
  'Courier / Storekeeper',
  'Actual trafficker',
  'Manager / Organiser',
  'Operator / Financial controller',
] as const

const supplementaryCircumstances = [
  'Cross-border trafficking',
  'Divan keeping',
  'Manufacturing',
] as const

type PrimaryRole = (typeof primaryRoles)[number]
type SupplementaryCircumstance = (typeof supplementaryCircumstances)[number]

type SentencingRoleValue = {
  primary_role: PrimaryRole
  additional_circumstances: Array<SupplementaryCircumstance>
  inferred: boolean
  source: string
}

interface SentencingRoleFieldProps {
  value: SentencingRoleValue | null
  isEditing: boolean
  onChange: (value: SentencingRoleValue | null) => void
  onSourceHover: (text: string | null) => void
}

export function SentencingRoleField({
  value,
  isEditing,
  onChange,
  onSourceHover,
}: SentencingRoleFieldProps) {
  if (value === null) {
    return (
      <div>
        <span className="text-gray-400 italic">Not Specified</span>
        {isEditing && (
          <button
            onClick={() =>
              onChange({
                primary_role: 'Courier / Storekeeper',
                additional_circumstances: [],
                inferred: false,
                source: '',
              })
            }
            className="ml-2 text-blue-500 hover:text-blue-700 text-xs"
          >
            Set Value
          </button>
        )}
      </div>
    )
  }

  const toggleCircumstance = (circumstance: SupplementaryCircumstance) => {
    const selected = value.additional_circumstances.includes(circumstance)
    onChange({
      ...value,
      additional_circumstances: selected
        ? value.additional_circumstances.filter((item) => item !== circumstance)
        : [...value.additional_circumstances, circumstance],
    })
  }

  return (
    <div className="space-y-3 rounded border border-purple-200 p-3 dark:border-purple-900">
      <div className="space-y-1">
        <div className="text-sm font-medium">Primary role</div>
        {isEditing ? (
          <Select
            value={value.primary_role}
            onValueChange={(primaryRole) =>
              onChange({ ...value, primary_role: primaryRole as PrimaryRole })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {primaryRoles.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="text-gray-700 dark:text-gray-300">
            {value.primary_role}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="text-sm font-medium">Additional circumstances</div>
        <div className="space-y-1">
          {supplementaryCircumstances.map((circumstance) => (
            <label
              key={circumstance}
              className="flex items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                checked={value.additional_circumstances.includes(circumstance)}
                disabled={!isEditing}
                onChange={() => toggleCircumstance(circumstance)}
              />
              <span>{circumstance}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-sm font-medium">source</div>
        {isEditing ? (
          <textarea
            value={value.source}
            onChange={(event) =>
              onChange({ ...value, source: event.target.value })
            }
            className="min-h-16 w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        ) : (
          <div
            className="text-gray-700 dark:text-gray-300"
            onMouseEnter={() => onSourceHover(value.source)}
            onMouseLeave={() => onSourceHover(null)}
          >
            {value.source || 'Not specified'}
          </div>
        )}
      </div>

      {isEditing && (
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={value.inferred}
              onChange={(event) =>
                onChange({ ...value, inferred: event.target.checked })
              }
            />
            <span className="text-amber-600 dark:text-amber-400">
              Inferred/Calculated
            </span>
          </label>
          <button
            onClick={() => onChange(null)}
            className="text-xs text-red-500 hover:text-red-700 hover:underline"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  )
}
