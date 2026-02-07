import { Link, createFileRoute, redirect } from '@tanstack/react-router'

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { requireAdminAuth } from '@/lib/auth-client'

export const Route = createFileRoute('/admin/')({
  beforeLoad: async () => {
    await requireAdminAuth('/admin')
  },
  component: AdminComponent,
})

function AdminComponent() {
  const adminLinks = [
    {
      title: 'Users',
      description: 'Manage user accounts, roles, and access.',
      to: '/admin/users',
    },
    {
      title: 'Judgements',
      description: 'Review and maintain judgement records.',
      to: '/admin/judgements',
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
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
