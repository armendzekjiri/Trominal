import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'
import { useAuth } from '@/stores/auth'
import { useIdleResetEffect } from '@/lib/idle'
import { queryClient } from '@/lib/query-client'
import { useAppearanceDocumentEffect } from '@/stores/appearance'

export function Providers({ children }: { children: ReactNode }) {
  const hydrate = useAuth((s) => s.hydrate)
  useEffect(() => {
    void hydrate()
  }, [hydrate])
  useIdleResetEffect()
  useAppearanceDocumentEffect()

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
