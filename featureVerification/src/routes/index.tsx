import { Link, createFileRoute } from '@tanstack/react-router'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  FileText,
  Loader2,
  Search,
} from 'lucide-react'
import type { UserJudgement } from '@/server/user-judgements'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  getUserAssignedJudgementsPaginated,
  getUserJudgementCounts,
} from '@/server/user-judgements'
import { authClient } from '@/lib/auth-client'

const PAGE_SIZE = 15
const DEBOUNCE_MS = 300

function useDebouncedValue(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function SkeletonCard() {
  return (
    <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
      </div>
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div>
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse" />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {[1, 2].map((col) => (
            <Card key={col} className="gap-2">
              <CardHeader>
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-40 animate-pulse" />
              </CardHeader>
              <CardContent className="space-y-2">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/')({
  component: UserDashboard,
  loader: async () => {
    return await getUserJudgementCounts()
  },
})

function UserDashboard() {
  const { data: session } = authClient.useSession()
  const initialCounts = Route.useLoaderData()

  const { data: counts } = useQuery({
    queryKey: ['user-judgement-counts'],
    queryFn: () => getUserJudgementCounts(),
    initialData: initialCounts,
  })

  const [pendingSearch, setPendingSearch] = useState('')
  const [verifiedSearch, setVerifiedSearch] = useState('')
  const debouncedPendingSearch = useDebouncedValue(pendingSearch, DEBOUNCE_MS)
  const debouncedVerifiedSearch = useDebouncedValue(verifiedSearch, DEBOUNCE_MS)

  const pendingQuery = useInfiniteQuery({
    queryKey: ['user-judgements', 'pending', debouncedPendingSearch],
    queryFn: ({ pageParam }) =>
      getUserAssignedJudgementsPaginated({
        data: {
          status: 'pending',
          offset: pageParam,
          limit: PAGE_SIZE,
          search: debouncedPendingSearch || undefined,
        },
      }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
    initialPageParam: 0,
  })

  const inProgressQuery = useInfiniteQuery({
    queryKey: ['user-judgements', 'in_progress', debouncedPendingSearch],
    queryFn: ({ pageParam }) =>
      getUserAssignedJudgementsPaginated({
        data: {
          status: 'in_progress',
          offset: pageParam,
          limit: PAGE_SIZE,
          search: debouncedPendingSearch || undefined,
        },
      }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
    initialPageParam: 0,
  })

  const verifiedQuery = useInfiniteQuery({
    queryKey: ['user-judgements', 'verified', debouncedVerifiedSearch],
    queryFn: ({ pageParam }) =>
      getUserAssignedJudgementsPaginated({
        data: {
          status: 'verified',
          offset: pageParam,
          limit: PAGE_SIZE,
          search: debouncedVerifiedSearch || undefined,
        },
      }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
    initialPageParam: 0,
  })

  const pendingJudgements = pendingQuery.data?.pages.flat() ?? []
  const inProgressJudgements = inProgressQuery.data?.pages.flat() ?? []
  const verifiedJudgements = verifiedQuery.data?.pages.flat() ?? []

  const allPending = [...inProgressJudgements, ...pendingJudgements]

  const isInitialLoading =
    pendingQuery.isPending &&
    inProgressQuery.isPending &&
    verifiedQuery.isPending

  const isPendingSearching = pendingQuery.isFetching && !pendingQuery.isPending
  const isVerifiedSearching =
    verifiedQuery.isFetching && !verifiedQuery.isPending

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

  if (isInitialLoading) {
    return <LoadingSkeleton />
  }

  const pendingCount = counts.counts.pending + counts.counts.in_progress
  const verifiedCount = counts.counts.verified

  return (
    <div className="min-h-[calc(100vh-4rem)] h-full">
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome, {session.user.name}
          </h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
          <div className="space-y-6">
            <Card className="gap-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Circle className="h-5 w-5 text-gray-500" />
                  Pending Verification
                  <Badge variant="secondary">{pendingCount}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingCount === 0 ? (
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
                  <>
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search by trial, filename, or appeal..."
                        value={pendingSearch}
                        onChange={(e) => setPendingSearch(e.target.value)}
                        className="pl-9 pr-9"
                      />
                      {isPendingSearching && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
                      )}
                    </div>
                    <ScrollArea className="h-[calc(100vh-24rem)] pr-2">
                      <div className="space-y-2">
                        {allPending.map((judgement) => (
                          <JudgementCard
                            key={judgement.id}
                            judgement={judgement}
                            status={judgement.status}
                          />
                        ))}
                        {allPending.length === 0 && pendingSearch && (
                          <p className="text-sm text-gray-500 text-center py-4">
                            No matching judgements found
                          </p>
                        )}
                        {(pendingQuery.hasNextPage ||
                          inProgressQuery.hasNextPage) && (
                          <div className="flex justify-center py-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (pendingQuery.hasNextPage)
                                  pendingQuery.fetchNextPage()
                                if (inProgressQuery.hasNextPage)
                                  inProgressQuery.fetchNextPage()
                              }}
                              disabled={
                                pendingQuery.isFetchingNextPage ||
                                inProgressQuery.isFetchingNextPage
                              }
                            >
                              {pendingQuery.isFetchingNextPage ||
                              inProgressQuery.isFetchingNextPage ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : null}
                              Load more
                            </Button>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

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
                    {verifiedCount}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {verifiedCount === 0 ? (
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
                  <>
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search by trial, filename, or appeal..."
                        value={verifiedSearch}
                        onChange={(e) => setVerifiedSearch(e.target.value)}
                        className="pl-9 pr-9"
                      />
                      {isVerifiedSearching && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
                      )}
                    </div>
                    <ScrollArea className="h-[calc(100vh-24rem)] pr-2">
                      <div className="space-y-2">
                        {verifiedJudgements.map((judgement) => (
                          <JudgementCard
                            key={judgement.id}
                            judgement={judgement}
                            status="verified"
                          />
                        ))}
                        {verifiedJudgements.length === 0 && verifiedSearch && (
                          <p className="text-sm text-gray-500 text-center py-4">
                            No matching judgements found
                          </p>
                        )}
                        {verifiedQuery.hasNextPage && (
                          <div className="flex justify-center py-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => verifiedQuery.fetchNextPage()}
                              disabled={verifiedQuery.isFetchingNextPage}
                            >
                              {verifiedQuery.isFetchingNextPage ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : null}
                              Load more
                            </Button>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </>
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
