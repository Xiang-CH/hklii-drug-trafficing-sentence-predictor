import * as React from 'react'
import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { Trash } from 'lucide-react'
import { toast } from 'sonner'
import type { UseMutationResult } from '@tanstack/react-query'
import type { UserType } from '@/lib/auth'
import type { UserAssignmentCounts } from '@/server/assignment'
import { authClient, requireAdminAuth } from '@/lib/auth-client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Pagination } from '@/components/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getUserAssignmentCounts } from '@/server/assignment'
import { deleteUser } from '@/server/user'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

type UsersSearchParams = {
  page?: number
}

type UserMutationVariables =
  | {
      userId: string
      data: { name: string; email: string; username: string }
    }
  | {
      userId: undefined
      data: {
        name: string
        email: string
        password: string
        role: 'user' | 'admin'
        username: string
      }
    }

const USERS_PER_PAGE = 20

async function getUsers(page: number) {
  const response = await authClient.admin.listUsers({
    query: {
      limit: USERS_PER_PAGE,
      offset: (page - 1) * USERS_PER_PAGE,
      sortBy: 'name',
    },
  })
  if (response.error?.status === 401) {
    throw redirect({ to: '/login', search: { redirect: '/admin/users' } })
  }
  return response
}

export const Route = createFileRoute('/admin/users')({
  component: UsersComponent,
  validateSearch: (search: Record<string, string>): UsersSearchParams => {
    return {
      page: search.page ? parseInt(search.page) : 1,
    }
  },
  beforeLoad: async ({ search }) => {
    await requireAdminAuth(`/admin/users?page=${search.page}`)
  },
  loaderDeps: ({ search }) => ({
    page: search.page,
  }),
  loader: async (deps) => {
    const { page = 1 } = deps.deps
    const response = await getUsers(page)
    const assignmentCounts = await getUserAssignmentCounts()
    return { response, assignmentCounts }
  },
})

function UsersComponent() {
  const { response, assignmentCounts } = Route.useLoaderData()
  const navigate = useNavigate({ from: '/admin/users' })
  const { page = 1 } = Route.useSearch()

  if (response.error) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center text-destructive">
        {response.error.status}: {response.error.statusText}
        {response.error.message}
      </div>
    )
  }

  // const users = response?.data?.users ?? []
  const queryClient = useQueryClient()
  const { data: users } = useQuery({
    queryKey: ['users', page],
    initialData: response.data.users,
    queryFn: () => getUsers(page).then((res) => res.data?.users ?? []),
  })

  // Track assignment counts locally and update on mutation success
  const [localAssignmentCounts, setLocalAssignmentCounts] =
    React.useState<UserAssignmentCounts>(assignmentCounts)

  // Update local counts when loader data changes (e.g., when navigating back)
  // React.useEffect(() => {
  //   setLocalAssignmentCounts(assignmentCounts)
  // }, [assignmentCounts])

  // Refresh counts when component mounts or page changes
  React.useEffect(() => {
    const refreshCounts = async () => {
      const freshCounts = await getUserAssignmentCounts()
      setLocalAssignmentCounts(freshCounts)
    }
    refreshCounts()
  }, [page])

  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editingValues, setEditingValues] = React.useState({
    name: '',
    email: '',
    username: '',
  })
  const [loadingId, setLoadingId] = React.useState<string | null>(null)
  const [, setErrorMsg] = React.useState<string | null>(null)

  const [showCreate, setShowCreate] = React.useState(false)

  const updateUserMutation = useMutation<
    void,
    Error,
    UserMutationVariables,
    { previousUsers?: unknown }
  >({
    mutationFn: async ({ userId, data }: UserMutationVariables) => {
      if (userId) {
        await authClient.admin.updateUser({ userId, data })
      } else {
        await authClient.admin.createUser({
          ...data,
          data: { username: data.username },
        })
      }
    },
    onMutate: async (newUser) => {
      await queryClient.cancelQueries({ queryKey: ['users', page] })
      const previousUsers = queryClient.getQueryData(['users', page])
      queryClient.setQueryData(['users', page], (old: any) => {
        return old.map((user: any) => {
          if (user.id === newUser.userId) {
            return { ...user, ...newUser.data }
          }
          return user
        })
      })
      return { previousUsers }
    },
    onError: (err, _, context) => {
      console.error('Error updating user:', err)
      queryClient.setQueryData(['users', page], context?.previousUsers) // rollback to previous users on error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', page] })
    },
  })

  function startEdit(user: UserType) {
    setErrorMsg(null)
    setEditingId(user.id)
    setEditingValues({
      name: user.name,
      email: user.email,
      username: user.username ?? '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setErrorMsg(null)
  }

  async function saveUser(userId: string) {
    setLoadingId(userId)
    setErrorMsg(null)
    try {
      await updateUserMutation.mutateAsync({
        userId,
        data: {
          name: editingValues.name,
          email: editingValues.email,
          username: editingValues.username,
        },
      })
      cancelEdit()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update user')
    } finally {
      setLoadingId(null)
    }
  }

  async function handleDeleteUser() {
    if (!editingId) return

    if (
      localAssignmentCounts[editingId]?.verification &&
      localAssignmentCounts[editingId].verification > 0
    ) {
      toast.error('Cannot delete user with active verification assignments')
      return
    }

    try {
      await deleteUser({ data: editingId })
      queryClient.invalidateQueries({ queryKey: ['users', page] })
      toast.success('User deleted successfully')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete user')
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Users</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setShowCreate((s) => !s)
            }}
          >
            {showCreate ? 'Close' : 'Create User'}
          </Button>
        </div>
      </div>

      {showCreate && <CreateUserForm updateUserMutation={updateUserMutation} />}

      {users.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No users found
        </div>
      ) : (
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[16%]">Name</TableHead>
              <TableHead className="w-[19%]">Email</TableHead>
              <TableHead className="w-[14%]">Username</TableHead>
              <TableHead className="w-[10%]">Role</TableHead>
              <TableHead className="w-[8%]">Assigned</TableHead>
              <TableHead className="w-[8%]">Verified</TableHead>
              <TableHead className="w-[19%]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user: UserType) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium truncate">
                  {editingId === user.id ? (
                    <Input
                      value={editingValues.name}
                      onChange={(e) =>
                        setEditingValues((v) => ({
                          ...v,
                          name: e.target.value,
                        }))
                      }
                      className="w-full"
                    />
                  ) : (
                    <span className="block truncate" title={user.name}>
                      {user.name}
                    </span>
                  )}
                </TableCell>
                <TableCell className="truncate">
                  {editingId === user.id ? (
                    <Input
                      value={editingValues.email}
                      onChange={(e) =>
                        setEditingValues((v) => ({
                          ...v,
                          email: e.target.value,
                        }))
                      }
                      className="w-full"
                    />
                  ) : (
                    <span className="block truncate" title={user.email}>
                      {user.email}
                    </span>
                  )}
                </TableCell>
                <TableCell className="truncate">
                  {editingId === user.id ? (
                    <Input
                      value={editingValues.username}
                      onChange={(e) =>
                        setEditingValues((v) => ({
                          ...v,
                          username: e.target.value,
                        }))
                      }
                      className="w-full"
                    />
                  ) : (
                    <span
                      className="block truncate"
                      title={user.username || undefined}
                    >
                      {user.username}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      user.role === 'admin'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {user.role ?? 'user'}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      localAssignmentCounts[user.id] ? 'default' : 'secondary'
                    }
                  >
                    {localAssignmentCounts[user.id]?.assignment || 0}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      localAssignmentCounts[user.id] ? 'default' : 'secondary'
                    }
                  >
                    {localAssignmentCounts[user.id]?.verification || 0}
                  </Badge>
                </TableCell>
                <TableCell>
                  {editingId === user.id ? (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="default"
                        onClick={() => saveUser(user.id)}
                        disabled={loadingId === user.id}
                        size="sm"
                      >
                        {loadingId === user.id ? 'Saving...' : 'Save'}
                      </Button>
                      <Button variant="ghost" onClick={cancelEdit} size="sm">
                        Cancel
                      </Button>
                      {!localAssignmentCounts[user.id]?.verification && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="rounded-md"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-4">
                            <div className="flex flex-col items-start gap-2">
                              <p>Are you sure you want to delete this user?</p>
                              {localAssignmentCounts[user.id]?.assignment && (
                                <p className="text-sm text-muted-foreground">
                                  This user has{' '}
                                  {localAssignmentCounts[user.id]?.assignment}{' '}
                                  assignments. Assignments will be unassigned
                                  upon deletion.
                                </p>
                              )}
                              <div className="flex w-full justify-end gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    cancelEdit()
                                  }}
                                  size="sm"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => {
                                    handleDeleteUser()
                                    cancelEdit()
                                  }}
                                  size="sm"
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        onClick={() => startEdit(user)}
                        size="sm"
                      >
                        Edit
                      </Button>
                      <Link
                        to="/admin/assignment"
                        search={{ username: user.username }}
                      >
                        <Button variant="outline" size="sm">
                          Assign
                        </Button>
                      </Link>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="mt-4 flex justify-end">
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(response.data.total / USERS_PER_PAGE)}
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
    </div>
  )
}

function CreateUserForm({
  updateUserMutation,
}: {
  updateUserMutation: UseMutationResult<
    void,
    Error,
    UserMutationVariables,
    { previousUsers?: unknown }
  >
}) {
  const [editedUsername, setEditedUsername] = React.useState(false)
  const form = useForm({
    defaultValues: {
      name: '',
      email: '',
      role: 'user' as 'user' | 'admin',
      username: '',
    },
    onSubmitInvalid(props) {
      console.log('CreateUserForm submit invalid', props)
    },
    onSubmit: (values) => {
      console.log('CreateUserForm submit values', values.value)
      const data = { ...values.value, password: values.value.username }
      updateUserMutation.mutateAsync({ data, userId: undefined })
      form.reset()
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      <div className="mb-4 rounded-md border p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          <form.Field
            name="name"
            listeners={{
              onChange: ({ value }) => {
                if (!editedUsername) {
                  form.setFieldValue(
                    'username',
                    value.toLowerCase().replace(/\s+/g, '.'),
                  )
                }
              },
            }}
            children={(field) => (
              <Input
                placeholder="Name"
                minLength={3}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            )}
          />
          <form.Field
            name="email"
            children={(field) => (
              <Input
                placeholder="Email"
                type="email"
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            )}
          />
          <form.Field
            name="username"
            children={(field) => (
              <Input
                placeholder="Username"
                minLength={5}
                name={field.name}
                value={field.state.value}
                onBlur={() => {
                  field.handleBlur()
                  setEditedUsername(true)
                }}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            )}
          />
          <form.Field
            name="role"
            children={(field) => (
              <Select
                defaultValue="user"
                name={field.name}
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v as 'user' | 'admin')}
              >
                <SelectTrigger className="w-fit rounded-md">
                  <span>
                    Role: <SelectValue />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="mt-3 flex items-center gap-2 w-full justify-end">
          <Button type="submit">Create</Button>
        </div>
      </div>
    </form>
  )
}
