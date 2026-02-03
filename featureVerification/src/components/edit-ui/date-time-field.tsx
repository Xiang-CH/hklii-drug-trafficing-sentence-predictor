import { CalendarIcon, Clock2Icon } from 'lucide-react'
import { format } from 'date-fns'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardFooter } from '../ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'

interface DateRangeFieldProps {
  value: string | Array<string>
  isEditing: boolean
  onChange: (value: string | Array<string>) => void
  isComputed?: boolean
}

export function DateRangeField({
  value,
  isEditing,
  onChange,
  isComputed,
}: DateRangeFieldProps) {
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
          ["{value[0]}", "{value[1]}"]
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
        "{value}"
      </span>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <span>Single date</span>
        <Switch
          checked={isRange}
          onCheckedChange={(checked) => {
            if (checked && !isRange) {
              // Convert single date to range
              onChange([value, value])
            } else if (!checked && isRange) {
              // Convert range to single date (use first date)
              onChange(value[0])
            }
          }}
        />
        <span>Date range</span>
      </div>

      {isRange ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {value[0] && value[1] ? (
                <>
                  {format(new Date(value[0]), 'PPP')} -{' '}
                  {format(new Date(value[1]), 'PPP')}
                </>
              ) : (
                <span>Pick date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="range"
              defaultMonth={value[0] ? new Date(value[0]) : new Date()}
              selected={
                value[0] && value[1]
                  ? { from: new Date(value[0]), to: new Date(value[1]) }
                  : undefined
              }
              onSelect={(range) => {
                if (range?.from && range.to) {
                  onChange([
                    format(range.from, 'yyyy-MM-dd'),
                    format(range.to, 'yyyy-MM-dd'),
                  ])
                } else if (range?.from) {
                  onChange([
                    format(range.from, 'yyyy-MM-dd'),
                    format(range.from, 'yyyy-MM-dd'),
                  ])
                }
              }}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      ) : (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {value ? (
                format(new Date(value), 'PPP')
              ) : (
                <span>Pick a date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              defaultMonth={new Date(value)}
              selected={value ? new Date(value) : undefined}
              onSelect={(date) => {
                const dateStr = date ? format(date, 'yyyy-MM-dd') : ''
                onChange(dateStr)
              }}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

interface DateTimeFieldProps {
  value: string
  isEditing: boolean
  onChange: (value: string) => void
  isComputed?: boolean
}

export function TimeField({
  value,
  isEditing,
  onChange,
  isComputed,
}: DateTimeFieldProps) {
  const shouldShowEditControls = isEditing && !isComputed

  if (!shouldShowEditControls) {
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

  return (
    <InputGroup>
      <InputGroupInput
        type="time"
        // step="1"
        value={value.split(':')[0] + ':' + value.split(':')[1]}
        onChange={(e) => onChange(e.target.value + ':00')}
        className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
      />
      <InputGroupAddon>
        <Clock2Icon className="text-muted-foreground" />
      </InputGroupAddon>
    </InputGroup>
  )
}

export function DateTimeField({
  value,
  isEditing,
  onChange,
  isComputed,
}: DateTimeFieldProps) {
  const shouldShowEditControls = isEditing && !isComputed
  const [date, setDate] = useState<Date | undefined>(
    value ? new Date(value) : undefined,
  )
  const [time, setTime] = useState<string>(
    value ? value.split('T')[1] : '00:00:00',
  )

  if (!shouldShowEditControls) {
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

  useEffect(() => {
    if (date) {
      const dateStr = format(date, 'yyyy-MM-dd')
      onChange(`${dateStr}T${time}`)
    }
  }, [date, time])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start text-left font-normal"
        >
          <CalendarIcon className="mr-1 h-3 w-3" />
          {value ? (
            <>
              {date ? format(date, 'PPP') : ''} at {time.split('+')[0]}
            </>
          ) : (
            <span>Pick date and time</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Card className="mx-auto w-fit">
          <CardContent>
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => setDate(d)}
              className="p-0"
            />
          </CardContent>
          <CardFooter className="bg-card border-t">
            <TimeField value={time} isEditing={isEditing} onChange={setTime} />
          </CardFooter>
        </Card>
      </PopoverContent>
    </Popover>
  )
}
