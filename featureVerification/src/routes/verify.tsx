import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import EditableDataViewer from '../components/EditableDataViewer'
import HtmlViewer from '../components/HtmlViewer'

export const Route = createFileRoute('/verify')({
  component: VerifyPage,
})

function VerifyPage() {
  const [judgementData, setJudgementData] = useState<any>(null)
  const [defendantsData, setDefendantsData] = useState<any>(null)
  const [trialsData, setTrialsData] = useState<any>(null)
  const [htmlContent, setHtmlContent] = useState<string>('')
  const [highlightedText, setHighlightedText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [judgement, defendants, trials, html] = await Promise.all([
          fetch('/data/judgement.json').then((r) => r.json()),
          fetch('/data/defendants.json').then((r) => r.json()),
          fetch('/data/trials.json').then((r) => r.json()),
          fetch('/data/judgement.htm').then((r) => r.text()),
        ])

        setJudgementData(judgement)
        setDefendantsData(defendants)
        setTrialsData(trials)
        setHtmlContent(html)
        setLoading(false)
      } catch (error) {
        console.error('Error loading data:', error)
        setLoading(false)
      }
    }

    loadData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-400">Loading data...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Left Panel - Extracted Data */}
      <div className="w-1/2 border-r border-gray-300 dark:border-gray-700 overflow-y-auto">
        <div className="p-4">
          <EditableDataViewer
            data={{
              judgement: judgementData,
              defendants: defendantsData,
              trials: trialsData,
            }}
            onSourceHover={setHighlightedText}
            onDataChange={(newData) => {
              setJudgementData(newData.judgement)
              setDefendantsData(newData.defendants)
              setTrialsData(newData.trials)
            }}
          />
        </div>
      </div>

      {/* Right Panel - Original HTML */}
      <div className="w-1/2 overflow-y-auto bg-white dark:bg-gray-800">
        <HtmlViewer html={htmlContent} highlightedText={highlightedText} />
      </div>
    </div>
  )
}
