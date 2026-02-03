import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { districtToSubDistricts, regionGroups } from '@/lib/hk-district'

interface SubdistrictSelectProps {
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function SubdistrictSelect({
  value,
  onValueChange,
  placeholder = 'Select subdistrict',
  disabled = false,
}: SubdistrictSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(regionGroups).map(([region, districtsList]) => (
          <div key={region}>
            {districtsList.map((district) => (
              <>
                <SelectGroup key={district}>
                  <SelectLabel>{district}</SelectLabel>
                  <div className="ml-2">
                    {districtToSubDistricts[district].map((subdistrict) => (
                      <SelectItem key={subdistrict} value={subdistrict}>
                        {subdistrict}
                      </SelectItem>
                    ))}
                  </div>
                </SelectGroup>
                <SelectSeparator />
              </>
            ))}
          </div>
        ))}
      </SelectContent>
    </Select>
  )
}
