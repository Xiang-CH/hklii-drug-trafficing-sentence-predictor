import { createAuthClient } from 'better-auth/react'
import { adminClient, usernameClient } from 'better-auth/client/plugins'
import { redirect } from '@tanstack/react-router'

export const authClient = createAuthClient({
  plugins: [adminClient(), usernameClient()],
})

export async function requireAdminAuth(redirectTo?: string) {
  const session = await authClient.getSession()
  if (!session.data?.user) {
    throw redirect({
      to: '/login',
      search: { redirect: redirectTo || '/' },
    })
  }
  if (session.data.user.role !== 'admin') {
    throw redirect({ to: '/' })
  }
}
