import { useEffect, useState } from 'react'
import { Edit2 } from 'lucide-react'
import { EditableDataSection, ValidationErrorsPanel } from './edit-ui'
import type * as z from 'zod'
import {
  DefendantsSchema,
  JudgementSchema,
  MANDATORY_NOT_GIVEN_FIELDS,
  TrialsSchema,
} from '@/lib/schema'

interface EditableDataViewerProps {
  data: {
    judgement: any
    defendants: any
    trials: any
    remarks?: string
    exclude: boolean
  }
  onSourceHover: (text: string | null) => void
  onDataChange?: (
    data: {
      judgement: any
      defendants: any
      trials: any
      remarks?: string
      exclude: boolean
    },
    hasErrors: boolean,
  ) => void
  onNotGivenChange: (notGivenMap: Record<string, boolean>) => void
  notGivenMap: Record<string, boolean>
}

export default function EditableDataViewer({
  data,
  onSourceHover,
  onDataChange,
  onNotGivenChange,
  notGivenMap,
}: EditableDataViewerProps) {
  const [localData, setLocalData] = useState(data)
  const [validationErrors, setValidationErrors] = useState<
    Record<string, Array<string>>
  >({})
  const [isEditing, setIsEditing] = useState(true)

  const handleToggleNotGiven = (path: string, next: boolean) => {
    const updated = { ...notGivenMap, [path]: next }
    onNotGivenChange(updated)
    // Pass the updated notGivenMap to validation
    const { errors } = validateData(localData, updated)
    if (isEditing) {
      setValidationErrors(errors)
    }
    if (Object.keys(errors).length === 0) {
      onDataChange?.(localData, false)
    } else {
      onDataChange?.(localData, true)
    }
  }

  // Update localData when prop changes
  useEffect(() => {
    setLocalData(data)
  }, [data])

  // Validate data against Zod schemas and return both errors and transformed data
  const validateData = (
    dataToValidate: typeof localData,
    overrideNotGivenMap?: Record<string, boolean>,
  ): {
    errors: Record<string, Array<string>>
    transformedData: typeof localData
  } => {
    const errors: Record<string, Array<string>> = {}
    const transformedData = { ...dataToValidate }
    const currentNotGivenMap = overrideNotGivenMap ?? notGivenMap

    // Zod schema validation
    if (dataToValidate.judgement) {
      const result = JudgementSchema.safeParse(dataToValidate.judgement)
      if (!result.success) {
        errors.judgement = result.error.issues.map(
          (issue: z.ZodIssue) => `${issue.path.join('.')}: ${issue.message}`,
        )
      } else {
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

    // Mandatory field validation
    const checkMandatoryFields = (
      data: any,
      basePath: string,
      section: string,
    ) => {
      if (!data || typeof data !== 'object') return
      for (const key of Object.keys(data)) {
        const currentPath = basePath ? `${basePath}.${key}` : key
        const value = data[key]

        if (MANDATORY_NOT_GIVEN_FIELDS.includes(key)) {
          // console.log("not given map", currentNotGivenMap)
          // console.log("current path", currentPath)

          const isNotGiven = currentNotGivenMap[currentPath]
          const hasValue =
            value !== null &&
            value !== undefined &&
            !(typeof value === 'object' && Object.keys(value).length === 0) &&
            !(Array.isArray(value) && value.length === 0)

          if (!hasValue && !isNotGiven) {
            // if (!errors[section]) errors[section] = []
            errors[section].push(`${key} is required, or mark as "Not Given"`)
          }
        }

        if (value && typeof value === 'object') {
          if (Array.isArray(value)) {
            value.forEach((item, index) => {
              checkMandatoryFields(item, `${currentPath}[${index}]`, section)
            })
          } else {
            checkMandatoryFields(value, currentPath, section)
          }
        }
      }
    }

    checkMandatoryFields(dataToValidate.judgement, 'judgement', 'judgement')
    checkMandatoryFields(dataToValidate.defendants, 'defendants', 'defendants')
    checkMandatoryFields(dataToValidate.trials, 'trials', 'trials')

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

    if (Object.keys(errors).length === 0) {
      onDataChange?.(transformedData, false)
    } else {
      onDataChange?.(transformedData, true)
    }
  }

  // Validate when entering edit mode
  const handleStartEditing = () => {
    setIsEditing(true)
    const { errors, transformedData } = validateData(localData)
    setLocalData(transformedData) // Update computed fields when entering edit mode
    setValidationErrors(errors)
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
          {!isEditing && (
            <button
              onClick={handleStartEditing}
              className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
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
          notGivenMap={notGivenMap}
          onToggleNotGiven={handleToggleNotGiven}
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
          notGivenMap={notGivenMap}
          onToggleNotGiven={handleToggleNotGiven}
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
          notGivenMap={notGivenMap}
          onToggleNotGiven={handleToggleNotGiven}
        />
      )}
      <div className="flex items-center gap-2">
        <span className="font-semibold">Exclude from training: </span>
        <input
          type="checkbox"
          checked={localData.exclude}
          onChange={(e) =>
            handleDataChange({ ...localData, exclude: e.target.checked })
          }
          disabled={!isEditing}
        />
      </div>
      <p className="font-semibold">Remarks:</p>
      <textarea
        className="w-[98%] ml-2 p-2 border border-gray-300 dark:border-gray-700 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
        value={localData.remarks || ''}
        onChange={(e) =>
          handleDataChange({ ...localData, remarks: e.target.value })
        }
        disabled={!isEditing}
        placeholder="Add any remarks or notes about this case here..."
      />
    </div>
  )
}
