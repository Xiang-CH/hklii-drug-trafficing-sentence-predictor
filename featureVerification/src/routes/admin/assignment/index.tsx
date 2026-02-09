import * as React from 'react'
import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Check,
  ExternalLink,
  FileText,
  Search,
  Shuffle,
  Trash2,
  User,
} from 'lucide-react'
import type { AssignmentData, AssignmentUser } from '@/routes/api/assignment/$'
import { requireAdminAuth } from '@/lib/auth-client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Pagination } from '@/components/pagination'
import { set } from 'zod'

type AssignmentSearchParams = {
  page?: number
  search?: string
  assigned?: 'all' | 'assigned' | 'unassigned'
  username?: string | null
}

const JUDGEMENTS_PER_PAGE = 50

async function getAssignmentData(params: {
  page: number
  search: string
  assigned: string
  username?: string | null
}): Promise<AssignmentData> {
  const query = new URLSearchParams({
    page: params.page.toString(),
    search: params.search,
    assigned: params.assigned,
    username: params.username ?? '',
  })

  const response = await fetch(`/api/assignment?${query.toString()}`)
  if (response.status === 401) {
    throw redirect({
      to: '/login',
      search: { redirect: '/admin/assignment' },
    })
  }
  if (!response.ok) {
    throw new Error('Failed to load assignment data')
  }
  return response.json()
}

async function assignJudgements(
  judgementIds: Array<string>,
  userId: string,
  action: 'assign' | 'unassign' | 'random',
  count?: number,
) {
  const response = await fetch('/api/assignment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      judgementIds,
      userId,
      action,
      count,
    }),
  })
  if (!response.ok) {
    const error = await response.json()
    toast.error(error.error || 'Failed to assign judgements')
    throw new Error(error.error || 'Failed to assign judgements')
  }
  return response.json()
}

export const Route = createFileRoute('/admin/assignment/')({
  component: AssignmentComponent,
  validateSearch: (search: Record<string, string>): AssignmentSearchParams => {
    return {
      page: search.page ? parseInt(search.page) : 1,
      search: search.search,
      assigned:
        (search.assigned as AssignmentSearchParams['assigned']) ?? 'unassigned',
      username: search.username,
    }
  },
  beforeLoad: async ({ location }) => {
    await requireAdminAuth(location.href)
  },
  loaderDeps: ({ search }) => ({
    page: search.page ?? 1,
    searchText: search.search ?? '',
    assigned: search.assigned ?? 'all',
    // Only include username in deps when filter is "assigned" to prevent unnecessary refetches
    username: search.assigned === 'assigned' ? search.username : undefined,
  }),
  loader: async ({ deps }) => {
    return getAssignmentData({
      page: deps.page,
      search: deps.searchText,
      assigned: deps.assigned,
      username: deps.assigned === 'assigned' ? deps.username : undefined,
    })
  },
})

function AssignmentComponent() {
  const initialData = Route.useLoaderData()
  const { page, search, assigned, username } = Route.useSearch()
  const navigate = useNavigate({ from: '/admin/assignment/' })
  const queryClient = useQueryClient()

  const [searchText, setSearchText] = React.useState(search ?? '')
  const [selectedUser, setSelectedUser] = React.useState<AssignmentUser | null>(
    null
  )
  const [selectedJudgements, setSelectedJudgements] = React.useState<
    Set<string>
  >(new Set())
  const [randomCount, setRandomCount] = React.useState(10)
  const [isRandomDialogOpen, setIsRandomDialogOpen] = React.useState(false)

  // Auto-select user from URL parameter
  React.useEffect(() => {
    console.log([
      'assignment',
      page,
      search,
      assigned,
      assigned === 'assigned' ? username : undefined,
    ])
    if (username && initialData.users.length > 0) {
      const user = initialData.users.find((u) => u.username === username)
      setSelectedUser(user || null)
    } else {
      setSelectedUser(null)
    }
  }, [username, initialData.users])

  const { data } = useQuery({
    // Only include username in queryKey when filter is "assigned"
    // For "all" and "unassigned", switching users should not refetch data
    queryKey:
      assigned === 'assigned'
        ? ['assignment', page, search, assigned, username]
        : ['assignment', page, search, assigned],
    initialData,
    queryFn: () =>
      getAssignmentData({
        page: page ?? 1,
        search: search ?? '',
        assigned: assigned ?? 'all',
        username: assigned === 'assigned' ? (username ?? null) : null,
      }),
  })

  const assignMutation = useMutation({
    mutationFn: ({
      judgementIds,
      userId,
      action,
      count,
    }: {
      judgementIds: Array<string>
      userId?: string
      action: 'assign' | 'unassign' | 'random'
      count?: number
    }) => assignJudgements(judgementIds, userId || '', action, count),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment'] })
      setSelectedJudgements(new Set())
    },
  })

  const users = data.users
  const judgements = data.judgements
  const totalPages = Math.ceil(data.total / JUDGEMENTS_PER_PAGE)

  const handleJudgementSelect = (judgementId: string) => {
    setSelectedJudgements((prev) => {
      const next = new Set(prev)
      if (next.has(judgementId)) {
        next.delete(judgementId)
      } else {
        next.add(judgementId)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedJudgements.size === judgements.length) {
      setSelectedJudgements(new Set())
    } else {
      setSelectedJudgements(new Set(judgements.map((j) => j.id)))
    }
  }

  const handleAssign = () => {
    if (!selectedUser || selectedJudgements.size === 0) return
    assignMutation.mutate({
      judgementIds: Array.from(selectedJudgements),
      userId: selectedUser.id,
      action: 'assign',
    })
  }

  const handleUnassign = () => {
    if (selectedJudgements.size === 0) return
    assignMutation.mutate({
      judgementIds: Array.from(selectedJudgements),
      action: 'unassign',
    })
  }

  const handleRandomAssign = () => {
    if (!selectedUser) return
    assignMutation.mutate(
      {
        judgementIds: [],
        userId: selectedUser.id,
        action: 'random',
        count: randomCount,
      },
      {
        onSuccess: () => {
          setIsRandomDialogOpen(false)
        },
      },
    )
  }

  return (
    <div className="container mx-auto p-4 h-[calc(100vh-3.2rem)] overflow-hidden flex flex-col">
      <div className="flex flex-col gap-2 mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-semibold px-1">Assignment Management</h1>
        </div>

        {selectedUser && (
          <Card className="bg-primary/5 border-primary/20 py-3">
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-primary" />
                  <div>
                    <span className="font-medium">Selected User:</span>{' '}
                    <span className="text-primary font-semibold">
                      {selectedUser.name}
                    </span>
                    <span className="text-muted-foreground ml-2">
                      (@{selectedUser.username})
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Dialog
                    open={isRandomDialogOpen}
                    onOpenChange={setIsRandomDialogOpen}
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Shuffle className="h-4 w-4 mr-2" />
                        Random Assign
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Random Assignment</DialogTitle>
                        <DialogDescription>
                          Randomly assign unassigned judgements to{' '}
                          {selectedUser.name}.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <label className="text-sm font-medium mb-2 block">
                          Number of judgements to assign
                        </label>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={randomCount}
                          onChange={(e) =>
                            setRandomCount(parseInt(e.target.value) || 10)
                          }
                        />
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setIsRandomDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleRandomAssign}
                          disabled={assignMutation.isPending}
                        >
                          {assignMutation.isPending ? 'Assigning...' : 'Assign'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {selectedJudgements.size > 0 && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleAssign}
                        disabled={assignMutation.isPending}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Assign Selected ({selectedJudgements.size})
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleUnassign}
                        disabled={assignMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Unassign
                      </Button>
                    </>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedUser(null)}
                  >
                    Clear Selection
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Users Panel */}
        <Card className="lg:col-span-1 flex flex-col h-full pb-0 gap-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Users
            </CardTitle>
            <CardDescription>
              Select a user to assign judgements
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-0 flex flex-col pb-0">
            <ScrollArea className="h-[calc(100vh-18.5rem)] w-full rounded">
              <div className="px-6 space-y-2">
                {users.map((user) => (
                  <button
                    key={user.id}
                    // onClick={() => handleUserSelect(user)}
                    onClick={() =>
                      navigate({
                        search: (prev) => ({
                          ...prev,
                          username:
                            prev.username === user.username
                              ? undefined
                              : user.username,
                        }),
                      })
                    }
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                      selectedUser?.id === user.id
                        ? 'bg-primary/10 border-primary/30'
                        : 'hover:bg-muted/50 border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{user.name}</div>
                      <Badge
                        variant={
                          user.assignedCount > 0 ? 'default' : 'secondary'
                        }
                        className="text-xs"
                      >
                        {user.assignedCount} assigned
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      @{user.username}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {user.email}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Judgements Panel */}
        <Card className="lg:col-span-2 flex flex-col h-full pb-0 gap-0">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Judgements
                </CardTitle>
                <CardDescription>{data.total} total judgements</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search judgements..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="pl-9 w-64"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        navigate({
                          search: (prev) => ({
                            ...prev,
                            page: 1,
                            search: searchText,
                          }),
                        })
                      }
                    }}
                  />
                </div>
                <Select
                  value={assigned ?? 'all'}
                  onValueChange={(value) => {
                    navigate({
                      search: (prev) => ({
                        ...prev,
                        page: 1,
                        assigned: value as AssignmentSearchParams['assigned'],
                      }),
                    })
                  }}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 flex flex-col pb-0">
            <div className="px-6 pb-2 flex-shrink-0">
              <label className="flex items-center gap-2 py-2 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2">
                <Checkbox
                  checked={
                    judgements.length > 0 &&
                    selectedJudgements.size === judgements.length
                  }
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm font-medium">
                  Select All ({selectedJudgements.size} selected)
                </span>
              </label>
              {/* <Separator className="mt-2" /> */}
            </div>
            <ScrollArea className="h-[calc(100vh-20.3rem)] w-full rounded">
              <div className="px-6 space-y-2">
                {judgements.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No judgements found
                  </div>
                ) : (
                  judgements.map((judgement) => (
                    <label
                      key={judgement.id}
                      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selectedJudgements.has(judgement.id)}
                        onCheckedChange={() =>
                          handleJudgementSelect(judgement.id)
                        }
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">
                            {judgement.trial || judgement.filename}
                          </span>
                          {judgement.appeal && (
                            <span className="text-sm text-muted-foreground">
                              (Appeal: {judgement.appeal})
                            </span>
                          )}
                          {judgement.corrigendum && (
                            <span className="text-sm text-muted-foreground">
                              (Corr: {judgement.corrigendum})
                            </span>
                          )}
                          <Link
                            to="/admin/judgements/$filename"
                            params={{ filename: judgement.filename }}
                          >
                            <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-blue-600" />
                          </Link>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {judgement.year && (
                            <span className="text-xs text-muted-foreground">
                              {judgement.year}
                            </span>
                          )}
                          {judgement.assignedTo ? (
                            <Badge variant="secondary" className="text-xs">
                              Assigned to {judgement.assignedTo.name}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              Unassigned
                            </Badge>
                          )}
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
              <div className="px-6 py-2 shrink-0 mb-2">
                <Pagination
                  currentPage={page ?? 1}
                  totalPages={totalPages}
                  callback={(newPage) => {
                    navigate({
                      search: (prev) => ({
                        ...prev,
                        page: newPage,
                      }),
                    })
                  }}
                />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
