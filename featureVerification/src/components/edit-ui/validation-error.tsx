export function ValidationErrorsPanel({
  validationErrors,
}: {
  validationErrors: Record<string, Array<string>>
}) {
  if (Object.keys(validationErrors).length === 0) {
    return null
  }

  return (
    <div className="p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg sticky top-0 z-100">
      <h3 className="text-red-700 dark:text-red-300 font-medium mb-2 flex flex-col gap-2">
        Validation Errors
      </h3>
      {Object.entries(validationErrors).map(([section, errors]) => (
        <div key={section}>
          <span className="font-medium text-red-600 dark:text-red-400">
            {section}:
          </span>
          <ul className="ml-4 text-sm text-red-600 dark:text-red-400">
            {errors.map((error, idx) => (
              <li key={idx}>• {error}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
