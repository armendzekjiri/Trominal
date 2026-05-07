/* Trominal — Settings + state screens (Locked overlay, Light mode samples) */

const {
  Icon,
  Button,
  Input,
  Field,
  Badge,
  Dot,
  AppFrame,
  Kbd,
  Card,
  Toggle,
  SideItem,
  SectionLabel,
} = trPrim

// Settings sub-nav
const SettingsLayout = ({ active, children }) => {
  const items = [
    { id: 'connection', icon: 'server', label: 'Connection' },
    { id: 'account', icon: 'user', label: 'Account' },
    { id: 'ai', icon: 'sparkles', label: 'AI' },
    { id: 'appearance', icon: 'monitor', label: 'Appearance' },
    { id: 'keys', icon: 'kbd', label: 'Shortcuts' },
    { id: 'advanced', icon: 'settings', label: 'Advanced' },
    { id: 'about', icon: 'shield', label: 'About' },
  ]
  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <div
        style={{
          width: 200,
          borderRight: '1px solid var(--border)',
          background: 'var(--bg-elev)',
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <SectionLabel>Settings</SectionLabel>
        {items.map((i) => (
          <SideItem key={i.id} icon={i.icon} label={i.label} active={active === i.id} />
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>{children}</div>
    </div>
  )
}

const SettingsRow = ({ label, hint, children, danger }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '260px 1fr',
      gap: 24,
      padding: '16px 0',
      borderTop: '1px solid var(--border-subtle)',
    }}
  >
    <div>
      <div style={{ fontSize: 13, fontWeight: 500, color: danger ? 'var(--danger)' : 'var(--fg)' }}>
        {label}
      </div>
      {hint && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--fg-muted)',
            marginTop: 4,
            lineHeight: 1.5,
            maxWidth: 240,
          }}
        >
          {hint}
        </div>
      )}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
      {children}
    </div>
  </div>
)

const SettingsHeader = ({ title, sub }) => (
  <div style={{ padding: '20px 28px 14px', borderBottom: '1px solid var(--border)' }}>
    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{title}</h2>
    <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--fg-muted)' }}>{sub}</p>
  </div>
)

// ---------- 15. Settings — Connection ----------
const ScreenSettingsConnection = () => (
  <AppFrame title="trominal — settings" style={{ width: 1280, height: 800 }}>
    <AppShell active="settings">
      <SettingsLayout active="connection">
        <SettingsHeader
          title="Connection"
          sub="Where this client talks to. Changing the server signs you out."
        />
        <div style={{ padding: '0 28px 28px' }}>
          <SettingsRow
            label="Server URL"
            hint="The Trominal server's API endpoint. Must be reachable over HTTPS."
          >
            <div style={{ display: 'flex', gap: 8, width: 480 }}>
              <Input mono value="https://trominal.acme.internal" icon="server" />
              <Button variant="outline" icon="check">
                Test
              </Button>
            </div>
            <Badge tone="accent" dot>
              Reachable · v1.4.2 · 38 ms
            </Badge>
          </SettingsRow>
          <SettingsRow
            label="Verify TLS certificate"
            hint="Reject connections to servers with invalid or expired certificates."
          >
            <Toggle on label="Strict TLS verification" />
          </SettingsRow>
          <SettingsRow
            label="Connection timeout"
            hint="Cancel server requests that take longer than this."
          >
            <Input
              mono
              value="30 seconds"
              style={{ width: 200 }}
              suffix={<Icon name="chevron_down" size={12} color="var(--fg-faint)" />}
            />
          </SettingsRow>
          <SettingsRow
            label="Proxy"
            hint="Optional HTTP/SOCKS proxy used for client → server traffic."
          >
            <Input mono placeholder="None — using system proxy" style={{ width: 480 }} />
          </SettingsRow>
          <SettingsRow
            label="Disconnect"
            hint="Sign out of this server and forget the cached vault on this device."
            danger
          >
            <Button variant="danger" icon="power">
              Disconnect from server
            </Button>
          </SettingsRow>
        </div>
      </SettingsLayout>
    </AppShell>
  </AppFrame>
)

// ---------- 16. Settings — Account ----------
const ScreenSettingsAccount = () => {
  const devices = [
    { name: 'MacBook Pro · this device', os: 'macOS 15.4', last: 'now', current: true },
    { name: 'Linux workstation', os: 'Ubuntu 24.04', last: '2h ago' },
    { name: 'Web · Firefox', os: 'macOS 15.4', last: 'yesterday' },
    { name: 'iPad', os: 'iPadOS 18', last: '3 weeks ago' },
  ]
  return (
    <AppFrame title="trominal — settings · account" style={{ width: 1280, height: 800 }}>
      <AppShell active="settings">
        <SettingsLayout active="account">
          <SettingsHeader
            title="Account"
            sub="Email, master password, two-factor, and signed-in devices."
          />
          <div style={{ padding: '0 28px 28px' }}>
            <SettingsRow label="Email" hint="Used for login and recovery codes.">
              <Input value="riley@acme.io" icon="mail" style={{ width: 360 }} />
            </SettingsRow>
            <SettingsRow
              label="Master password"
              hint="Encrypts your vault. Changing it re-encrypts all data and signs out other devices."
            >
              <Button variant="outline" icon="key">
                Change master password
              </Button>
            </SettingsRow>
            <SettingsRow
              label="Two-factor authentication"
              hint="Required at sign-in. Keep recovery codes in a safe place."
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Badge tone="accent" dot>
                  Enabled · TOTP
                </Badge>
                <Button variant="ghost" size="sm">
                  View recovery codes
                </Button>
                <Button variant="ghost" size="sm">
                  Reset
                </Button>
              </div>
            </SettingsRow>
            <SettingsRow
              label="Signed-in devices"
              hint="Each device caches an encrypted copy of your vault. Revoke any you don't recognize."
            >
              <Card padded={false} style={{ width: '100%', maxWidth: 560 }}>
                {devices.map((d, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      borderBottom:
                        i < devices.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    }}
                  >
                    <Icon name="monitor" size={14} color="var(--fg-muted)" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{d.name}</div>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
                        {d.os} · last seen {d.last}
                      </div>
                    </div>
                    {d.current ? (
                      <Badge tone="accent">this device</Badge>
                    ) : (
                      <Button variant="ghost" size="sm" style={{ color: 'var(--danger)' }}>
                        Revoke
                      </Button>
                    )}
                  </div>
                ))}
              </Card>
            </SettingsRow>
            <SettingsRow
              label="Delete account"
              hint="Permanently erase your vault from the server. This cannot be undone."
              danger
            >
              <Button variant="danger" icon="trash">
                Delete account
              </Button>
            </SettingsRow>
          </div>
        </SettingsLayout>
      </AppShell>
    </AppFrame>
  )
}

// ---------- 17. Settings — AI ----------
const ScreenSettingsAi = () => (
  <AppFrame title="trominal — settings · ai" style={{ width: 1280, height: 800 }}>
    <AppShell active="settings">
      <SettingsLayout active="ai">
        <SettingsHeader
          title="AI"
          sub="Bring your own key. API calls go from this client directly to the provider — never through the Trominal server."
        />
        <div style={{ padding: '0 28px 28px' }}>
          <SettingsRow label="Provider" hint="Pick where AI requests are sent.">
            <div
              style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, width: 560 }}
            >
              {[
                { id: 'anthropic', label: 'Anthropic', sub: 'claude-sonnet-4.5', active: true },
                { id: 'openai', label: 'OpenAI', sub: 'gpt-4o' },
                { id: 'ollama', label: 'Ollama', sub: 'local' },
                { id: 'custom', label: 'Custom', sub: 'OpenAI-compat' },
              ].map((p) => (
                <div
                  key={p.id}
                  style={{
                    padding: 12,
                    borderRadius: 'var(--r-3)',
                    background: p.active ? 'var(--accent-soft)' : 'var(--surface)',
                    border: `1px solid ${p.active ? 'var(--accent)' : 'var(--border)'}`,
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: p.active ? 'var(--accent)' : 'var(--fg)',
                    }}
                  >
                    {p.label}
                  </div>
                  <div
                    className="mono"
                    style={{ fontSize: 10, color: 'var(--fg-faint)', marginTop: 2 }}
                  >
                    {p.sub}
                  </div>
                </div>
              ))}
            </div>
          </SettingsRow>
          <SettingsRow
            label="Endpoint URL"
            hint="Override for self-hosted or proxy gateways. Leave blank for the provider default."
          >
            <Input mono value="https://api.anthropic.com/v1" style={{ width: 480 }} />
          </SettingsRow>
          <SettingsRow label="Model">
            <Input
              mono
              value="claude-sonnet-4.5"
              suffix={<Icon name="chevron_down" size={12} color="var(--fg-faint)" />}
              style={{ width: 360 }}
            />
          </SettingsRow>
          <SettingsRow
            label="API key"
            hint="Stored in your local vault, encrypted with your master password. Never sent to the Trominal server."
          >
            <Input
              mono
              value="sk-ant-•••••••••••••••••••••••••••••"
              icon="key"
              suffix={<Icon name="eye_off" size={14} color="var(--fg-faint)" />}
              style={{ width: 480 }}
            />
            <div
              style={{
                fontSize: 11,
                color: 'var(--fg-faint)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Icon name="check" size={11} color="var(--accent)" /> Verified · 4 models available
            </div>
          </SettingsRow>
          <SettingsRow label="Features" hint="Toggle individual AI capabilities.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: 480 }}>
                <Toggle on />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>Inline ghost-text completion</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
                    Suggest commands as you type. Tab to accept.
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: 480 }}>
                <Toggle on />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>Ask AI panel</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
                    Slide-in chat with terminal context.
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: 480 }}>
                <Toggle on />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>"Explain command" right-click</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
                    Highlight any command, right-click to get a plain-English explanation.
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: 480 }}>
                <Toggle />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>Send terminal output as context</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
                    Includes the last 50 lines with each request. Disable for sensitive sessions.
                  </div>
                </div>
              </div>
            </div>
          </SettingsRow>
        </div>
      </SettingsLayout>
    </AppShell>
  </AppFrame>
)

// ---------- 18. Settings — Appearance ----------
const ScreenSettingsAppearance = () => (
  <AppFrame title="trominal — settings · appearance" style={{ width: 1280, height: 800 }}>
    <AppShell active="settings">
      <SettingsLayout active="appearance">
        <SettingsHeader
          title="Appearance"
          sub="Theme, terminal font, color scheme, and security timing."
        />
        <div style={{ padding: '0 28px 28px' }}>
          <SettingsRow
            label="Theme"
            hint="Light follows your OS at sunrise/sunset when set to System."
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
                width: 480,
              }}
            >
              {[
                { label: 'Dark', bg: '#0e0d0b', fg: '#e7e2d4', active: true },
                { label: 'Light', bg: '#faf8f3', fg: '#1c1a14' },
                {
                  label: 'System',
                  bg: 'linear-gradient(90deg, #0e0d0b 0%, #0e0d0b 50%, #faf8f3 50%, #faf8f3 100%)',
                  fg: 'var(--fg)',
                },
              ].map((t) => (
                <div
                  key={t.label}
                  style={{
                    padding: 12,
                    borderRadius: 'var(--r-3)',
                    background: 'var(--surface)',
                    border: `1px solid ${t.active ? 'var(--accent)' : 'var(--border)'}`,
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      height: 48,
                      borderRadius: 'var(--r-2)',
                      background: t.bg,
                      marginBottom: 8,
                      border: '1px solid var(--border)',
                    }}
                  />
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{t.label}</div>
                </div>
              ))}
            </div>
          </SettingsRow>
          <SettingsRow
            label="Terminal font"
            hint="Used inside the terminal. The UI always uses your system font."
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <Input
                mono
                value="JetBrains Mono"
                suffix={<Icon name="chevron_down" size={12} color="var(--fg-faint)" />}
                style={{ width: 240 }}
              />
              <Input mono value="13 px" style={{ width: 100 }} />
            </div>
            <div
              className="mono"
              style={{
                padding: 12,
                background: 'var(--ansi-black)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-2)',
                fontSize: 13,
                color: 'var(--fg)',
                width: 480,
                marginTop: 4,
              }}
            >
              <span style={{ color: 'var(--ansi-green)' }}>$</span> echo{' '}
              <span style={{ color: 'var(--ansi-yellow)' }}>"the quick brown fox"</span> ·
              0123456789 ⇒ ≠
            </div>
          </SettingsRow>
          <SettingsRow label="Terminal color scheme">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 10,
                width: 560,
              }}
            >
              {[
                {
                  name: 'Trominal',
                  colors: ['#14130f', '#7dd3a0', '#e0b870', '#7aa2f7', '#c897e0', '#f17a7a'],
                  active: true,
                },
                {
                  name: 'Tokyo Night',
                  colors: ['#1a1b26', '#9ece6a', '#e0af68', '#7aa2f7', '#bb9af7', '#f7768e'],
                },
                {
                  name: 'Catppuccin',
                  colors: ['#1e1e2e', '#a6e3a1', '#f9e2af', '#89b4fa', '#cba6f7', '#f38ba8'],
                },
                {
                  name: 'Solarized',
                  colors: ['#002b36', '#859900', '#b58900', '#268bd2', '#d33682', '#dc322f'],
                },
              ].map((s) => (
                <div
                  key={s.name}
                  style={{
                    padding: 10,
                    borderRadius: 'var(--r-3)',
                    background: 'var(--surface)',
                    border: `1px solid ${s.active ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                    {s.colors.map((c, i) => (
                      <div
                        key={i}
                        style={{ flex: 1, height: 18, borderRadius: 2, background: c }}
                      />
                    ))}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: s.active ? 500 : 400 }}>{s.name}</div>
                </div>
              ))}
            </div>
          </SettingsRow>
          <SettingsRow
            label="Idle auto-lock"
            hint="Lock the vault automatically after this period of inactivity."
          >
            <div style={{ display: 'flex', gap: 6 }}>
              {['1 min', '5 min', '15 min', '30 min', '1 hr', 'Never'].map((v, i) => (
                <div
                  key={v}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--r-3)',
                    fontSize: 12,
                    background: i === 2 ? 'var(--accent-soft)' : 'var(--surface)',
                    color: i === 2 ? 'var(--accent)' : 'var(--fg-muted)',
                    border: `1px solid ${i === 2 ? 'var(--accent)' : 'var(--border)'}`,
                    cursor: 'pointer',
                  }}
                >
                  {v}
                </div>
              ))}
            </div>
          </SettingsRow>
          <SettingsRow label="UI density">
            <div style={{ display: 'flex', gap: 6 }}>
              {['Compact', 'Comfortable', 'Spacious'].map((v, i) => (
                <div
                  key={v}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--r-3)',
                    fontSize: 12,
                    background: i === 0 ? 'var(--accent-soft)' : 'var(--surface)',
                    color: i === 0 ? 'var(--accent)' : 'var(--fg-muted)',
                    border: `1px solid ${i === 0 ? 'var(--accent)' : 'var(--border)'}`,
                    cursor: 'pointer',
                  }}
                >
                  {v}
                </div>
              ))}
            </div>
          </SettingsRow>
        </div>
      </SettingsLayout>
    </AppShell>
  </AppFrame>
)

// ---------- 19. Auto-locked overlay ----------
const ScreenLocked = () => (
  <AppFrame title="trominal — locked" style={{ width: 1280, height: 800 }}>
    <AppShell active="hosts" locked>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Obscured app behind */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            padding: 18,
            filter: 'blur(6px) saturate(0.6)',
            opacity: 0.5,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Card key={i} style={{ height: 100 }}>
                <div
                  style={{
                    height: 12,
                    width: '60%',
                    background: 'var(--surface-2)',
                    borderRadius: 2,
                    marginBottom: 8,
                  }}
                />
                <div
                  style={{
                    height: 8,
                    width: '40%',
                    background: 'var(--surface-3)',
                    borderRadius: 2,
                  }}
                />
              </Card>
            ))}
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(10,9,7,0.65)',
            backdropFilter: 'blur(2px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            style={{
              width: 380,
              padding: 28,
              background: 'var(--bg-elev)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--r-4)',
              boxShadow: 'var(--sh-3)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 'var(--r-3)',
                background: 'var(--surface-2)',
                border: '1px solid var(--border-strong)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="lock" size={20} color="var(--accent)" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Vault locked</div>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 4 }}>
                Auto-locked after 15 minutes of inactivity.
              </div>
            </div>
            <Input
              label="Master password"
              mono
              value="•••••••••••••"
              icon="key"
              suffix={<Icon name="eye_off" size={14} color="var(--fg-faint)" />}
            />
            <Button variant="primary" full size="lg" icon="unlock">
              Unlock vault
            </Button>
            <div style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
              3 background tunnels paused · resume on unlock
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  </AppFrame>
)

// ---------- Light mode samples ----------
const ScreenLightHosts = () => (
  <div data-theme="light">
    <AppFrame title="trominal" style={{ width: 1180, height: 720 }}>
      <ScreenHostsList.Inner />
    </AppFrame>
  </div>
)

Object.assign(window, {
  ScreenSettingsConnection,
  ScreenSettingsAccount,
  ScreenSettingsAi,
  ScreenSettingsAppearance,
  ScreenLocked,
})
