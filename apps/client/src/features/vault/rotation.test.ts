import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_KDF_PARAMS,
  decrypt,
  deriveVaultKey,
  fromBase64,
  generateSalt,
  generateX25519KeyPair,
  toBase64,
} from '@trominal/crypto'
import type {
  MasterPasswordChangeRequest,
  MasterPasswordChangeResponse,
  UserVaultMaterial,
  VaultRecord,
  VaultRecordPayload,
  VaultResourceType,
} from '@trominal/api-client'
import { useTeamScope } from '@/features/teams/store'
import { useVault } from '@/stores/vault'
import { newVaultId } from './ids'
import {
  decryptAiSettings,
  decryptGroup,
  decryptHost,
  decryptHostCredential,
  decryptIdentity,
  decryptSnippet,
  decryptTunnel,
  defaultAiSettingsInput,
  encryptAiSettingsInput,
  encryptGroupInput,
  encryptHostCredentialInput,
  encryptHostInput,
  encryptIdentityInput,
  encryptSnippetInput,
  encryptTunnelInput,
} from './model'
import { sealUserPrivateKey, userPrivateKeyAd } from './private-key'
import { rotateMasterPassword, type RotationApi } from './rotation'

const OLD_MASTER = 'old master password, long enough 1!'
const NEW_MASTER = 'brand new master password 2@'
const LOGIN_PASSWORD = 'correct-horse-battery-staple'
const REFRESH_TOKEN = 'device-refresh-token'

type Account = {
  owner: { id: string; email: string }
  material: UserVaultMaterial
  key: Uint8Array
  privateKey: Uint8Array
}

/** Registration: Argon2id key, X25519 keypair, envelope bound to the user ID. */
async function registerMaterial(): Promise<Account> {
  const owner = { id: newVaultId().toLowerCase(), email: 'rotate@example.test' }
  const salt = await generateSalt(DEFAULT_KDF_PARAMS.salt_len)
  const key = await deriveVaultKey(OLD_MASTER, salt, DEFAULT_KDF_PARAMS)
  const keypair = await generateX25519KeyPair()
  const envelope = await sealUserPrivateKey(keypair.privateKey, key, owner.id)
  return {
    owner,
    key,
    privateKey: new Uint8Array(keypair.privateKey),
    material: {
      kdf_salt: await toBase64(salt),
      kdf_params: DEFAULT_KDF_PARAMS,
      public_key: await toBase64(keypair.publicKey),
      private_key_ciphertext: envelope.ct,
      private_key_nonce: envelope.n,
      vault_version: 1,
      private_key_ad_version: 2,
    },
  }
}

function asRecord(type: VaultResourceType, payload: VaultRecordPayload): VaultRecord {
  return {
    ...payload,
    id: String(payload.id),
    type,
    team_id: null,
    created_at: '2026-11-02T10:00:00+00:00',
    updated_at: '2026-11-02T10:00:00+00:00',
    deleted_at: null,
  }
}

/** One record of every vault type, encrypted with the real client model code. */
async function populate(key: Uint8Array): Promise<Record<VaultResourceType, VaultRecord[]>> {
  const groupId = newVaultId()
  const hostId = newVaultId()
  const identityId = newVaultId()
  const credentialId = newVaultId()
  const snippetId = newVaultId()
  const tunnelId = newVaultId()
  const aiId = newVaultId()

  return {
    groups: [
      asRecord(
        'groups',
        await encryptGroupInput(groupId, key, {
          parentId: null,
          name: 'Production',
          color: '#22c55e',
          sortOrder: 1,
        }),
      ),
    ],
    hosts: [
      asRecord(
        'hosts',
        await encryptHostInput(hostId, key, {
          groupId,
          name: 'db-1',
          hostname: '10.0.0.5',
          port: '2222',
          username: 'deploy',
          tags: ['db', 'prod'],
          color: '',
        }),
      ),
    ],
    identities: [
      asRecord(
        'identities',
        await encryptIdentityInput(identityId, key, {
          name: 'Deploy key',
          keyType: 'ed25519',
          publicKey: 'ssh-ed25519 AAAA',
          privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----',
        }),
      ),
    ],
    'host-credentials': [
      asRecord(
        'host-credentials',
        await encryptHostCredentialInput(credentialId, key, {
          hostId,
          identityId,
          label: 'Deploy',
          username: 'deploy',
          password: 'hunter2',
          privateKeyPassphrase: 'passphrase',
        }),
      ),
    ],
    snippets: [
      asRecord(
        'snippets',
        await encryptSnippetInput(snippetId, key, {
          title: 'Restart',
          body: 'sudo systemctl restart {{service}}',
          tags: ['ops'],
        }),
      ),
    ],
    tunnels: [
      asRecord(
        'tunnels',
        await encryptTunnelInput(tunnelId, key, {
          hostId,
          name: 'Postgres',
          config: {
            kind: 'local',
            bindHost: '127.0.0.1',
            bindPort: '5432',
            targetHost: 'db',
            targetPort: '5432',
          },
          enabled: true,
        }),
      ),
    ],
    'ai-settings': [
      asRecord(
        'ai-settings',
        await encryptAiSettingsInput(aiId, key, {
          ...defaultAiSettingsInput(),
          model: 'claude',
          apiKey: 'sk-test',
        }),
      ),
    ],
  }
}

/** In-memory server that applies a rotation the way the backend does. */
function fakeServer(account: Account, records: Record<VaultResourceType, VaultRecord[]>) {
  const state = {
    material: { ...account.material },
    vaultVersion: 1,
    records,
    requests: [] as MasterPasswordChangeRequest[],
    fail: null as Error | null,
  }
  const api: RotationApi = {
    listVaultRecords: vi.fn(async (type: VaultResourceType) =>
      state.records[type].map((record) => ({ ...record })),
    ),
    changeMasterPassword: vi.fn(
      async (payload: MasterPasswordChangeRequest): Promise<MasterPasswordChangeResponse> => {
        state.requests.push(payload)
        if (state.fail !== null) throw state.fail
        if (payload.vault_version !== state.vaultVersion) throw new Error('409 stale')
        for (const item of payload.items) {
          const list = state.records[item.type]
          const index = list.findIndex((record) => record.id === item.id)
          if (index < 0) throw new Error('409 unknown record')
          list[index] = { ...list[index], ...item.fields }
        }
        state.vaultVersion += 1
        state.material = {
          ...state.material,
          kdf_salt: payload.new_kdf_salt,
          kdf_params: payload.new_kdf_params,
          private_key_ciphertext: payload.private_key_ciphertext,
          private_key_nonce: payload.private_key_nonce,
          vault_version: state.vaultVersion,
          private_key_ad_version: 2,
        }
        return { vault_version: state.vaultVersion, vault: state.material }
      },
    ),
  }
  return { api, state }
}

function rotationInput(account: Account, api: RotationApi) {
  return {
    api,
    owner: account.owner,
    material: account.material,
    vaultVersion: 1,
    currentMasterPassword: OLD_MASTER,
    newMasterPassword: NEW_MASTER,
    currentPassword: LOGIN_PASSWORD,
    twoFactorCode: '123456',
    refreshToken: REFRESH_TOKEN,
  }
}

beforeEach(() => {
  useVault.getState().lock()
  useTeamScope.getState().setPersonalScope()
})

afterEach(() => {
  useVault.getState().lock()
})

describe('master-password rotation (end to end)', () => {
  it('re-encrypts every record and the private key so only the new password unlocks', async () => {
    const account = await registerMaterial()
    const records = await populate(account.key)
    const originals = {
      group: await decryptGroup(records.groups[0], account.key),
      host: await decryptHost(records.hosts[0], account.key),
      identity: await decryptIdentity(records.identities[0], account.key),
      credential: await decryptHostCredential(records['host-credentials'][0], account.key),
      snippet: await decryptSnippet(records.snippets[0], account.key),
      tunnel: await decryptTunnel(records.tunnels[0], account.key),
      ai: await decryptAiSettings(records['ai-settings'][0], account.key),
    }
    const { api, state } = fakeServer(account, records)

    const result = await rotateMasterPassword(rotationInput(account, api))

    // The request is complete, versioned and carries step-up credentials.
    expect(state.requests).toHaveLength(1)
    const request = state.requests[0]
    expect(request.vault_version).toBe(1)
    expect(request.current_password).toBe(LOGIN_PASSWORD)
    expect(request.two_factor_code).toBe('123456')
    expect(request.current_refresh_token).toBe(REFRESH_TOKEN)
    expect(request.new_kdf_params).toEqual(DEFAULT_KDF_PARAMS)
    expect((await fromBase64(request.new_kdf_salt)).length).toBe(16)
    expect(request.new_kdf_salt).not.toBe(account.material.kdf_salt)
    expect(request.items).toHaveLength(7)
    for (const item of request.items) {
      expect(item.updated_at).toBe('2026-11-02T10:00:00+00:00')
      const original = Object.values(records)
        .flat()
        .find((record) => record.id === item.id)
      expect(original).toBeDefined()
    }
    // Every non-null encrypted column of every record was replaced.
    const snippetItem = request.items.find((item) => item.type === 'snippets')
    expect(Object.keys(snippetItem?.fields ?? {}).sort()).toEqual([
      'body_ciphertext',
      'body_nonce',
      'tags_ciphertext',
      'tags_nonce',
      'title_ciphertext',
      'title_nonce',
      'variables_ciphertext',
      'variables_nonce',
    ])

    expect(result.vaultVersion).toBe(2)
    expect(result.itemCount).toBe(7)
    expect(result.material.private_key_ciphertext).toBe(request.private_key_ciphertext)

    // Fresh device: derive from the new password and the new salt.
    const newKey = await deriveVaultKey(
      NEW_MASTER,
      await fromBase64(result.material.kdf_salt),
      DEFAULT_KDF_PARAMS,
    )
    expect(Array.from(newKey)).toEqual(Array.from(result.key))
    const privateKey = await decrypt(
      { v: 1, ct: result.material.private_key_ciphertext, n: result.material.private_key_nonce },
      newKey,
      userPrivateKeyAd(account.owner.id),
    )
    expect(Array.from(privateKey)).toEqual(Array.from(account.privateKey))
    await expect(
      decrypt(
        { v: 1, ct: result.material.private_key_ciphertext, n: result.material.private_key_nonce },
        account.key,
        userPrivateKeyAd(account.owner.id),
      ),
    ).rejects.toThrow()

    expect(await decryptGroup(state.records.groups[0], newKey)).toEqual(originals.group)
    expect(await decryptHost(state.records.hosts[0], newKey)).toEqual(originals.host)
    expect(await decryptIdentity(state.records.identities[0], newKey)).toEqual(originals.identity)
    expect(await decryptHostCredential(state.records['host-credentials'][0], newKey)).toEqual(
      originals.credential,
    )
    expect(await decryptSnippet(state.records.snippets[0], newKey)).toEqual(originals.snippet)
    expect(await decryptTunnel(state.records.tunnels[0], newKey)).toEqual(originals.tunnel)
    expect(await decryptAiSettings(state.records['ai-settings'][0], newKey)).toEqual(originals.ai)
    await expect(decryptHost(state.records.hosts[0], account.key)).rejects.toThrow()

    // Unlock canary: new password works, old password does not.
    useVault.getState().setMaterial(result.material)
    await useVault.getState().unlock(NEW_MASTER, account.owner)
    expect(useVault.getState().isLocked).toBe(false)
    useVault.getState().lock()
    await expect(useVault.getState().unlock(OLD_MASTER, account.owner)).rejects.toThrow(
      /Incorrect master password/,
    )
    expect(useVault.getState().isLocked).toBe(true)
  }, 60_000)

  it('refuses to rotate with the wrong current master password and sends nothing', async () => {
    const account = await registerMaterial()
    const { api } = fakeServer(account, await populate(account.key))

    await expect(
      rotateMasterPassword({ ...rotationInput(account, api), currentMasterPassword: 'wrong' }),
    ).rejects.toThrow(/Incorrect master password/)
    expect(api.changeMasterPassword).not.toHaveBeenCalled()
  }, 60_000)

  it('refuses to rotate records it cannot treat as personal', async () => {
    const account = await registerMaterial()
    const records = await populate(account.key)
    records.hosts[0] = { ...records.hosts[0], team_id: 'team_01' }
    const { api } = fakeServer(account, records)

    await expect(rotateMasterPassword(rotationInput(account, api))).rejects.toThrow()
    expect(api.changeMasterPassword).not.toHaveBeenCalled()
  }, 60_000)

  it('keeps the old key usable when the server rejects the rotation', async () => {
    const account = await registerMaterial()
    const records = await populate(account.key)
    const { api, state } = fakeServer(account, records)
    useVault.getState().setMaterial(account.material)
    await useVault.getState().unlock(OLD_MASTER, account.owner)
    const keyBefore = useVault.getState().key
    state.fail = new Error('The vault changed on another device.')

    await expect(rotateMasterPassword(rotationInput(account, api))).rejects.toThrow(
      /changed on another device/,
    )

    expect(useVault.getState().isLocked).toBe(false)
    expect(useVault.getState().key).toBe(keyBefore)
    const host = await decryptHost(state.records.hosts[0], useVault.getState().key as Uint8Array)
    expect(host.name).toBe('db-1')
  }, 60_000)

  it('replaceKey adopts the rotated key and wipes the previous one', async () => {
    const account = await registerMaterial()
    useVault.getState().setMaterial(account.material)
    await useVault.getState().unlock(OLD_MASTER, account.owner)
    const oldKey = useVault.getState().key as Uint8Array
    const { api } = fakeServer(account, await populate(account.key))

    const result = await rotateMasterPassword(rotationInput(account, api))
    useVault.getState().replaceKey(result.key, result.material)

    expect(useVault.getState().key).toBe(result.key)
    expect(useVault.getState().vaultVersion).toBe(2)
    expect(useVault.getState().material).toEqual(result.material)
    expect(Array.from(oldKey).every((byte) => byte === 0)).toBe(true)
  }, 60_000)

  it('locks another unlocked device when its material changes to a new KDF salt', async () => {
    const account = await registerMaterial()
    useVault.getState().setMaterial(account.material)
    await useVault.getState().unlock(OLD_MASTER, account.owner)
    const staleKey = useVault.getState().key as Uint8Array
    const { api } = fakeServer(account, await populate(account.key))
    const result = await rotateMasterPassword(rotationInput(account, api))

    // Another device later receives the rotated material from /me.
    useVault.getState().setMaterial(result.material)

    expect(useVault.getState().isLocked).toBe(true)
    expect(useVault.getState().key).toBeNull()
    expect(Array.from(staleKey).every((byte) => byte === 0)).toBe(true)
    expect(useVault.getState().vaultVersion).toBe(2)
  }, 60_000)
})
