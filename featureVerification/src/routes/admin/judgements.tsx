import * as React from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import type { JudgementListItem } from './api/judgements'
import { authClient } from '@/lib/auth-client'
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

type JudgementsSearchParams = {
  page: number
  status?: 'all' | 'processed' | 'unprocessed' | 'verified'
  search?: string
}

type JudgementResponse = {
  total: number
  items: Array<JudgementListItem>
}

const JUDGEMENTS_PER_PAGE = 20

async function getJudgements(params: JudgementsSearchParams) {
  const query = new URLSearchParams({
    page: params.page.toString(),
    status: params.status ?? 'all',
    search: params.search ?? '',
  })

  const response = await fetch(`/admin/api/judgements?${query.toString()}`)
  if (response.status === 401) {
    throw redirect({
      to: '/login',
      search: { redirect: `/admin/judgements?${query.toString()}` },
    })
  }
  if (!response.ok) {
    throw new Error('Failed to load judgements')
  }
  return (await response.json()) as JudgementResponse
}

export const Route = createFileRoute('/admin/judgements')({
  component: JudgementsComponent,
  validateSearch: (search: Record<string, string>): JudgementsSearchParams => {
    return {
      page: search.page ? parseInt(search.page) : 1,
      status: (search.status as JudgementsSearchParams['status']) ?? 'all',
      search: search.search,
    }
  },
  beforeLoad: async (query) => {
    const session = await authClient.getSession()
    if (!session.data?.user) {
      throw redirect({
        to: '/login',
        search: { redirect: `/admin/judgements?${query.toString()}` },
      })
    }
    if (session.data.user.role !== 'admin') {
      throw redirect({ to: '/' })
    }
  },
  loaderDeps: ({ search }) => ({
    page: search.page,
    status: search.status,
    searchText: search.search,
  }),
  loader: async ({ deps }) => {
    return getJudgements({
      page: deps.page,
      status: deps.status,
      search: deps.searchText,
    })
  },
})

function JudgementsComponent() {
  const initial = Route.useLoaderData()
  const { page, status, search } = Route.useSearch()
  const [searchText, setSearchText] = React.useState(search ?? '')
  const navigate = useNavigate({ from: '/admin/judgements' })

  const { data } = useQuery({
    queryKey: ['judgements', page, status, search],
    initialData: initial,
    queryFn: () => getJudgements({ page, status, search }),
  })

  const totalPages = Math.ceil(data.total / JUDGEMENTS_PER_PAGE)

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Judgements</h1>
          <p className="text-sm text-muted-foreground">
            View processed and unprocessed judgements.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder="Search by trial or filename"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="sm:w-64"
          />
          <Select
            value={status ?? 'all'}
            onValueChange={(value) => {
              navigate({
                search: (prev) => ({
                  ...prev,
                  page: 1,
                  status: value as JudgementsSearchParams['status'],
                }),
              })
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="processed">Processed</SelectItem>
              <SelectItem value="unprocessed">Unprocessed</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="secondary"
            onClick={() => {
              navigate({
                search: (prev) => ({
                  ...prev,
                  page: 1,
                  search: searchText,
                }),
              })
            }}
          >
            Apply
          </Button>
        </div>
      </div>

      {data.items.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Case</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assignee</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  {row.trial ?? row.id}
                  {row.appeal ? ` (${row.appeal})` : ''}
                  {row.corrigendum ? ` (${row.corrigendum})` : ''}
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      row.verified
                        ? 'bg-green-100 text-green-800'
                        : row.processed
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {row.processed ? 'Processed' : 'Unprocessed'}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.assignee ? row.assignee.name : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="py-12 text-center text-muted-foreground">
          No judgements found.
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <Pagination
          currentPage={page}
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
    </div>
  )
}
