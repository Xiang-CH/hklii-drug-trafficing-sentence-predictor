import Holidays from 'date-holidays'

import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'

interface CountrySelectProps {
  value?: string | null
  onValueChange?: (value: string | null) => void
  placeholder?: string
  disabled?: boolean
}

interface CountryOption {
  value: string
  label: string
}

const holidays = new Holidays()

const countryOptions: Array<CountryOption> = Object.entries(
  holidays.getCountries('en'),
)
  .map(([code, name]) => ({
    value: code,
    label: name,
  }))
  .sort((left, right) => left.label.localeCompare(right.label))

export function CountrySelect({
  value,
  onValueChange,
  placeholder = 'Select country',
  disabled = false,
}: CountrySelectProps) {
  const selectedCountry =
    countryOptions.find((option) => option.value === value) ??
    (value ? { value, label: value } : null)

  const items = selectedCountry
    ? [
        selectedCountry,
        ...countryOptions.filter((option) => option.value !== value),
      ]
    : countryOptions

  return (
    <Combobox
      items={items.filter((option) => option.value !== 'HK')}
      value={selectedCountry}
      onValueChange={(nextValue) => onValueChange?.(nextValue?.value ?? '')}
      itemToStringLabel={(item) => item.label}
      itemToStringValue={(item) => item.value}
      disabled={disabled}
    >
      <ComboboxInput
        placeholder={placeholder}
        disabled={disabled}
        aria-label="Country"
      />
      <ComboboxContent>
        <ComboboxEmpty>No country found.</ComboboxEmpty>
        <ComboboxList>
          <ComboboxCollection>
            {(option: CountryOption) => (
              <ComboboxItem key={option.value} value={option}>
                <span>{option.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {option.value}
                </span>
              </ComboboxItem>
            )}
          </ComboboxCollection>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
