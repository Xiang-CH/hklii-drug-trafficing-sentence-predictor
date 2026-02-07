import * as React from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import type { UseMutationResult } from '@tanstack/react-query'
import type { UserType } from '@/lib/auth'
import { authClient, requireAdminAuth } from '@/lib/auth-client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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

type UsersSearchParams = {
  page: number
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
    const { page } = deps.deps
    const response = await getUsers(page)
    return response
  },
})

function UsersComponent() {
  const response = Route.useLoaderData()
  const navigate = useNavigate({ from: '/admin/users' })
  const { page } = Route.useSearch()

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

  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editingValues, setEditingValues] = React.useState({
    name: '',
    email: '',
    username: '',
  })
  const [loadingId, setLoadingId] = React.useState<string | null>(null)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

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
      // await authClient.admin.updateUser({ userId: userId, data: { name: editingValues.name, email: editingValues.email, username: editingValues.username } })
      // refresh page to reload loader data
      // window.location.href = `/admin/users?page=${page}`
      cancelEdit()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update user')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user: UserType) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {editingId === user.id ? (
                    <Input
                      value={editingValues.name}
                      onChange={(e) =>
                        setEditingValues((v) => ({
                          ...v,
                          name: e.target.value,
                        }))
                      }
                    />
                  ) : (
                    user.name
                  )}
                </TableCell>
                <TableCell>
                  {editingId === user.id ? (
                    <Input
                      value={editingValues.email}
                      onChange={(e) =>
                        setEditingValues((v) => ({
                          ...v,
                          email: e.target.value,
                        }))
                      }
                    />
                  ) : (
                    user.email
                  )}
                </TableCell>
                <TableCell>
                  {editingId === user.id ? (
                    <Input
                      value={editingValues.username}
                      onChange={(e) =>
                        setEditingValues((v) => ({
                          ...v,
                          username: e.target.value,
                        }))
                      }
                    />
                  ) : (
                    user.username
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
                <TableCell className="text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString('en-US')}
                </TableCell>
                <TableCell>
                  {editingId === user.id ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="default"
                        onClick={() => saveUser(user.id)}
                        disabled={loadingId === user.id}
                      >
                        {loadingId === user.id ? 'Saving...' : 'Save'}
                      </Button>
                      <Button variant="ghost" onClick={cancelEdit}>
                        Cancel
                      </Button>
                      {errorMsg && (
                        <div className="text-sm text-destructive">
                          {errorMsg}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => startEdit(user)}
                      >
                        Edit
                      </Button>
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
    },
  })

  React.useEffect(() => {
    if (form.state.values.name && !editedUsername) {
      form.setFieldValue(
        'username',
        form.state.values.name.toLowerCase().replace(/\s+/g, '.'),
      )
    }
  }, [form.state.values.name])

  form.Subscribe

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
                    value.toLowerCase().replace(/\s+/g, '-'),
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
