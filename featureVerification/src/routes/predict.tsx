import { createFileRoute } from '@tanstack/react-router'
import PredictionCalculator from '@/components/prediction-calculator'

export const Route = createFileRoute('/predict')({
  component: PredictionCalculator,
})
