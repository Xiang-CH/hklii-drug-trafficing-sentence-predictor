import * as React from 'react'
import { CheckIcon, ChevronDownIcon, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'

interface MultiSelectProps {
  value: Array<string> | null
  onChange: (value: Array<string>) => void
  options: Array<string>
  placeholder?: string
  className?: string
}

export function MultiSelect({
  value = [],
  onChange,
  options,
  placeholder = 'Select options...',
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const selected = value || []

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((item) => item !== option))
    } else {
      onChange([...selected, option])
    }
  }

  const clearSelection = () => {
    onChange([])
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-between',
            selected.length > 0 && 'border-primary',
            className,
          )}
        >
          {selected.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            <span className="flex gap-1 flex-wrap">
              {selected.map((item) => (
                <span
                  key={item}
                  className="bg-primary/10 text-primary px-2 py-0.5 rounded-sm text-xs"
                >
                  {item}
                </span>
              ))}
            </span>
          )}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                clearSelection()
              }}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <XIcon className="h-3 w-3" />
            </button>
          )}
          <ChevronDownIcon className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <div className="max-h-64 overflow-y-auto p-2">
          <div className="space-y-2">
            {options.map((option) => (
              <div
                key={option}
                className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-accent cursor-pointer"
                onClick={() => toggleOption(option)}
              >
                <Checkbox
                  checked={selected.includes(option)}
                  onCheckedChange={() => toggleOption(option)}
                  id={`checkbox-${option}`}
                />
                <label
                  htmlFor={`checkbox-${option}`}
                  className="flex-1 text-sm cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  {option}
                </label>
              </div>
            ))}
            {options.length === 0 && (
              <div className="py-4 text-center text-sm text-muted-foreground">
                No options available
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
