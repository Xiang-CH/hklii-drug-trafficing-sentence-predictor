import { Link } from '@tanstack/react-router'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Save,
  Undo2,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { EditableDataSectionKey } from '@/components/edit-ui/editable-data-section'
import EditableDataViewer from '@/components/editable-data-viewer'
import HtmlViewer from '@/components/html-viewer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

type VerificationWorkspaceData = {
  judgement: any
  defendants: any
  trials: any
  remarks?: string
  exclude: boolean
}

type MutationState = {
  isPending: boolean
  mutate: () => void
}

interface VerificationWorkspaceProps {
  data: VerificationWorkspaceData
  defaultData: Partial<Record<EditableDataSectionKey, any>>
  htmlContent: string
  highlightedText: string | null
  onSourceHover: (text: string | null) => void
  onDataChange: (data: VerificationWorkspaceData, hasErrors: boolean) => void
  onRestoreDefault: (
    section: EditableDataSectionKey,
    nextData: VerificationWorkspaceData,
    nextNotGivenMap: Record<string, boolean>,
    hasErrors: boolean,
  ) => void
  onNotGivenChange: (notGivenMap: Record<string, boolean>) => void
  notGivenMap: Record<string, boolean>

  title?: string
  appeal?: string
  corrigendum?: string
  status: 'pending' | 'in_progress' | 'verified'
  hasUnsavedChanges: boolean
  hasValidationErrors: boolean
  saveAction: MutationState
  verifyAction: MutationState
  revertAction?: MutationState
  onBack: () => void
  extraInfo?: ReactNode
}

export default function VerificationWorkspace({
  data,
  defaultData,
  htmlContent,
  highlightedText,
  onSourceHover,
  onDataChange,
  onRestoreDefault,
  onNotGivenChange,
  notGivenMap,
  title,
  appeal,
  corrigendum,
  status,
  hasUnsavedChanges,
  hasValidationErrors,
  saveAction,
  verifyAction,
  revertAction,
  onBack,
  extraInfo,
}: VerificationWorkspaceProps) {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-gray-50 dark:bg-gray-900">
      <div className="border-b border-gray-200 px-4 py-1 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Separator className="h-6" orientation="vertical" />
            <div className="flex gap-2">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                {appeal && (
                  <>
                    <span>•</span>
                    <span>Appeal: {appeal}</span>
                  </>
                )}
                {corrigendum && (
                  <>
                    <span>•</span>
                    <span>Corrigendum</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {extraInfo}
            {status === 'verified' ? (
              <Badge className="bg-green-100 text-green-700">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Verified
              </Badge>
            ) : status === 'in_progress' ? (
              <Badge className="bg-amber-100 text-amber-700">In Progress</Badge>
            ) : (
              <Badge variant="outline">Pending</Badge>
            )}
            {hasUnsavedChanges && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                Unsaved Changes
              </Badge>
            )}
            {revertAction && (
              <Button
                onClick={() => revertAction.mutate()}
                disabled={revertAction.isPending}
                variant="outline"
                size="sm"
              >
                {revertAction.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Undo2 className="mr-1 h-4 w-4" />
                    Revert Verified
                  </>
                )}
              </Button>
            )}
            <Button
              onClick={() => saveAction.mutate()}
              disabled={saveAction.isPending || hasValidationErrors}
              variant="outline"
            >
              {saveAction.isPending ? (
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
              onClick={() => verifyAction.mutate()}
              disabled={
                verifyAction.isPending ||
                status === 'verified' ||
                !data.judgement ||
                hasValidationErrors
              }
              className="bg-green-600 hover:bg-green-700"
            >
              {verifyAction.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : status === 'verified' ? (
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

      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 overflow-y-auto bg-white dark:bg-gray-800">
          <div className="p-4">
            {!data.judgement ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <AlertCircle className="h-12 w-12 text-gray-400 mb-3" />
                <p className="text-gray-600 dark:text-gray-400">
                  No extracted data available
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  This judgement doesn&apos;t have extracted data yet.
                </p>
              </div>
            ) : (
              <EditableDataViewer
                data={data}
                defaultData={defaultData}
                onSourceHover={onSourceHover}
                onDataChange={onDataChange}
                onRestoreDefault={onRestoreDefault}
                onNotGivenChange={onNotGivenChange}
                notGivenMap={notGivenMap}
              />
            )}
          </div>
        </div>

        <div className="w-1/2 overflow-y-auto bg-white dark:bg-gray-800">
          {htmlContent ? (
            <HtmlViewer html={htmlContent} highlightedText={highlightedText} />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-600 dark:text-gray-400">
                No HTML content available
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
