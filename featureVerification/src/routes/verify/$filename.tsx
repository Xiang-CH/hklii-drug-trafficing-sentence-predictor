import {
  Link,
  createFileRoute,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Save,
  Undo2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { EditableDataSectionKey } from '@/components/edit-ui/editable-data-section'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import VerificationWorkspace from '@/components/verification-workspace'
import {
  getJudgementForVerification,
  markAsVerified,
  revertToInProgress,
  saveVerificationProgress,
} from '@/server/user-judgements'
import {
  applyNotGivenToPayload,
  deriveNotGivenMapFromPayload,
} from '@/lib/not-given'

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

  const [judgementData, setJudgementData] = useState<any>(null)
  const [defendantsData, setDefendantsData] = useState<any>(null)
  const [trialsData, setTrialsData] = useState<any>(null)
  const [remarks, setRemarks] = useState<string>('')
  const [exclude, setExclude] = useState<boolean>(false)

  const [highlightedText, setHighlightedText] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [hasValidationErrors, setHasValidationErrors] = useState(false)

  const [notGivenMap, setNotGivenMap] = useState<Record<string, boolean>>({})

  const initial = Route.useLoaderData()
  const { data: judgement, error } = useQuery({
    queryKey: ['judgement-verification', filename],
    initialData: initial,
    queryFn: () => getJudgementForVerification({ data: filename }),
  })

  // Initialize data from judgement
  useEffect(() => {
    const sourceData = judgement.verifiedData || judgement.extractedData
    if (sourceData) {
      setJudgementData(sourceData.judgement)
      setDefendantsData(sourceData.defendants)
      setTrialsData(sourceData.trials)
      setRemarks(judgement.verifiedData?.remarks ?? '')
      setExclude(judgement.verifiedData?.exclude ?? false)
      setNotGivenMap(
        deriveNotGivenMapFromPayload({
          judgement: sourceData.judgement,
          defendants: sourceData.defendants,
          trials: sourceData.trials,
        }),
      )
    }
  }, [judgement])

  const extractedDefaults = judgement.extractedData
    ? {
        judgement: judgement.extractedData.judgement,
        defendants: judgement.extractedData.defendants,
        trials: judgement.extractedData.trials,
      }
    : {}

  // Track unsaved changes
  useEffect(() => {
    const sourceData = judgement.verifiedData || judgement.extractedData
    if (sourceData) {
      const hasChanges =
        JSON.stringify(judgementData) !==
          JSON.stringify(sourceData.judgement) ||
        JSON.stringify(defendantsData) !==
          JSON.stringify(sourceData.defendants) ||
        JSON.stringify(trialsData) !== JSON.stringify(sourceData.trials)
      // TODO: No unsaved notification for Not Given Checkbox
      // Object.values(notGivenMap).some(Boolean)
      setHasUnsavedChanges(hasChanges)
    }
  }, [judgementData, defendantsData, trialsData, judgement, notGivenMap])

  // Save progress mutation
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

      return saveVerificationProgress({
        data: {
          judgementId: judgement.id || '',
          extractedId: judgement.extractedData?.extractedId,
          data: cleaned,
          remarks,
          exclude,
        },
      })
    },
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

  // Mark as verified mutation
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
      return markAsVerified({
        data: {
          judgementId: judgement.id || '',
          data: cleaned,
          remarks,
          exclude,
        },
      })
    },
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

  // Revert to in progress mutation
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

  // Handle data changes
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
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900">
      {/* Top Bar */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              onClick={(e) => {
                e.preventDefault
                history.back()
              }}
            >
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex gap-2">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                {judgement.trial || judgement.filename}
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                {judgement.appeal && (
                  <>
                    <span>•</span>
                    <span>Appeal: {judgement.appeal}</span>
                  </>
                )}
                {judgement.corrigendum && (
                  <>
                    <span>•</span>
                    <span>Corrigendum</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {judgement.status === 'verified' ? (
              <>
                <Badge className="bg-green-100 text-green-700">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
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
                      <Undo2 className="h-4 w-4 mr-1" />
                      Revert Verified
                    </>
                  )}
                </Button>
              </>
            ) : judgement.status === 'in_progress' ? (
              <Badge className="bg-amber-100 text-amber-700">In Progress</Badge>
            ) : (
              <Badge variant="outline">Pending</Badge>
            )}
            {hasUnsavedChanges && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                Unsaved Changes
              </Badge>
            )}

            {/* Save Progress Button */}
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || hasValidationErrors}
              variant="outline"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Progress
                </>
              )}
            </Button>

            {/* Mark as Verified Button */}
            <Button
              onClick={() => verifyMutation.mutate()}
              disabled={
                verifyMutation.isPending ||
                judgement.status === 'verified' ||
                !judgementData ||
                hasValidationErrors
              }
              className="bg-green-600 hover:bg-green-700"
            >
              {verifyMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : judgement.status === 'verified' ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Verified
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark as Verified
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
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
      />
    </div>
  )
}
