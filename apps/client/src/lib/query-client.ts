import { QueryClient } from '@tanstack/react-query'

/**
 * The app-wide TanStack Query client.
 *
 * It lives at module scope (not in React state) so the session lifecycle —
 * vault lock, logout, server switch — can purge cached data synchronously
 * from outside the React tree. Vault query results hold DECRYPTED records,
 * so they must never outlive the key that produced them.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

/** Every query whose data is decrypted vault content starts with this key segment. */
export const VAULT_QUERY_ROOT = 'vault'

/**
 * Drop every decrypted vault query and every mutation (whose `variables` can
 * hold plaintext form input such as passwords). In-flight vault fetches are
 * cancelled so a late response cannot land back in the cache.
 */
export function purgeDecryptedQueries(): void {
  void queryClient.cancelQueries({ queryKey: [VAULT_QUERY_ROOT] })
  queryClient.removeQueries({ queryKey: [VAULT_QUERY_ROOT] })
  queryClient.getMutationCache().clear()
}

/** Drop everything: used when the signed-in account or server goes away. */
export function purgeAllQueries(): void {
  void queryClient.cancelQueries()
  queryClient.clear()
}
