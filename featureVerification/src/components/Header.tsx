import { Link } from '@tanstack/react-router'

import { useState } from 'react'
import {
  Globe,
  Home,
  Menu,
  Network,
  Users,
  FileText,
  ClipboardList,
  X,
} from 'lucide-react'
import BetterAuthHeader from '../integrations/better-auth/header-user.tsx'
import { authClient } from '@/lib/auth-client'

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const { data: session } = authClient.useSession()
  const isAdmin = session?.user.role === 'admin'

  return (
    <>
      <header className="px-2 py-2 flex items-center bg-gray-800 text-white shadow-lg">
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
        <h1 className="ml-4 text-xl font-semibold">
          <Link to="/">
            Drug Trafficking Sentence Predictor Data Verification
          </Link>
        </h1>
      </header>

      <aside
        className={`fixed top-0 left-0 h-full w-80 bg-gray-900 text-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold">Navigation</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <Link
            to="/"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2"
            activeProps={{
              className:
                'flex items-center gap-3 p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors mb-2',
            }}
          >
            <Home size={20} />
            <span className="font-medium">Home</span>
          </Link>

          {isAdmin && (
            <>
              <Link
                to="/admin"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2"
                activeProps={{
                  className:
                    'flex items-center gap-3 p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors mb-2',
                }}
              >
                <Network size={20} />
                <span className="font-medium">Admin</span>
              </Link>

              <div className="ml-6 flex flex-col gap-1 mb-2">
                <Link
                  to="/admin/users"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800 transition-colors text-sm"
                  activeProps={{
                    className:
                      'flex items-center gap-3 p-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors text-sm',
                  }}
                >
                  <Users size={16} />
                  <span>Users</span>
                </Link>

                <Link
                  to="/admin/judgements"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800 transition-colors text-sm"
                  activeProps={{
                    className:
                      'flex items-center gap-3 p-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors text-sm',
                  }}
                >
                  <FileText size={16} />
                  <span>Judgements</span>
                </Link>

                <Link
                  to="/admin/assignment"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800 transition-colors text-sm"
                  activeProps={{
                    className:
                      'flex items-center gap-3 p-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors text-sm',
                  }}
                >
                  <ClipboardList size={16} />
                  <span>Assignment</span>
                </Link>
              </div>
            </>
          )}

          <Link
            to="/login"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2"
            activeProps={{
              className:
                'flex items-center gap-3 p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors mb-2',
            }}
          >
            <Globe size={20} />
            <span className="font-medium">Account</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-700 bg-gray-800 flex flex-col gap-2">
          <BetterAuthHeader />
        </div>
      </aside>
    </>
  )
}
