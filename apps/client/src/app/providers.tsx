import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '@/stores/auth'
import { useIdleResetEffect } from '@/lib/idle'

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  })
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient)
  const hydrate = useAuth((s) => s.hydrate)
  useEffect(() => {
    void hydrate()
  }, [hydrate])
  useIdleResetEffect()

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
