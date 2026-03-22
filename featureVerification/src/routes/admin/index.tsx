import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import { createServerFn } from '@tanstack/react-start'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { requireAdminAuth } from '@/lib/auth-client'
import { db } from '@/lib/db'

const fetchAdminStats = createServerFn().handler(async () => {
  const usersCollection = db.collection('user')
  const judgementsCollection = db.collection('judgement-html')

  const userCount = await usersCollection.countDocuments()
  const judgementCount = await judgementsCollection.countDocuments()

  return { userCount, judgementCount }
})

export const Route = createFileRoute('/admin/')({
  ssr: false,
  beforeLoad: async () => {
    await requireAdminAuth('/admin')
  },
  component: AdminComponent,
})

function AdminComponent() {
  const { data, isPending } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => fetchAdminStats(),
  })

  const userCount = data?.userCount ?? 0
  const judgementCount = data?.judgementCount ?? 0

  if (isPending) {
    return (
      <div className="mx-auto flex w-full max-w-5xl items-center justify-center p-6 text-muted-foreground">
        Loading dashboard...
      </div>
    )
  }

  const adminLinks = [
    {
      title: 'Users',
      description: 'Manage user accounts, roles, and access.',
      to: '/admin/users',
      count: userCount,
    },
    {
      title: 'Judgements',
      description: 'Review and maintain judgement records.',
      to: '/admin/judgements',
      count: judgementCount,
    },
    {
      title: 'Assignment',
      description: 'Assign judgements to users for review.',
      to: '/admin/assignment',
      count: undefined,
    },
  ]

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Admin Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Quick access to administrative tools and data management.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {adminLinks.map((link) => (
          <Link key={link.to} to={link.to} className="group">
            <Card className="transition group-hover:-translate-y-0.5 group-hover:shadow-lg">
              <CardHeader>
                <CardTitle>{link.title}</CardTitle>
                <CardDescription>{link.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {link.count !== undefined
                    ? `Total ${link.title.toLowerCase()}: ${link.count}`
                    : 'Manage assignments'}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
