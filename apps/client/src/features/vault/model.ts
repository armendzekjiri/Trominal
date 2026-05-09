import type { VaultRecord, VaultRecordPayload, VaultResourceType } from '@trominal/api-client'
import { decryptToString, encrypt, makeAd } from '@trominal/crypto'

type EncryptedVaultResource = Extract<
  VaultResourceType,
  'ai-settings' | 'groups' | 'host-credentials' | 'hosts' | 'identities' | 'snippets' | 'tunnels'
>

const AD_RESOURCE: Record<EncryptedVaultResource, string> = {
  groups: 'group',
  hosts: 'host',
  'host-credentials': 'host_credential',
  snippets: 'snippet',
  identities: 'identity',
  tunnels: 'tunnel',
  'ai-settings': 'ai_setting',
}

export type HostItem = {
  id: string
  teamId: string | null
  groupId: string | null
  name: string
  hostname: string
  port: string
  username: string
  tags: string[]
  color: string
  updatedAt: string | null
}

export type GroupItem = {
  id: string
  teamId: string | null
  parentId: string | null
  name: string
  color: string
  sortOrder: number
}

export type SnippetItem = {
  id: string
  teamId: string | null
  title: string
  body: string
  tags: string[]
  updatedAt: string | null
}

export type IdentityItem = {
  id: string
  teamId: string | null
  name: string
  keyType: string
  publicKey: string
  privateKey: string
  updatedAt: string | null
}

export type HostCredentialItem = {
  id: string
  teamId: string | null
  hostId: string | null
  identityId: string | null
  label: string
  username: string
  password: string
  privateKeyPassphrase: string
  updatedAt: string | null
}

/** Stable string ids; new providers can be added without bumping a version. */
export type AiProvider = 'anthropic' | 'openai' | 'ollama' | 'custom'

export type AiFeatureToggles = {
  inlineSuggestions: boolean
  /**
   * Auto-debounced inline suggestions: triggers as the user types instead of
   * waiting for Ctrl+Space. Only effective while `inlineSuggestions` is also
   * on. Off by default — burns API spend per keystroke pause and not every
   * user wants that. Suppressed inside vim/tmux/sudo prompts via
   * autoSuggestHeuristics.
   */
  autoSuggest: boolean
  askPanel: boolean
  explainCommand: boolean
  sendOutputContext: boolean
}

export type AiSettingsItem = {
  id: string
  provider: AiProvider
  endpoint: string
  model: string
  apiKey: string
  features: AiFeatureToggles
  updatedAt: string | null
}

export type AiSettingsInput = {
  id?: string
  provider: AiProvider
  endpoint: string
  model: string
  apiKey: string
  features: AiFeatureToggles
}

export type TunnelKind = 'local' | 'remote' | 'socks'

export type TunnelConfig = {
  kind: TunnelKind
  bindHost: string
  bindPort: string
  targetHost: string
  targetPort: string
}

export type TunnelItem = {
  id: string
  teamId: string | null
  hostId: string | null
  name: string
  config: TunnelConfig
  enabled: boolean
  updatedAt: string | null
}

export type HostInput = {
  id?: string
  groupId: string | null
  name: string
  hostname: string
  port: string
  username: string
  tags: string[]
  color: string
}

export type GroupInput = {
  id?: string
  parentId: string | null
  name: string
  color: string
  sortOrder: number
}

export type SnippetInput = {
  id?: string
  title: string
  body: string
  tags: string[]
}

export type IdentityInput = {
  id?: string
  name: string
  keyType: string
  publicKey: string
  privateKey: string
}

export type HostCredentialInput = {
  id?: string
  hostId: string | null
  identityId: string | null
  label: string
  username: string
  password: string
  privateKeyPassphrase: string
}

export type TunnelInput = {
  id?: string
  hostId: string | null
  name: string
  config: TunnelConfig
  enabled: boolean
}

function stringField(record: VaultRecord, field: string): string | null {
  const value = record[field]
  return typeof value === 'string' ? value : null
}

function booleanField(record: VaultRecord, field: string): boolean {
  const value = record[field]
  return typeof value === 'boolean' ? value : false
}

function numberField(record: VaultRecord, field: string): number {
  const value = record[field]
  return typeof value === 'number' ? value : 0
}

function relationField(record: VaultRecord, field: string): string | null {
  const value = record[field]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function recordAd(record: VaultRecord, resource: EncryptedVaultResource): string {
  const teamId = relationField(record, 'team_id')

  if (teamId === null) {
    return makeAd(AD_RESOURCE[resource], record.id)
  }

  return makeAd(`team_${AD_RESOURCE[resource]}`, `${record.id}:${teamId}`)
}

function tagsFromString(value: string): string[] {
  if (value.trim() === '') {
    return []
  }
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
  }
}

function tunnelConfigFromString(value: string): TunnelConfig {
  if (value.trim() === '') {
    return defaultTunnelConfig()
  }

  try {
    const parsed = JSON.parse(value) as unknown
    if (typeof parsed !== 'object' || parsed === null) {
      return defaultTunnelConfig()
    }

    const config = parsed as Record<string, unknown>
    const kind = tunnelKind(config.kind)
    return {
      kind,
      bindHost: stringValue(config.bindHost) || '127.0.0.1',
      bindPort: stringValue(config.bindPort),
      targetHost: stringValue(config.targetHost),
      targetPort: stringValue(config.targetPort),
    }
  } catch {
    return defaultTunnelConfig()
  }
}

function tunnelKind(value: unknown): TunnelKind {
  return value === 'remote' || value === 'socks' ? value : 'local'
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function defaultAiFeatureToggles(): AiFeatureToggles {
  return {
    inlineSuggestions: true,
    autoSuggest: false,
    askPanel: true,
    explainCommand: true,
    sendOutputContext: false,
  }
}

export function defaultAiSettingsInput(): AiSettingsInput {
  return {
    provider: 'anthropic',
    endpoint: '',
    model: '',
    apiKey: '',
    features: defaultAiFeatureToggles(),
  }
}

function aiProviderFromString(value: unknown): AiProvider {
  if (value === 'anthropic' || value === 'openai' || value === 'ollama' || value === 'custom') {
    return value
  }
  return 'anthropic'
}

function aiFeatureTogglesFromString(value: string): AiFeatureToggles {
  const fallback = defaultAiFeatureToggles()
  if (value.trim() === '') {
    return fallback
  }
  try {
    const parsed = JSON.parse(value) as { features?: Partial<AiFeatureToggles> } | null
    const features = parsed?.features ?? {}
    return {
      inlineSuggestions:
        typeof features.inlineSuggestions === 'boolean'
          ? features.inlineSuggestions
          : fallback.inlineSuggestions,
      autoSuggest:
        typeof features.autoSuggest === 'boolean' ? features.autoSuggest : fallback.autoSuggest,
      askPanel: typeof features.askPanel === 'boolean' ? features.askPanel : fallback.askPanel,
      explainCommand:
        typeof features.explainCommand === 'boolean'
          ? features.explainCommand
          : fallback.explainCommand,
      sendOutputContext:
        typeof features.sendOutputContext === 'boolean'
          ? features.sendOutputContext
          : fallback.sendOutputContext,
    }
  } catch {
    return fallback
  }
}

function aiEndpointFromString(value: string): string {
  if (value.trim() === '') {
    return ''
  }
  try {
    const parsed = JSON.parse(value) as { endpoint?: string } | null
    return typeof parsed?.endpoint === 'string' ? parsed.endpoint : ''
  } catch {
    return ''
  }
}

export function defaultTunnelConfig(): TunnelConfig {
  return {
    kind: 'local',
    bindHost: '127.0.0.1',
    bindPort: '',
    targetHost: '',
    targetPort: '',
  }
}

async function decryptText(
  record: VaultRecord,
  key: Uint8Array,
  resource: EncryptedVaultResource,
  field: string,
): Promise<string> {
  const ct = stringField(record, `${field}_ciphertext`)
  const nonce = stringField(record, `${field}_nonce`)
  if (ct === null || nonce === null) {
    return ''
  }
  return decryptToString({ v: 1, ct, n: nonce }, key, recordAd(record, resource))
}

async function encryptText(
  payload: VaultRecordPayload,
  key: Uint8Array,
  resource: EncryptedVaultResource,
  id: string,
  field: string,
  value: string,
  nullable = true,
): Promise<void> {
  if (nullable && value.trim() === '') {
    payload[`${field}_ciphertext`] = null
    payload[`${field}_nonce`] = null
    return
  }

  const envelope = await encrypt(value, key, makeAd(AD_RESOURCE[resource], id))
  payload[`${field}_ciphertext`] = envelope.ct
  payload[`${field}_nonce`] = envelope.n
}

export async function decryptHost(record: VaultRecord, key: Uint8Array): Promise<HostItem> {
  return {
    id: record.id,
    teamId: relationField(record, 'team_id'),
    groupId: relationField(record, 'group_id'),
    name: await decryptText(record, key, 'hosts', 'name'),
    hostname: await decryptText(record, key, 'hosts', 'hostname'),
    port: (await decryptText(record, key, 'hosts', 'port')) || '22',
    username: await decryptText(record, key, 'hosts', 'username'),
    tags: tagsFromString(await decryptText(record, key, 'hosts', 'tags')),
    color: await decryptText(record, key, 'hosts', 'color'),
    updatedAt: record.updated_at,
  }
}

export async function decryptGroup(record: VaultRecord, key: Uint8Array): Promise<GroupItem> {
  return {
    id: record.id,
    teamId: relationField(record, 'team_id'),
    parentId: relationField(record, 'parent_id'),
    name: await decryptText(record, key, 'groups', 'name'),
    color: await decryptText(record, key, 'groups', 'color'),
    sortOrder: numberField(record, 'sort_order'),
  }
}

export async function decryptSnippet(record: VaultRecord, key: Uint8Array): Promise<SnippetItem> {
  return {
    id: record.id,
    teamId: relationField(record, 'team_id'),
    title: await decryptText(record, key, 'snippets', 'title'),
    body: await decryptText(record, key, 'snippets', 'body'),
    tags: tagsFromString(await decryptText(record, key, 'snippets', 'tags')),
    updatedAt: record.updated_at,
  }
}

export async function decryptIdentity(record: VaultRecord, key: Uint8Array): Promise<IdentityItem> {
  return {
    id: record.id,
    teamId: relationField(record, 'team_id'),
    name: await decryptText(record, key, 'identities', 'name'),
    keyType: stringField(record, 'key_type') ?? 'ed25519',
    publicKey: await decryptText(record, key, 'identities', 'public_key'),
    privateKey: await decryptText(record, key, 'identities', 'private_key'),
    updatedAt: record.updated_at,
  }
}

export async function decryptHostCredential(
  record: VaultRecord,
  key: Uint8Array,
): Promise<HostCredentialItem> {
  return {
    id: record.id,
    teamId: relationField(record, 'team_id'),
    hostId: relationField(record, 'host_id'),
    identityId: relationField(record, 'identity_id'),
    label: await decryptText(record, key, 'host-credentials', 'label'),
    username: await decryptText(record, key, 'host-credentials', 'username'),
    password: await decryptText(record, key, 'host-credentials', 'password'),
    privateKeyPassphrase: await decryptText(
      record,
      key,
      'host-credentials',
      'private_key_passphrase',
    ),
    updatedAt: record.updated_at,
  }
}

export async function decryptAiSettings(
  record: VaultRecord,
  key: Uint8Array,
): Promise<AiSettingsItem> {
  const settingsBlob = await decryptText(record, key, 'ai-settings', 'settings')
  return {
    id: record.id,
    provider: aiProviderFromString(await decryptText(record, key, 'ai-settings', 'provider')),
    endpoint: aiEndpointFromString(settingsBlob),
    model: await decryptText(record, key, 'ai-settings', 'model'),
    apiKey: await decryptText(record, key, 'ai-settings', 'api_key'),
    features: aiFeatureTogglesFromString(settingsBlob),
    updatedAt: record.updated_at,
  }
}

export async function decryptTunnel(record: VaultRecord, key: Uint8Array): Promise<TunnelItem> {
  return {
    id: record.id,
    teamId: relationField(record, 'team_id'),
    hostId: relationField(record, 'host_id'),
    name: await decryptText(record, key, 'tunnels', 'name'),
    config: tunnelConfigFromString(await decryptText(record, key, 'tunnels', 'config')),
    enabled: booleanField(record, 'enabled'),
    updatedAt: record.updated_at,
  }
}

export async function encryptHostInput(id: string, key: Uint8Array, input: HostInput) {
  const payload: VaultRecordPayload = { id, group_id: input.groupId }
  await encryptText(payload, key, 'hosts', id, 'name', input.name, false)
  await encryptText(payload, key, 'hosts', id, 'hostname', input.hostname, false)
  await encryptText(payload, key, 'hosts', id, 'port', input.port)
  await encryptText(payload, key, 'hosts', id, 'username', input.username)
  await encryptText(payload, key, 'hosts', id, 'tags', JSON.stringify(input.tags))
  await encryptText(payload, key, 'hosts', id, 'color', input.color)
  return payload
}

export async function encryptHostCredentialInput(
  id: string,
  key: Uint8Array,
  input: HostCredentialInput,
) {
  const payload: VaultRecordPayload = {
    id,
    host_id: input.hostId,
    identity_id: input.identityId,
  }
  await encryptText(payload, key, 'host-credentials', id, 'label', input.label, false)
  await encryptText(payload, key, 'host-credentials', id, 'username', input.username)
  await encryptText(payload, key, 'host-credentials', id, 'password', input.password)
  await encryptText(
    payload,
    key,
    'host-credentials',
    id,
    'private_key_passphrase',
    input.privateKeyPassphrase,
  )
  return payload
}

export async function encryptGroupInput(id: string, key: Uint8Array, input: GroupInput) {
  const payload: VaultRecordPayload = {
    id,
    parent_id: input.parentId,
    sort_order: input.sortOrder,
  }
  await encryptText(payload, key, 'groups', id, 'name', input.name, false)
  await encryptText(payload, key, 'groups', id, 'color', input.color)
  return payload
}

export async function encryptSnippetInput(id: string, key: Uint8Array, input: SnippetInput) {
  const payload: VaultRecordPayload = { id }
  await encryptText(payload, key, 'snippets', id, 'title', input.title, false)
  await encryptText(payload, key, 'snippets', id, 'body', input.body, false)
  await encryptText(payload, key, 'snippets', id, 'tags', JSON.stringify(input.tags))
  await encryptText(
    payload,
    key,
    'snippets',
    id,
    'variables',
    JSON.stringify(extractVariables(input.body)),
  )
  return payload
}

export async function encryptIdentityInput(id: string, key: Uint8Array, input: IdentityInput) {
  const payload: VaultRecordPayload = { id, key_type: input.keyType }
  await encryptText(payload, key, 'identities', id, 'name', input.name, false)
  await encryptText(payload, key, 'identities', id, 'public_key', input.publicKey)
  await encryptText(payload, key, 'identities', id, 'private_key', input.privateKey, false)
  return payload
}

export async function encryptAiSettingsInput(id: string, key: Uint8Array, input: AiSettingsInput) {
  const payload: VaultRecordPayload = { id }
  await encryptText(payload, key, 'ai-settings', id, 'provider', input.provider)
  await encryptText(payload, key, 'ai-settings', id, 'model', input.model)
  // BYOK: the API key is encrypted client-side and never round-trips through
  // the server in plaintext. AD binds it to this row.
  await encryptText(payload, key, 'ai-settings', id, 'api_key', input.apiKey)
  // The migration only allocates `settings_ciphertext` for non-secret config,
  // so endpoint + feature toggles ride together inside one JSON blob there.
  const blob = JSON.stringify({ endpoint: input.endpoint, features: input.features })
  await encryptText(payload, key, 'ai-settings', id, 'settings', blob)
  return payload
}

export async function encryptTunnelInput(id: string, key: Uint8Array, input: TunnelInput) {
  const payload: VaultRecordPayload = {
    id,
    host_id: input.hostId,
    enabled: input.enabled,
  }
  await encryptText(payload, key, 'tunnels', id, 'name', input.name, false)
  await encryptText(payload, key, 'tunnels', id, 'config', JSON.stringify(input.config), false)
  return payload
}

export function extractVariables(body: string): string[] {
  return Array.from(body.matchAll(/\{\{\s*([a-zA-Z_][\w.-]*)\s*\}\}/g))
    .map((match) => match[1])
    .filter((value, index, all) => all.indexOf(value) === index)
}

export function substituteVariables(body: string, values: Record<string, string>): string {
  return body.replace(
    /\{\{\s*([a-zA-Z_][\w.-]*)\s*\}\}/g,
    (_, name: string) => values[name] ?? `{{${name}}}`,
  )
}

export function tagsFromInput(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}
