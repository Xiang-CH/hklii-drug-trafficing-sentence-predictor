import { BellRing, CalendarClock, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'

const reminderEvent = {
  id: 'migration-reminder-2026-04-13T19:05:00+08:00',
  title: 'System Migration Reminder',
  message:
    'Please save all progess before 7pm today!! ' +
    '\n\nThe system will migrate to a new URL between 7:00pm - 7:05pm.' +
    ' You will be redirected to the new Link automatically after that.',
  timestamp: '2026-04-13T19:05:00+08:00',
}

export default function VerificationNoticeToast() {
  const { data: session } = authClient.useSession()
  const [isMounted, setIsMounted] = useState(false)
  const reminderTimestamp = useMemo(
    () => new Date(reminderEvent.timestamp).getTime(),
    [],
  )
  const reminderStorageKey = useMemo(
    () => `verification-reminder-dismissed:${reminderEvent.id}`,
    [],
  )
  const formattedTimestamp = useMemo(() => {
    if (Number.isNaN(reminderTimestamp)) {
      return reminderEvent.timestamp
    }

    return new Intl.DateTimeFormat('en-HK', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(reminderTimestamp))
  }, [reminderTimestamp])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isMounted) {
      return
    }

    if (!session?.user || Number.isNaN(reminderTimestamp)) {
      toast.dismiss(reminderEvent.id)
      return
    }

    const now = Date.now()
    const isExpired = now >= reminderTimestamp
    const isDismissed =
      window.localStorage.getItem(reminderStorageKey) === 'true'

    if (isExpired || isDismissed) {
      toast.dismiss(reminderEvent.id)
      return
    }

    const dismissReminder = () => {
      window.localStorage.setItem(reminderStorageKey, 'true')
      toast.dismiss(reminderEvent.id)
    }

    toast.custom(
      (toastInstance) => (
        <div className="flex w-full max-w-3xl items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/95 p-4 text-amber-950 shadow-lg backdrop-blur">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <BellRing className="size-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="space-y-1">
              <p className="text-sm font-semibold tracking-tight">
                {reminderEvent.title}
              </p>
              <p className="text-sm leading-5 text-amber-900 whitespace-pre-line">
                {reminderEvent.message}
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
              <CalendarClock className="size-3.5" />
              <span>{formattedTimestamp}</span>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="shrink-0 text-amber-700 hover:bg-amber-100 hover:text-amber-900"
            onClick={() => {
              toast.dismiss(toastInstance)
              dismissReminder()
            }}
            aria-label="Dismiss reminder"
          >
            <X />
          </Button>
        </div>
      ),
      {
        id: reminderEvent.id,
        duration: Infinity,
        position: 'top-center',
      },
    )

    const expiryTimeout = window.setTimeout(() => {
      toast.dismiss(reminderEvent.id)
    }, reminderTimestamp - now)

    return () => {
      window.clearTimeout(expiryTimeout)
      toast.dismiss(reminderEvent.id)
    }
  }, [
    formattedTimestamp,
    isMounted,
    reminderStorageKey,
    reminderTimestamp,
    session?.user,
  ])

  return null
}
