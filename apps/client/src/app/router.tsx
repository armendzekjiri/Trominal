import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthGuard, ConnectGuard, GuestGuard, VaultGuard } from './guards'
import { ConnectPage } from '@/features/auth/pages/ConnectPage'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'
import { TwoFactorPage } from '@/features/auth/pages/TwoFactorPage'
import { TwoFactorSetupPage } from '@/features/auth/pages/TwoFactorSetupPage'
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage'
import { UnlockPage } from '@/features/auth/pages/UnlockPage'
import { AppShell } from '@/features/app/AppShell'
import { HostsPage } from '@/features/hosts/HostsPage'
import { SnippetsPage } from '@/features/snippets/SnippetsPage'
import { TunnelsPage } from '@/features/tunnels/TunnelsPage'
import { SftpPlaceholder } from '@/features/app/SftpPlaceholder'
import { IdentitiesPage } from '@/features/identities/IdentitiesPage'
import { SettingsPlaceholder } from '@/features/app/SettingsPlaceholder'
import { TerminalPage } from '@/features/terminal/TerminalPage'

const router = createBrowserRouter([
  // /connect must be reachable WITHOUT a configured URL — otherwise the
  // ConnectGuard would redirect away from the page that's meant to set it.
  // It's also reachable when the URL is already set, so users can switch
  // servers from this screen.
  { path: '/connect', element: <ConnectPage /> },

  {
    element: <ConnectGuard />,
    children: [
      {
        element: <GuestGuard />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
          { path: '/2fa', element: <TwoFactorPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
          { path: '/reset-password', element: <ResetPasswordPage /> },
        ],
      },
      {
        element: <AuthGuard />,
        children: [
          { path: '/2fa/setup', element: <TwoFactorSetupPage /> },
          { path: '/unlock', element: <UnlockPage /> },
          {
            element: <VaultGuard />,
            children: [
              {
                element: <AppShell />,
                children: [
                  { index: true, element: <HostsPage /> },
                  { path: 'hosts', element: <HostsPage /> },
                  { path: 'terminal', element: <TerminalPage /> },
                  { path: 'snippets', element: <SnippetsPage /> },
                  { path: 'identities', element: <IdentitiesPage /> },
                  { path: 'tunnels', element: <TunnelsPage /> },
                  { path: 'sftp', element: <SftpPlaceholder /> },
                  { path: 'settings', element: <SettingsPlaceholder /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
