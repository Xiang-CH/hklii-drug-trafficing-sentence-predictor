import { AlertCircle } from 'lucide-react'
import type { EditableDataSectionKey } from '@/components/edit-ui/editable-data-section'
import EditableDataViewer from '@/components/editable-data-viewer'
import HtmlViewer from '@/components/html-viewer'

type VerificationWorkspaceData = {
  judgement: any
  defendants: any
  trials: any
  remarks?: string
  exclude: boolean
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
}: VerificationWorkspaceProps) {
  return (
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
  )
}
