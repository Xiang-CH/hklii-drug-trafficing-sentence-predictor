import {
  Link,
  createFileRoute,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, Loader2, Save, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { EditableDataSectionKey } from '@/components/edit-ui/editable-data-section'
import type { JudgementDetail } from '@/routes/api/judgements/$filename'
import { requireAdminAuth } from '@/lib/auth-client'
import {
  applyNotGivenToPayload,
  deriveNotGivenMapFromPayload,
} from '@/lib/not-given'
import {
  adminMarkAsVerified,
  adminRevertToInProgress,
  adminSaveVerificationProgress,
} from '@/server/user-judgements'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import VerificationWorkspace from '@/components/verification-workspace'
import HtmlViewer from '@/components/html-viewer'

async function getJudgement(filename: string): Promise<JudgementDetail> {
  const response = await fetch(`/api/judgements/${filename}`)
  if (response.status === 401) {
    throw redirect({
      to: '/login',
      search: { redirect: `/admin/judgements/${filename}` },
    })
  }
  if (!response.ok) {
    throw new Error('Failed to load judgement')
  }
  return (await response.json()) as JudgementDetail
}

export const Route = createFileRoute('/admin/judgements/$filename')({
  ssr: false,
  component: JudgementDetailComponent,
  beforeLoad: async ({ location }) => {
    await requireAdminAuth(location.href)
  },
})

function JudgementDetailComponent() {
  const { filename } = Route.useParams()
  const [highlightedText, setHighlightedText] = useState<string | null>(null)
  const [judgementData, setJudgementData] = useState<any>(null)
  const [defendantsData, setDefendantsData] = useState<any>(null)
  const [trialsData, setTrialsData] = useState<any>(null)
  const [remarks, setRemarks] = useState<string>('')
  const [exclude, setExclude] = useState<boolean>(false)
  const [notGivenMap, setNotGivenMap] = useState<Record<string, boolean>>({})
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [hasValidationErrors, setHasValidationErrors] = useState(false)
  const lastSyncedRef = useRef<{
    judgement: any
    defendants: any
    trials: any
    remarks: string
    exclude: boolean
  } | null>(null)
  const { history } = useRouter()
  const queryClient = useQueryClient()

  const { data, isPending } = useQuery({
    queryKey: ['judgement', filename],
    queryFn: () => getJudgement(filename),
    gcTime: 0,
  })

  const sourceData = useMemo(
    () => data?.verifiedData || data?.extractedData,
    [data?.verifiedData, data?.extractedData],
  )

  useEffect(() => {
    if (!sourceData) {
      return
    }

    setJudgementData(sourceData.judgement)
    setDefendantsData(sourceData.defendants)
    setTrialsData(sourceData.trials)
    setRemarks(data?.verifiedData?.remarks ?? '')
    setExclude(data?.verifiedData?.exclude ?? false)
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
      remarks: data?.verifiedData?.remarks ?? '',
      exclude: data?.verifiedData?.exclude ?? false,
    }
    setHasUnsavedChanges(false)
  }, [data?.verifiedData?.exclude, data?.verifiedData?.remarks, sourceData])

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
      remarks !== lastSyncedRef.current.remarks ||
      exclude !== lastSyncedRef.current.exclude
    setHasUnsavedChanges(hasChanges)
  }, [judgementData, defendantsData, trialsData, remarks, exclude])

  const extractedDefaults = data?.extractedData
    ? {
        judgement: data.extractedData.judgement,
        defendants: data.extractedData.defendants,
        trials: data.extractedData.trials,
      }
    : {}

  const saveMutation = useMutation({
    mutationFn: () => {
      const cleaned = applyNotGivenToPayload(
        {
          judgement: judgementData,
          defendants: defendantsData,
          trials: trialsData,
        },
        notGivenMap,
      )

      return adminSaveVerificationProgress({
        data: {
          judgementId: data?.id || '',
          extractedId: data?.extractedData?.extractedId,
          data: cleaned,
          remarks,
          exclude,
        },
      })
    },
    onSuccess: (result) => {
      toast.success(result.message)
      setHasUnsavedChanges(false)
      queryClient.invalidateQueries({ queryKey: ['judgement', filename] })
    },
    onError: (err) => {
      toast.error('Failed to save progress', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    },
  })

  const verifyMutation = useMutation({
    mutationFn: () => {
      const cleaned = applyNotGivenToPayload(
        {
          judgement: judgementData,
          defendants: defendantsData,
          trials: trialsData,
        },
        notGivenMap,
      )
      return adminMarkAsVerified({
        data: {
          judgementId: data?.id || '',
          data: cleaned,
          remarks,
          exclude,
        },
      })
    },
    onSuccess: (result) => {
      toast.success(result.message)
      queryClient.invalidateQueries({ queryKey: ['judgement', filename] })
    },
    onError: (err) => {
      toast.error('Failed to verify', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    },
  })

  const revertMutation = useMutation({
    mutationFn: () =>
      adminRevertToInProgress({ data: { judgementId: data?.id || '' } }),
    onSuccess: (result) => {
      toast.success(result.message)
      queryClient.invalidateQueries({ queryKey: ['judgement', filename] })
    },
    onError: (err) => {
      toast.error('Failed to revert', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    },
  })

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
    setRemarks(newData.remarks || '')
    setExclude(newData.exclude)
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

  const htmlContent = `${data?.appeal_html || ''}\n\n${data?.trial_html || ''}\n\n${data?.corrigendum_html || ''}`

  if (isPending || !data) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center text-muted-foreground">
        Loading judgement...
      </div>
    )
  }

  if (!data.extractedData) {
    return (
      <div className="container mb-4 max-w-6xl p-6 mx-auto">
        {data.appeal_html && (
          <HtmlViewer html={data.appeal_html} highlightedText={null} />
        )}
        {data.corrigendum_html && (
          <HtmlViewer html={data.corrigendum_html} highlightedText={null} />
        )}
        <HtmlViewer html={data.trial_html} highlightedText={null} />
      </div>
    )
  }

  return (
    <div className="w-full">
      {sourceData && (
        <div className="flex h-[calc(100vh-4rem)] flex-col bg-gray-50 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-4 py-1 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  to=".."
                  onClick={(e) => {
                    e.preventDefault
                    history.back()
                  }}
                >
                  <Button size="sm" variant="ghost">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                </Link>
                <Separator className="h-6" orientation="vertical" />
                <div className="flex gap-2">
                  <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {data.trial || data.filename}
                  </h1>
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    {data.appeal && (
                      <>
                        <span>•</span>
                        <span>Appeal: {data.appeal}</span>
                      </>
                    )}
                    {data.corrigendum && (
                      <>
                        <span>•</span>
                        <span>Corrigendum</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span>
                  Assigned to:{' '}
                  <Link
                    className="underline"
                    to={`/admin/assignment`}
                    search={{
                      username: data.assigneeUsername,
                      assigned: 'assigned',
                    }}
                  >
                    {data.assignee}
                  </Link>
                </span>
                {data.verifiedData && data.verifiedData.isVerified && (
                  <>
                    <span>
                      Verified by:{' '}
                      <Link
                        className="underline"
                        to={`/admin/assignment`}
                        search={{
                          username: data.verifiedData.verifierUsername,
                          assigned: 'assigned',
                        }}
                      >
                        {data.verifiedData.verifiedBy}
                      </Link>
                    </span>
                  </>
                )}
                {data.status === 'in_progress' && data.verifiedData && (
                  <Badge className="bg-yellow-100 text-yellow-700">
                    Verification In Progress
                  </Badge>
                )}
                {!data.verifiedData && (
                  <Badge className="bg-muted text-muted-foreground">
                    Unverified but Extracted
                  </Badge>
                )}
                {hasUnsavedChanges && (
                  <Badge
                    variant="secondary"
                    className="bg-blue-100 text-blue-700"
                  >
                    Unsaved Changes
                  </Badge>
                )}
                {data.status === 'verified' ? (
                  <Button
                    onClick={() => revertMutation.mutate()}
                    disabled={revertMutation.isPending}
                    variant="outline"
                    size="sm"
                  >
                    {revertMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Undo2 className="mr-1 h-4 w-4" />
                        Revert Verified
                      </>
                    )}
                  </Button>
                ) : null}
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={
                    saveMutation.isPending ||
                    hasValidationErrors ||
                    !hasUnsavedChanges
                  }
                  variant="outline"
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Progress
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => verifyMutation.mutate()}
                  disabled={
                    verifyMutation.isPending ||
                    data.status === 'verified' ||
                    !judgementData ||
                    hasValidationErrors
                  }
                  className="bg-green-600 hover:bg-green-700"
                >
                  {verifyMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : data.status === 'verified' ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Verified
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Mark as Verified
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <VerificationWorkspace
            data={{
              judgement: judgementData,
              defendants: defendantsData,
              trials: trialsData,
              remarks,
              exclude,
            }}
            defaultData={extractedDefaults}
            htmlContent={htmlContent}
            highlightedText={highlightedText}
            onSourceHover={setHighlightedText}
            onDataChange={handleDataChange}
            onRestoreDefault={handleRestoreDefault}
            onNotGivenChange={setNotGivenMap}
            notGivenMap={notGivenMap}
          />
        </div>
      )}
    </div>
  )
}
