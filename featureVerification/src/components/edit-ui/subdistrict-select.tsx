import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { districtToSubDistricts, regionGroups } from '@/lib/hk-district'

interface SubdistrictSelectProps {
  value?: string
  onValueChange?: (value: string | null) => void
  placeholder?: string
  disabled?: boolean
}

interface SubdistrictOption {
  value: string
  label: string
  district: string
  region: string
}

const allOptions: Array<SubdistrictOption> = Object.entries(
  regionGroups,
).flatMap(([region, districts]) =>
  districts.flatMap((district) =>
    districtToSubDistricts[district].map((subdistrict) => ({
      value: subdistrict,
      label: subdistrict,
      district,
      region,
    })),
  ),
)

export function SubdistrictSelect({
  value,
  onValueChange,
  placeholder = 'Select subdistrict',
  disabled = false,
}: SubdistrictSelectProps) {
  const selectedInOptions = allOptions.some((option) => option.value === value)
  const selectedOption =
    allOptions.find((option) => option.value === value) ??
    (value
      ? {
          value,
          label: value,
          district: 'Current value',
          region: 'Current value',
        }
      : null)

  return (
    <Combobox
      items={
        selectedOption && !selectedInOptions
          ? [selectedOption, ...allOptions]
          : allOptions
      }
      value={selectedOption}
      onValueChange={(nextValue) => {
        onValueChange?.(nextValue?.value ?? null)
      }}
      itemToStringLabel={(item: SubdistrictOption) => item.label}
      itemToStringValue={(item: SubdistrictOption) => item.value}
      filter={(item: SubdistrictOption, query: string) => {
        const normalizedQuery = query.trim().toLowerCase()

        if (!normalizedQuery) {
          return true
        }

        return [item.label, item.district, item.region, item.value].some(
          (part) => part.toLowerCase().includes(normalizedQuery),
        )
      }}
      disabled={disabled}
    >
      <ComboboxInput
        placeholder={placeholder}
        disabled={disabled}
        aria-label="Subdistrict"
      />
      <ComboboxContent>
        <ComboboxEmpty>No subdistrict found.</ComboboxEmpty>
        <ComboboxList>
          <ComboboxCollection>
            {(option: SubdistrictOption) => (
              <ComboboxItem key={option.value} value={option}>
                <div className="min-w-0">
                  <div className="truncate">{option.label}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {option.district} · {option.region}
                  </div>
                </div>
              </ComboboxItem>
            )}
          </ComboboxCollection>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
