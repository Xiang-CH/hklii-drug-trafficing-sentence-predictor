import { Link, createFileRoute } from '@tanstack/react-router'

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
  const judgmentCount = await judgementsCollection.countDocuments()

  return { userCount, judgmentCount }
})

export const Route = createFileRoute('/admin/')({
  beforeLoad: async () => {
    await requireAdminAuth('/admin')
  },
  component: AdminComponent,
  loader: async () => fetchAdminStats(),
})

function AdminComponent() {
  const { userCount, judgmentCount } = Route.useLoaderData()

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
      count: judgmentCount,
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
                  Total {link.title.toLowerCase()}: {link.count}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
