// Example of a server-side init script (pseudo-code)
import { auth } from '@/lib/auth' // Get the internal adapter instance

async function initializeAdmin() {
  const adminEmail = process.env.AUTH_ADMIN_EMAIL
  const adminPassword = process.env.AUTH_ADMIN_PASSWORD

  if (!adminEmail || !adminPassword) {
    console.error('Admin credentials not set in environment variables')
    return
  }

  try {
    // Create the new user using the adapter directly
    const newUser = await auth.api.createUser({
      body: {
        email: adminEmail, // required
        password: adminPassword, // required
        name: 'Super Admin', // required
        role: 'admin',
        data: { customField: 'customValue' },
      },
    })
    console.log('Default admin user created:', newUser.user.email)
  } catch (error) {
    console.error('Error creating admin user:', error)
  }
}

initializeAdmin()
