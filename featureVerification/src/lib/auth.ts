import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { admin, username } from "better-auth/plugins"
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import  mongoClient  from './mongodb'

const client = mongoClient;
const db = client.db();

export const auth = betterAuth({
  database: mongodbAdapter(db, {
    // Optional: if you don't provide a client, database transactions won't be enabled.
    client,
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [tanstackStartCookies(), admin(), username()],
})