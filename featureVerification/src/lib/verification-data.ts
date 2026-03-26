import { useEffect, useRef, useState } from 'react'
import type { EditableDataSectionKey } from '@/components/edit-ui/editable-data-section'
import {
  applyNotGivenToPayload,
  deriveNotGivenMapFromPayload,
} from '@/lib/not-given'

type SourceData = {
  judgement: any
  defendants: any
  trials: any
}

type SyncedState = {
  judgement: any
  defendants: any
  trials: any
  remarks: string
  exclude: boolean
}

export function useVerificationData(
  sourceData: SourceData | null | undefined,
  remarks: string | undefined,
  exclude: boolean | undefined,
) {
  const [judgementData, setJudgementData] = useState<any>(null)
  const [defendantsData, setDefendantsData] = useState<any>(null)
  const [trialsData, setTrialsData] = useState<any>(null)
  const [localRemarks, setLocalRemarks] = useState<string>('')
  const [localExclude, setLocalExclude] = useState<boolean>(false)
  const [notGivenMap, setNotGivenMap] = useState<Record<string, boolean>>({})
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [hasValidationErrors, setHasValidationErrors] = useState(false)
  const lastSyncedRef = useRef<SyncedState | null>(null)

  useEffect(() => {
    if (!sourceData) {
      return
    }

    setJudgementData(sourceData.judgement)
    setDefendantsData(sourceData.defendants)
    setTrialsData(sourceData.trials)
    setLocalRemarks(remarks ?? '')
    setLocalExclude(exclude ?? false)
    setNotGivenMap(
      deriveNotGivenMapFromPayload({
        judgement: sourceData.judgement,
        defendants: sourceData.defendants,
        trials: sourceData.trials,
      }),
    )
    lastSyncedRef.current = {
      judgement: sourceData.judgement,
      defendants: sourceData.defendants,
      trials: sourceData.trials,
      remarks: remarks ?? '',
      exclude: exclude ?? false,
    }
    setHasUnsavedChanges(false)
  }, [sourceData, remarks, exclude])

  useEffect(() => {
    if (!lastSyncedRef.current) {
      return
    }
    const hasChanges =
      JSON.stringify(judgementData) !==
        JSON.stringify(lastSyncedRef.current.judgement) ||
      JSON.stringify(defendantsData) !==
        JSON.stringify(lastSyncedRef.current.defendants) ||
      JSON.stringify(trialsData) !==
        JSON.stringify(lastSyncedRef.current.trials) ||
      localRemarks !== lastSyncedRef.current.remarks ||
      localExclude !== lastSyncedRef.current.exclude
    setHasUnsavedChanges(hasChanges)
  }, [judgementData, defendantsData, trialsData, localRemarks, localExclude])

  const handleDataChange = (
    newData: {
      judgement: any
      defendants: any
      trials: any
      remarks?: string
      exclude: boolean
    },
    hasErrors: boolean,
  ) => {
    setHasValidationErrors(hasErrors)
    setJudgementData(newData.judgement)
    setDefendantsData(newData.defendants)
    setTrialsData(newData.trials)
    setLocalRemarks(newData.remarks || '')
    setLocalExclude(newData.exclude)
  }

  const handleRestoreDefault = (
    _section: EditableDataSectionKey,
    newData: {
      judgement: any
      defendants: any
      trials: any
      remarks?: string
      exclude: boolean
    },
    nextNotGivenMap: Record<string, boolean>,
    hasErrors: boolean,
  ) => {
    setNotGivenMap(nextNotGivenMap)
    handleDataChange(newData, hasErrors)
  }

  const getCleanedData = () =>
    applyNotGivenToPayload(
      {
        judgement: judgementData,
        defendants: defendantsData,
        trials: trialsData,
      },
      notGivenMap,
    )

  return {
    judgementData,
    defendantsData,
    trialsData,
    remarks: localRemarks,
    exclude: localExclude,
    notGivenMap,
    setNotGivenMap,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    hasValidationErrors,
    setHasValidationErrors,
    handleDataChange,
    handleRestoreDefault,
    getCleanedData,
  }
}
