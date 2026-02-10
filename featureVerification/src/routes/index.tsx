import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  FileText,
  Loader2,
} from 'lucide-react'
import type { UserJudgement } from '@/server/user-judgements'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getUserAssignedJudgements } from '@/server/user-judgements'
import { authClient } from '@/lib/auth-client'

export const Route = createFileRoute('/')({
  component: UserDashboard,
  loader: async ({ context }) => {
    // Prefetch data on server
    const queryClient = context.queryClient

    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ['user-judgements'],
        queryFn: () => getUserAssignedJudgements(),
      }),
    ])
  },
})

function UserDashboard() {
  const { data: session } = authClient.useSession()

  const { data: judgements, isLoading: judgementsLoading } = useQuery({
    queryKey: ['user-judgements'],
    queryFn: () => getUserAssignedJudgements(),
  })

  if (!session?.user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Welcome</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              Please sign in to view your verification dashboard
            </p>
            <div className="flex justify-center">
              <Link to="/login" search={{ redirect: '/' }}>
                <Button>Sign In</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const pendingJudgements =
    judgements?.filter((j) => j.status === 'pending') ?? []
  const inProgressJudgements =
    judgements?.filter((j) => j.status === 'in_progress') ?? []
  const verifiedJudgements =
    judgements?.filter((j) => j.status === 'verified') ?? []

  return (
    <div>
      {/* Header Section */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome, {session.user.name}
          </h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pending & In Progress Column */}
          <div className="space-y-6">
            {/* Pending Section */}
            <Card className="gap-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Circle className="h-5 w-5 text-gray-500" />
                  Pending Verification
                  <Badge variant="secondary">
                    {pendingJudgements.length + inProgressJudgements.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {judgementsLoading ? (
                  <div className="flex items-center justify-center h-[200px]">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : pendingJudgements.length === 0 &&
                  inProgressJudgements.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[200px] text-center">
                    <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
                    <p className="text-gray-600 dark:text-gray-400">
                      No pending judgements!
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      You've completed all your assigned verifications.
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-[calc(100vh-19rem)] pr-2">
                    <div className="space-y-2">
                      {inProgressJudgements.map((judgement) => (
                        <JudgementCard
                          key={judgement.id}
                          judgement={judgement}
                          status="in_progress"
                        />
                      ))}
                      {pendingJudgements.map((judgement) => (
                        <JudgementCard
                          key={judgement.id}
                          judgement={judgement}
                          status="pending"
                        />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Verified Column */}
          <div>
            <Card className="gap-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Verified Judgements
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-700"
                  >
                    {verifiedJudgements.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {judgementsLoading ? (
                  <div className="flex items-center justify-center h-[200px]">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : verifiedJudgements.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[200px] text-center">
                    <AlertCircle className="h-12 w-12 text-gray-400 mb-3" />
                    <p className="text-gray-600 dark:text-gray-400">
                      No verified judgements yet
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      Start verifying to see your completed work here.
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-[calc(100vh-19rem)] pr-2">
                    <div className="space-y-2">
                      {verifiedJudgements.map((judgement) => (
                        <JudgementCard
                          key={judgement.id}
                          judgement={judgement}
                          status="verified"
                        />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

function JudgementCard({
  judgement,
  status,
}: {
  judgement: UserJudgement
  status: 'pending' | 'in_progress' | 'verified'
}) {
  const statusConfig = {
    pending: {
      badge: <Badge variant="outline">Pending</Badge>,
      buttonText: 'Start Verification',
      buttonVariant: 'default' as const,
    },
    in_progress: {
      badge: (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
          In Progress
        </Badge>
      ),
      buttonText: 'Continue',
      buttonVariant: 'default' as const,
    },
    verified: {
      badge: (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
          Verified
        </Badge>
      ),
      buttonText: 'Review',
      buttonVariant: 'outline' as const,
    },
  }

  const config = statusConfig[status]

  return (
    <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
      <div className="flex-1 min-w-0 mr-4">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <p className="font-medium text-gray-900 dark:text-white truncate">
            {judgement.trial || judgement.filename}
          </p>
        </div>
        <div className="ml-1 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 text-xs">
          {judgement.appeal && <span>Appeal: {judgement.appeal}</span>}
          {judgement.corrigendum && <span>Corrigendum</span>}
        </div>
        {judgement.verifiedAt && (
          <p className="text-xs text-gray-400 mt-1">
            Verified: {new Date(judgement.verifiedAt).toLocaleDateString()}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {config.badge}
        <Link to="/verify/$filename" params={{ filename: judgement.filename }}>
          <Button size="sm" variant={config.buttonVariant}>
            {config.buttonText}
          </Button>
        </Link>
      </div>
    </div>
  )
}
