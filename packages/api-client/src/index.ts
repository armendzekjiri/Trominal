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
  team_id?: string | null
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
}

/** Optional filters for encrypted vault record lists. */
export type ListVaultRecordsOptions = {
  teamId?: string
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

/** Public-facing instance metadata returned by GET /api/server-info. */
export type ServerInfoResponse = {
  instance_name: string
  backend_version: string
  api_version: string
  min_client_version: string
  registration_mode: 'single' | 'open' | 'invite' | 'closed'
  registration_open: boolean
  web_ssh_enabled: boolean
}

/** Argon2id parameters serialised on the user record. */
export type KdfParamsDto = {
  version: number
  alg: string
  memlimit: number
  opslimit: number
  salt_len: number
  out_len: number
}

/** Vault material returned alongside the user object. */
export type UserVaultMaterial = {
  kdf_salt: string
  kdf_params: KdfParamsDto
  public_key: string
  private_key_ciphertext: string
  private_key_nonce: string
}

/** User as returned by the API. */
export type UserDto = {
  id: number | string
  name: string | null
  email: string
  roles: string[]
  permissions: string[]
  vault: UserVaultMaterial
  two_factor_enabled: boolean
  suspended_at: string | null
  created_at: string | null
  updated_at: string | null
}

/** Request body for POST /api/v1/auth/register. */
export type RegisterRequest = {
  name?: string
  email: string
  password: string
  password_confirmation: string
  kdf_salt: string
  kdf_params: KdfParamsDto
  public_key: string
  private_key_ciphertext: string
  private_key_nonce: string
  device_name?: string
  invite_code?: string
}

/** Request body for POST /api/v1/auth/login. */
export type LoginRequest = {
  email: string
  password: string
  two_factor_code?: string
  device_name?: string
}

/** Request body for POST /api/v1/auth/refresh. */
export type RefreshRequest = {
  refresh_token: string
  device_name?: string
}

/** Token-pair response shared by register / login / refresh. */
export type TokenPairResponse = {
  user: UserDto
  access_token: string
  refresh_token: string
  token_type: 'Bearer'
  expires_in: number
}

/** Request body for POST /api/v1/auth/forgot-password. */
export type ForgotPasswordRequest = { email: string }

/** Request body for POST /api/v1/auth/reset-password. */
export type ResetPasswordRequest = {
  email: string
  token: string
  password: string
  password_confirmation: string
}

/** Response for POST /api/v1/auth/two-factor/enable. */
export type TwoFactorEnableResponse = {
  secret: string
  otpauth_uri: string
}

/** Request body for POST /api/v1/auth/two-factor/verify. */
export type TwoFactorVerifyRequest = { code: string }

/** Request body for POST /api/v1/auth/two-factor/disable. */
export type TwoFactorDisableRequest = { password: string; code: string }

/** Request body for POST /api/v1/ws/ssh-token. */
export type SshTokenRequest = { host_id: string }

/** Short-lived WebSocket SSH token response. */
export type SshTokenResponse = {
  token: string
  expires_at: string
  websocket_url: string
}

/** Team-scoped role inside a shared encrypted workspace. */
export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer'

/** User public key material needed to wrap a team key for that user. */
export type TeamUserKeyDto = {
  id: string
  name: string | null
  email: string
  public_key: string
}

/** Team membership envelope with the member-specific wrapped team key. */
export type TeamMemberDto = {
  id: string
  team_id: string
  user_id: string
  role: TeamRole
  wrapped_team_key_ciphertext: string
  wrapped_team_key_nonce: string
  key_version: number
  created_at: string | null
  updated_at: string | null
  user?: TeamUserKeyDto
}

/** Encrypted team metadata and the authenticated user's wrapped team key. */
export type TeamDto = {
  id: string
  name_ciphertext: string
  name_nonce: string
  key_version: number
  current_member: TeamMemberDto
  members?: TeamMemberDto[]
  created_at: string | null
  updated_at: string | null
}

/** Request body for POST /api/v1/teams. */
export type CreateTeamRequest = {
  id?: string
  name_ciphertext: string
  name_nonce: string
  wrapped_team_key_ciphertext: string
  wrapped_team_key_nonce: string
}

/** Request body for PATCH /api/v1/teams/{id}. */
export type UpdateTeamRequest = {
  name_ciphertext: string
  name_nonce: string
}

/** Request body for POST /api/v1/teams/{id}/members. */
export type AddTeamMemberRequest = {
  user_id: string
  role: TeamRole
  wrapped_team_key_ciphertext: string
  wrapped_team_key_nonce: string
}

/** Request body for PATCH /api/v1/teams/{id}/members/{memberId}. */
export type UpdateTeamMemberRequest = {
  role: TeamRole
}

/** One member key rewrap after a team membership removal. */
export type TeamMemberKeyRewrap = {
  member_id: string
  wrapped_team_key_ciphertext: string
  wrapped_team_key_nonce: string
}

/** A vault record re-encrypted under the new team key during member removal. */
export type TeamReencryptedResource = {
  type: VaultResourceType
  id: string
  fields: VaultRecordPayload
}

/**
 * Request body for DELETE /api/v1/teams/{id}/members/{memberId}.
 *
 * Per PROJECT_BRIEF §5.3, removing a member must (a) re-wrap the team key for
 * every remaining member and (b) re-encrypt every team-scoped vault record
 * under that new team key — otherwise the removed user's retained plaintext
 * key still decrypts the on-disk ciphertext. The server validates that
 * `reencrypted_resources` covers exactly the team's current set of records.
 */
export type RemoveTeamMemberRequest = {
  remaining_members: TeamMemberKeyRewrap[]
  reencrypted_resources: TeamReencryptedResource[]
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

  /** Parse the response body as JSON if possible; null on failure. */
  json<T = unknown>(): T | null {
    try {
      return JSON.parse(this.body) as T
    } catch {
      return null
    }
  }
}

/** Configuration for the generated Trominal API client. */
export type TrominalApiClientOptions = {
  baseUrl: string
  accessToken?: string
  fetcher?: Fetcher
}

type RequestInit = {
  method?: 'DELETE' | 'GET' | 'PATCH' | 'POST'
  body?: unknown
  /** Skip the bearer token even if one is set. Used by /auth/refresh. */
  skipAuth?: boolean
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

  /** Get public instance metadata. Used by the first-launch screen. */
  async getServerInfo(): Promise<ServerInfoResponse> {
    return this.request<ServerInfoResponse>('/api/server-info', { skipAuth: true })
  }

  /** Register the first / next user. Server enforces the active registration mode. */
  async register(payload: RegisterRequest): Promise<TokenPairResponse> {
    return this.request<TokenPairResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: payload,
      skipAuth: true,
    })
  }

  /** Log in with email + login password and (optionally) a 6-digit TOTP code. */
  async login(payload: LoginRequest): Promise<TokenPairResponse> {
    return this.request<TokenPairResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: payload,
      skipAuth: true,
    })
  }

  /** Rotate a refresh token and receive a new access/refresh pair. */
  async refresh(payload: RefreshRequest): Promise<TokenPairResponse> {
    return this.request<TokenPairResponse>('/api/v1/auth/refresh', {
      method: 'POST',
      body: payload,
      skipAuth: true,
    })
  }

  /** Revoke the current access token and active refresh tokens. */
  async logout(): Promise<void> {
    await this.request<{ message: string }>('/api/v1/auth/logout', { method: 'POST' })
  }

  /** Get the authenticated user, roles, permissions, and vault material. */
  async me(): Promise<UserDto> {
    const response = await this.request<{ data: UserDto }>('/api/v1/me')
    return response.data
  }

  /** Begin TOTP setup. Returns a base32 secret and otpauth:// URI for QR rendering. */
  async enableTwoFactor(): Promise<TwoFactorEnableResponse> {
    return this.request<TwoFactorEnableResponse>('/api/v1/auth/two-factor/enable', {
      method: 'POST',
    })
  }

  /** Confirm TOTP setup with a 6-digit code. */
  async verifyTwoFactor(payload: TwoFactorVerifyRequest): Promise<void> {
    await this.request<{ message: string }>('/api/v1/auth/two-factor/verify', {
      method: 'POST',
      body: payload,
    })
  }

  /** Disable TOTP after re-confirming password and a current 6-digit code. */
  async disableTwoFactor(payload: TwoFactorDisableRequest): Promise<void> {
    await this.request<{ message: string }>('/api/v1/auth/two-factor/disable', {
      method: 'POST',
      body: payload,
    })
  }

  /** Send a password-reset email if the account exists. Always returns 202. */
  async forgotPassword(payload: ForgotPasswordRequest): Promise<void> {
    await this.request<{ message: string }>('/api/v1/auth/forgot-password', {
      method: 'POST',
      body: payload,
      skipAuth: true,
    })
  }

  /** Complete a password reset with the token from the email. */
  async resetPassword(payload: ResetPasswordRequest): Promise<void> {
    await this.request<{ message: string }>('/api/v1/auth/reset-password', {
      method: 'POST',
      body: payload,
      skipAuth: true,
    })
  }

  /** List encrypted vault records for one resource type. */
  async listVaultRecords(
    resource: VaultResourceType,
    options: ListVaultRecordsOptions = {},
  ): Promise<VaultRecord[]> {
    const query = options.teamId === undefined ? '' : `?team=${encodeURIComponent(options.teamId)}`
    const response = await this.request<{ data: VaultRecord[] }>(
      `/api/v1/vault/${resource}${query}`,
    )
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
    await this.request<void>(`/api/v1/vault/${resource}/${id}`, { method: 'DELETE' })
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

  /** Create a 30-second, single-use WebSocket SSH token for an owned host. */
  async createSshToken(payload: SshTokenRequest): Promise<SshTokenResponse> {
    return this.request<SshTokenResponse>('/api/v1/ws/ssh-token', {
      method: 'POST',
      body: payload,
    })
  }

  /** List encrypted teams where the current user is a member. */
  async listTeams(): Promise<TeamDto[]> {
    const response = await this.request<{ data: TeamDto[] }>('/api/v1/teams')
    return response.data
  }

  /** Create a team and attach the current user as owner with a wrapped team key. */
  async createTeam(payload: CreateTeamRequest): Promise<TeamDto> {
    const response = await this.request<{ data: TeamDto }>('/api/v1/teams', {
      method: 'POST',
      body: payload,
    })
    return response.data
  }

  /** Read one encrypted team with members. */
  async getTeam(id: string): Promise<TeamDto> {
    const response = await this.request<{ data: TeamDto }>(`/api/v1/teams/${id}`)
    return response.data
  }

  /** Update encrypted team metadata. */
  async updateTeam(id: string, payload: UpdateTeamRequest): Promise<TeamDto> {
    const response = await this.request<{ data: TeamDto }>(`/api/v1/teams/${id}`, {
      method: 'PATCH',
      body: payload,
    })
    return response.data
  }

  /** Delete a team. The backend only allows team owners. */
  async deleteTeam(id: string): Promise<void> {
    await this.request<void>(`/api/v1/teams/${id}`, { method: 'DELETE' })
  }

  /** Look up a user by email and return their public key for team-key wrapping. */
  async lookupTeamUser(email: string): Promise<TeamUserKeyDto> {
    const response = await this.request<{ data: TeamUserKeyDto }>(
      `/api/v1/teams/users/lookup?email=${encodeURIComponent(email)}`,
    )
    return response.data
  }

  /** List members of one team with public key metadata. */
  async listTeamMembers(teamId: string): Promise<TeamMemberDto[]> {
    const response = await this.request<{ data: TeamMemberDto[] }>(
      `/api/v1/teams/${teamId}/members`,
    )
    return response.data
  }

  /** Add a team member with a member-specific wrapped team key. */
  async addTeamMember(teamId: string, payload: AddTeamMemberRequest): Promise<TeamMemberDto> {
    const response = await this.request<{ data: TeamMemberDto }>(
      `/api/v1/teams/${teamId}/members`,
      {
        method: 'POST',
        body: payload,
      },
    )
    return response.data
  }

  /** Change a team member role. The backend prevents removing the final owner. */
  async updateTeamMember(
    teamId: string,
    memberId: string,
    payload: UpdateTeamMemberRequest,
  ): Promise<TeamMemberDto> {
    const response = await this.request<{ data: TeamMemberDto }>(
      `/api/v1/teams/${teamId}/members/${memberId}`,
      {
        method: 'PATCH',
        body: payload,
      },
    )
    return response.data
  }

  /** Remove a team member after providing rewrapped keys for all remaining members. */
  async removeTeamMember(
    teamId: string,
    memberId: string,
    payload: RemoveTeamMemberRequest,
  ): Promise<void> {
    await this.request<void>(`/api/v1/teams/${teamId}/members/${memberId}`, {
      method: 'DELETE',
      body: payload,
    })
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    }

    if (options.skipAuth !== true && this.accessToken !== undefined) {
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
