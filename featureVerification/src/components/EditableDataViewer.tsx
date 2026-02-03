import { useEffect, useState } from 'react'
import { Edit2, Save } from 'lucide-react'
import { DefendantsSchema, JudgementSchema, TrialsSchema } from '../lib/schema'
import { EditableDataSection, ValidationErrorsPanel } from './edit-ui'
import type * as z from 'zod'

interface EditableDataViewerProps {
  data: {
    judgement: any
    defendants: any
    trials: any
  }
  onSourceHover: (text: string | null) => void
  onDataChange?: (data: {
    judgement: any
    defendants: any
    trials: any
  }) => void
}

export default function EditableDataViewer({
  data,
  onSourceHover,
  onDataChange,
}: EditableDataViewerProps) {
  const [localData, setLocalData] = useState(data)
  const [validationErrors, setValidationErrors] = useState<
    Record<string, Array<string>>
  >({})
  const [isEditing, setIsEditing] = useState(false)

  // Update localData when prop changes
  useEffect(() => {
    setLocalData(data)
  }, [data])

  // Validate data against Zod schemas and return both errors and transformed data
  const validateData = (
    dataToValidate: typeof localData,
  ): {
    errors: Record<string, Array<string>>
    transformedData: typeof localData
  } => {
    const errors: Record<string, Array<string>> = {}
    const transformedData = { ...dataToValidate }

    if (dataToValidate.judgement) {
      const result = JudgementSchema.safeParse(dataToValidate.judgement)
      if (!result.success) {
        errors.judgement = result.error.issues.map(
          (issue: z.ZodIssue) => `${issue.path.join('.')}: ${issue.message}`,
        )
      } else {
        // Update with transformed data (includes computed fields)
        transformedData.judgement = result.data
      }
    }

    if (dataToValidate.defendants) {
      const result = DefendantsSchema.safeParse(dataToValidate.defendants)
      if (!result.success) {
        errors.defendants = result.error.issues.map(
          (issue: z.ZodIssue) => `${issue.path.join('.')}: ${issue.message}`,
        )
      } else {
        transformedData.defendants = result.data
      }
    }

    if (dataToValidate.trials) {
      const result = TrialsSchema.safeParse(dataToValidate.trials)
      if (!result.success) {
        errors.trials = result.error.issues.map(
          (issue: z.ZodIssue) => `${issue.path.join('.')}: ${issue.message}`,
        )
      } else {
        transformedData.trials = result.data
      }
    }

    return { errors, transformedData }
  }

  // Handle data changes with real-time validation
  const handleDataChange = (newData: typeof localData) => {
    const { errors, transformedData } = validateData(newData)

    // Update with transformed data (includes computed fields)
    setLocalData(transformedData)

    // Real-time validation when editing
    if (isEditing) {
      setValidationErrors(errors)
    }
  }

  // Validate when entering edit mode
  const handleStartEditing = () => {
    setIsEditing(true)
    const { errors, transformedData } = validateData(localData)
    setLocalData(transformedData) // Update computed fields when entering edit mode
    setValidationErrors(errors)
  }

  const handleSave = () => {
    // Final validation before saving (though real-time validation is already running)
    const { errors, transformedData } = validateData(localData)
    setValidationErrors(errors)

    if (onDataChange) {
      // Save the transformed data with updated computed fields
      onDataChange(transformedData)
    }
    setIsEditing(false)
    // Optionally save to localStorage or download as JSON
    const jsonStr = JSON.stringify(transformedData, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'updated-data.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Data Editor
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            * = computed field (auto-updated)
          </p>
        </div>
        <div className="flex gap-2">
          {!isEditing ? (
            <button
              onClick={handleStartEditing}
              className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setLocalData(data)
                  setValidationErrors({})
                  setIsEditing(false)
                }}
                className="px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded text-sm flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </>
          )}
        </div>
      </div>

      {/* Display validation errors */}
      <ValidationErrorsPanel validationErrors={validationErrors} />

      {localData.judgement && (
        <EditableDataSection
          title="Judgement"
          data={localData.judgement}
          onSourceHover={onSourceHover}
          isEditing={isEditing}
          onChange={(newData) =>
            handleDataChange({ ...localData, judgement: newData })
          }
        />
      )}
      {localData.defendants && (
        <EditableDataSection
          title="Defendants"
          data={localData.defendants}
          onSourceHover={onSourceHover}
          isEditing={isEditing}
          onChange={(newData) =>
            handleDataChange({ ...localData, defendants: newData })
          }
        />
      )}
      {localData.trials && (
        <EditableDataSection
          title="Trials"
          data={localData.trials}
          onSourceHover={onSourceHover}
          isEditing={isEditing}
          onChange={(newData) =>
            handleDataChange({ ...localData, trials: newData })
          }
        />
      )}
    </div>
  )
}
