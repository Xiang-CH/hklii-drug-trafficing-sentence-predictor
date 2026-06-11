import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { admin, username } from 'better-auth/plugins'
import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import { client, db } from './db'

export const auth = betterAuth({
  database: mongodbAdapter(db, {
    // Optional: if you don't provide a client, database transactions won't be enabled.
    client,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 5,
  },
  plugins: [admin(), username(), tanstackStartCookies()],
})

export type UserType = typeof auth.$Infer.Session.user
export type SessionType = typeof auth.$Infer.Session
