import {
  Link,
  createFileRoute,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import VerificationWorkspace from '@/components/verification-workspace'
import {
  getJudgementForVerification,
  markAsVerified,
  revertToInProgress,
  saveVerificationProgress,
} from '@/server/user-judgements'
import { useVerificationData } from '@/lib/verification-data'

export const Route = createFileRoute('/verify/$filename')({
  component: VerifyJudgementPage,
  loader: async ({ params }) => {
    return await getJudgementForVerification({ data: params.filename })
  },
})

function VerifyJudgementPage() {
  const { filename } = Route.useParams()
  const navigate = useNavigate()
  const { history } = useRouter()
  const queryClient = useQueryClient()
  const [highlightedText, setHighlightedText] = useState<string | null>(null)

  const initial = Route.useLoaderData()
  const { data: judgement, error } = useQuery({
    queryKey: ['judgement-verification', filename],
    initialData: initial,
    queryFn: () => getJudgementForVerification({ data: filename }),
  })

  const sourceData = useMemo(
    () => judgement.verifiedData || judgement.extractedData,
    [judgement.verifiedData, judgement.extractedData],
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
    judgement.verifiedData?.remarks,
    judgement.verifiedData?.exclude,
  )

  const extractedDefaults = judgement.extractedData
    ? {
        judgement: judgement.extractedData.judgement,
        defendants: judgement.extractedData.defendants,
        trials: judgement.extractedData.trials,
      }
    : {}

  const saveMutation = useMutation({
    mutationFn: () =>
      saveVerificationProgress({
        data: {
          judgementId: judgement.id || '',
          extractedId: judgement.extractedData?.extractedId,
          data: getCleanedData(),
          remarks,
          exclude,
        },
      }),
    onSuccess: (result) => {
      toast.success(result.message)
      setHasUnsavedChanges(false)
      queryClient.invalidateQueries({ queryKey: ['user-stats'] })
      queryClient.invalidateQueries({ queryKey: ['user-judgements'] })
      queryClient.invalidateQueries({
        queryKey: ['judgement-verification', filename],
      })
    },
    onError: (err) => {
      toast.error('Failed to save progress', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    },
  })

  const verifyMutation = useMutation({
    mutationFn: () =>
      markAsVerified({
        data: {
          judgementId: judgement.id || '',
          data: getCleanedData(),
          remarks,
          exclude,
        },
      }),
    onSuccess: (result) => {
      toast.success(result.message)
      queryClient.invalidateQueries({ queryKey: ['user-stats'] })
      queryClient.invalidateQueries({ queryKey: ['user-judgements'] })
      queryClient.invalidateQueries({
        queryKey: ['judgement-verification', filename],
      })
      navigate({ to: '/' })
    },
    onError: (err) => {
      toast.error('Failed to verify', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    },
  })

  const revertMutation = useMutation({
    mutationFn: () =>
      revertToInProgress({ data: { judgementId: judgement.id || '' } }),
    onSuccess: (result) => {
      toast.success(result.message)
      queryClient.invalidateQueries({ queryKey: ['user-stats'] })
      queryClient.invalidateQueries({ queryKey: ['user-judgements'] })
      queryClient.invalidateQueries({
        queryKey: ['judgement-verification', filename],
      })
    },
    onError: (err) => {
      toast.error('Failed to revert', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    },
  })

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-6 w-6" />
              Error Loading Judgement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              {error instanceof Error
                ? error.message
                : 'Failed to load judgement data'}
            </p>
            <Link to="/">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const htmlContent = `${judgement.appeal_html || ''} \n\n ${judgement.html} \n\n ${judgement.corrigendum_html || ''}`

  return (
    <VerificationWorkspace
      data={{
        judgement: judgementData,
        defendants: defendantsData,
        trials: trialsData,
        exclude,
        remarks,
      }}
      defaultData={extractedDefaults}
      htmlContent={htmlContent}
      highlightedText={highlightedText}
      onSourceHover={setHighlightedText}
      onDataChange={handleDataChange}
      onRestoreDefault={handleRestoreDefault}
      onNotGivenChange={setNotGivenMap}
      notGivenMap={notGivenMap}
      title={judgement.trial || judgement.filename}
      appeal={judgement.appeal}
      corrigendum={judgement.corrigendum}
      status={judgement.status}
      hasUnsavedChanges={hasUnsavedChanges}
      hasValidationErrors={hasValidationErrors}
      saveAction={saveMutation}
      verifyAction={verifyMutation}
      revertAction={
        judgement.status === 'verified' ? revertMutation : undefined
      }
      onBack={() => history.back()}
    />
  )
}
