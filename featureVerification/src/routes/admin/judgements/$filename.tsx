import {
  Link,
  createFileRoute,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { JudgementDetail } from '@/routes/api/judgements/$filename'
import { requireAdminAuth } from '@/lib/auth-client'
import { useVerificationData } from '@/lib/verification-data'
import {
  adminMarkAsVerified,
  adminRevertToInProgress,
  adminSaveVerificationProgress,
} from '@/server/user-judgements'
import { Badge } from '@/components/ui/badge'
import VerificationWorkspace from '@/components/verification-workspace'
import HtmlViewer from '@/components/html-viewer'
import { cn } from '@/lib/utils'

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

  const {
    judgementData,
    defendantsData,
    trialsData,
    remarks,
    exclude,
    notGivenMap,
    setNotGivenMap,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    hasValidationErrors,
    handleDataChange,
    handleRestoreDefault,
    getCleanedData,
  } = useVerificationData(
    sourceData,
    data?.verifiedData?.remarks,
    data?.verifiedData?.exclude,
  )

  const extractedDefaults = data?.extractedData
    ? {
        judgement: data.extractedData.judgement,
        defendants: data.extractedData.defendants,
        trials: data.extractedData.trials,
      }
    : {}

  const saveMutation = useMutation({
    mutationFn: () =>
      adminSaveVerificationProgress({
        data: {
          judgementId: data?.id || '',
          extractedId: data?.extractedData?.extractedId,
          data: getCleanedData(),
          remarks,
          exclude,
        },
      }),
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
    mutationFn: () =>
      adminMarkAsVerified({
        data: {
          judgementId: data?.id || '',
          data: getCleanedData(),
          remarks,
          exclude,
        },
      }),
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
      <div
        className={cn(
          'flex gap-4 justify-end px-6 py-1',
          data.status === 'verified' ? 'bg-green-100' : 'bg-yellow-100',
        )}
      >
        <span className="text-sm">
          Assigned to:{' '}
          <Link
            className="underline"
            to="/admin/assignment"
            search={{
              username: data.assigneeUsername,
              assigned: 'assigned',
            }}
          >
            {data.assignee}
          </Link>
        </span>
        {data.verifiedData && data.verifiedData.isVerified && (
          <span className="text-sm">
            Verified by:{' '}
            <Link
              className="underline"
              to="/admin/assignment"
              search={{
                username: data.verifiedData.verifierUsername,
                assigned: 'assigned',
              }}
            >
              {data.verifiedData.verifiedBy}
            </Link>
          </span>
        )}
        {!data.verifiedData && (
          <Badge className="bg-muted text-muted-foreground">
            Unverified but Extracted
          </Badge>
        )}
      </div>
      {sourceData && (
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
          title={data.trial || data.filename}
          appeal={data.appeal}
          corrigendum={data.corrigendum}
          status={data.status}
          hasUnsavedChanges={hasUnsavedChanges}
          hasValidationErrors={hasValidationErrors}
          saveAction={saveMutation}
          verifyAction={verifyMutation}
          revertAction={data.status === 'verified' ? revertMutation : undefined}
          onBack={() => history.back()}
        />
      )}
    </div>
  )
}
