/**
 * Typed Trominal API client generated from apps/backend/openapi.yaml.
 */

type FetchResponse = {
  ok: boolean
  status: number
  text: () => Promise<string>
}

type Fetcher = (input: string, init?: FetchInit) => Promise<FetchResponse>

type FetchInit = {
  method?: string
  headers?: Record<string, string>
  body?: string
}

/** Supported encrypted vault resource collections. */
export type VaultResourceType =
  | 'groups'
  | 'hosts'
  | 'host-credentials'
  | 'snippets'
  | 'identities'
  | 'tunnels'
  | 'ai-settings'

/** Client-supplied encrypted field payload for a vault record. */
export type VaultRecordPayload = Record<string, boolean | number | string | null>

/** Server-returned encrypted vault record envelope. */
export type VaultRecord = VaultRecordPayload & {
  id: string
  type: VaultResourceType
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
}

/** Delta sync payload grouped by vault resource type. */
export type VaultSyncResponse = {
  cursor: string
  vault_version: number
  data: Partial<Record<VaultResourceType, VaultRecord[]>>
}

/** One re-encrypted vault record submitted during master-password rotation. */
export type MasterPasswordChangeItem = {
  type: VaultResourceType
  id: string
  fields: VaultRecordPayload
}

/** Request body for server-side master-password rotation finalization. */
export type MasterPasswordChangeRequest = {
  new_kdf_salt: string
  new_kdf_params: Record<string, unknown>
  current_refresh_token: string
  items: MasterPasswordChangeItem[]
}

/** Error thrown when the Trominal API responds outside the 2xx range. */
export class TrominalApiError extends Error {
  readonly status: number
  readonly body: string

  constructor(status: number, body: string) {
    super(`Trominal API request failed with status ${status}`)
    this.name = 'TrominalApiError'
    this.status = status
    this.body = body
  }
}

/** Configuration for the generated Trominal API client. */
export type TrominalApiClientOptions = {
  baseUrl: string
  accessToken?: string
  fetcher?: Fetcher
}

/** Minimal typed client for Trominal API v1 endpoints. */
export class TrominalApiClient {
  private readonly baseUrl: string
  private readonly fetcher: Fetcher
  private accessToken?: string

  constructor(options: TrominalApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.accessToken = options.accessToken
    this.fetcher = options.fetcher ?? (globalThis.fetch.bind(globalThis) as Fetcher)
  }

  /** Replace the bearer token used on future authenticated requests. */
  setAccessToken(accessToken: string | undefined): void {
    this.accessToken = accessToken
  }

  /** List encrypted vault records for one resource type. */
  async listVaultRecords(resource: VaultResourceType): Promise<VaultRecord[]> {
    const response = await this.request<{ data: VaultRecord[] }>(`/api/v1/vault/${resource}`)

    return response.data
  }

  /** Create an encrypted vault record. */
  async createVaultRecord(
    resource: VaultResourceType,
    payload: VaultRecordPayload,
  ): Promise<VaultRecord> {
    const response = await this.request<{ data: VaultRecord }>(`/api/v1/vault/${resource}`, {
      method: 'POST',
      body: payload,
    })

    return response.data
  }

  /** Read one encrypted vault record. */
  async getVaultRecord(resource: VaultResourceType, id: string): Promise<VaultRecord> {
    const response = await this.request<{ data: VaultRecord }>(`/api/v1/vault/${resource}/${id}`)

    return response.data
  }

  /** Update one encrypted vault record. */
  async updateVaultRecord(
    resource: VaultResourceType,
    id: string,
    payload: VaultRecordPayload,
  ): Promise<VaultRecord> {
    const response = await this.request<{ data: VaultRecord }>(`/api/v1/vault/${resource}/${id}`, {
      method: 'PATCH',
      body: payload,
    })

    return response.data
  }

  /** Soft-delete one encrypted vault record. */
  async deleteVaultRecord(resource: VaultResourceType, id: string): Promise<void> {
    await this.request<void>(`/api/v1/vault/${resource}/${id}`, {
      method: 'DELETE',
    })
  }

  /** Fetch encrypted vault deltas since the optional cursor. */
  async syncVault(cursor?: string): Promise<VaultSyncResponse> {
    const query = cursor === undefined ? '' : `?cursor=${encodeURIComponent(cursor)}`

    return this.request<VaultSyncResponse>(`/api/v1/vault/sync${query}`)
  }

  /** Finalize client-side master-password rotation on the server. */
  async changeMasterPassword(
    payload: MasterPasswordChangeRequest,
  ): Promise<{ vault_version: number }> {
    return this.request<{ vault_version: number }>('/api/v1/me/master-password/change', {
      method: 'POST',
      body: payload,
    })
  }

  private async request<T>(
    path: string,
    options: { method?: 'DELETE' | 'GET' | 'PATCH' | 'POST'; body?: unknown } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    }

    if (this.accessToken !== undefined) {
      headers.Authorization = `Bearer ${this.accessToken}`
    }

    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json'
    }

    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
    const text = await response.text()

    if (!response.ok) {
      throw new TrominalApiError(response.status, text)
    }

    if (text === '') {
      return undefined as T
    }

    return JSON.parse(text) as T
  }
}
