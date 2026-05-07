/* Trominal — Design system showcase artboards */

const { Icon, Button, Input, Field, Badge, Dot, Logo, Card, Kbd, Toggle, SideItem, SectionLabel } =
  trPrim

// ---------- Color tokens ----------
const Swatch = ({ name, value, mono = true, size = 56, dark }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div
      style={{
        height: size,
        borderRadius: 'var(--r-3)',
        background: value,
        border: '1px solid var(--border)',
      }}
    />
    <div>
      <div className="mono" style={{ fontSize: 11, color: 'var(--fg)' }}>
        {name}
      </div>
      <div className="mono" style={{ fontSize: 10, color: 'var(--fg-faint)' }}>
        {value}
      </div>
    </div>
  </div>
)

const ColorTokens = () => (
  <div
    style={{
      padding: 28,
      background: 'var(--bg)',
      color: 'var(--fg)',
      fontFamily: 'var(--font-ui)',
      fontSize: 13,
      minHeight: 600,
    }}
  >
    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Color tokens</h2>
    <p style={{ margin: '4px 0 24px', fontSize: 13, color: 'var(--fg-muted)' }}>
      Warm-charcoal dark theme. All semantic tokens map to dark + light.
    </p>

    <div
      style={{
        fontSize: 11,
        color: 'var(--fg-faint)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: 10,
      }}
    >
      Surfaces
    </div>
    <div
      style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 28 }}
    >
      <Swatch name="--bg" value="#0e0d0b" />
      <Swatch name="--bg-elev" value="#15140f" />
      <Swatch name="--surface" value="#1c1a14" />
      <Swatch name="--surface-2" value="#24211a" />
      <Swatch name="--surface-3" value="#2d2922" />
      <Swatch name="--border-strong" value="#3a352d" />
    </div>

    <div
      style={{
        fontSize: 11,
        color: 'var(--fg-faint)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: 10,
      }}
    >
      Text
    </div>
    <div
      style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}
    >
      <Swatch name="--fg" value="#e7e2d4" />
      <Swatch name="--fg-muted" value="#a39d8a" />
      <Swatch name="--fg-faint" value="#6e6957" />
      <Swatch name="--fg-dim" value="#4a463a" />
    </div>

    <div
      style={{
        fontSize: 11,
        color: 'var(--fg-faint)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: 10,
      }}
    >
      Semantic
    </div>
    <div
      style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}
    >
      <Swatch name="--accent (primary)" value="#7dd3a0" />
      <Swatch name="--danger" value="#f17a7a" />
      <Swatch name="--warning" value="#e0b870" />
      <Swatch name="--info" value="#7aa2f7" />
    </div>

    <div
      style={{
        fontSize: 11,
        color: 'var(--fg-faint)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: 10,
      }}
    >
      Terminal ANSI palette
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8 }}>
      {['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'].map((c) => (
        <Swatch key={c} name={c} value={`var(--ansi-${c})`} size={40} />
      ))}
      {[
        'bright-black',
        'bright-red',
        'bright-green',
        'bright-yellow',
        'bright-blue',
        'bright-magenta',
        'bright-cyan',
        'bright-white',
      ].map((c) => (
        <Swatch key={c} name={c.replace('bright-', 'b·')} value={`var(--ansi-${c})`} size={40} />
      ))}
    </div>
  </div>
)

// ---------- Type scale ----------
const TypeScale = () => (
  <div
    style={{
      padding: 28,
      background: 'var(--bg)',
      color: 'var(--fg)',
      fontFamily: 'var(--font-ui)',
      minHeight: 600,
    }}
  >
    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Typography</h2>
    <p style={{ margin: '4px 0 24px', fontSize: 13, color: 'var(--fg-muted)' }}>
      JetBrains Mono for code, addresses, identifiers. system-ui for everything else.
    </p>

    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '120px 1fr 100px',
        gap: 16,
        alignItems: 'baseline',
        borderBottom: '1px solid var(--border)',
        paddingBottom: 14,
        marginBottom: 14,
      }}
    >
      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
        Display · 24/600
      </span>
      <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em' }}>
        Connect to your Trominal server
      </span>
      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
        system-ui
      </span>
    </div>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '120px 1fr 100px',
        gap: 16,
        alignItems: 'baseline',
        borderBottom: '1px solid var(--border)',
        paddingBottom: 14,
        marginBottom: 14,
      }}
    >
      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
        Heading · 18/600
      </span>
      <span style={{ fontSize: 18, fontWeight: 600 }}>Production hosts</span>
      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
        system-ui
      </span>
    </div>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '120px 1fr 100px',
        gap: 16,
        alignItems: 'baseline',
        borderBottom: '1px solid var(--border)',
        paddingBottom: 14,
        marginBottom: 14,
      }}
    >
      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
        Body · 13/400
      </span>
      <span style={{ fontSize: 13 }}>
        Trominal is self-hosted. Point this client at your server's API URL to get started.
      </span>
      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
        system-ui
      </span>
    </div>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '120px 1fr 100px',
        gap: 16,
        alignItems: 'baseline',
        borderBottom: '1px solid var(--border)',
        paddingBottom: 14,
        marginBottom: 14,
      }}
    >
      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
        Caption · 12/400
      </span>
      <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>Last connected 2 minutes ago</span>
      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
        system-ui
      </span>
    </div>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '120px 1fr 100px',
        gap: 16,
        alignItems: 'baseline',
        borderBottom: '1px solid var(--border)',
        paddingBottom: 14,
        marginBottom: 14,
      }}
    >
      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
        Label · 11/600 · uppercase
      </span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--fg-faint)',
        }}
      >
        Authentication
      </span>
      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
        system-ui
      </span>
    </div>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '120px 1fr 100px',
        gap: 16,
        alignItems: 'baseline',
        borderBottom: '1px solid var(--border)',
        paddingBottom: 14,
        marginBottom: 14,
      }}
    >
      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
        Code · 13/400
      </span>
      <span className="mono" style={{ fontSize: 13 }}>
        ssh deploy@10.0.4.21 -i ~/.ssh/acme-deploy
      </span>
      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
        JetBrains Mono
      </span>
    </div>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '120px 1fr 100px',
        gap: 16,
        alignItems: 'baseline',
        paddingBottom: 14,
      }}
    >
      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
        Mono caption · 11/400
      </span>
      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-muted)' }}>
        SHA256:7Hd9k3LpQa+vRz0xT8fNjW4mC2eYsB1KvUgX6oP/r8E
      </span>
      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
        JetBrains Mono
      </span>
    </div>
  </div>
)

// ---------- Components showcase ----------
const ComponentsShowcase = () => (
  <div
    style={{
      padding: 28,
      background: 'var(--bg)',
      color: 'var(--fg)',
      fontFamily: 'var(--font-ui)',
      fontSize: 13,
      minHeight: 700,
    }}
  >
    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Components</h2>
    <p style={{ margin: '4px 0 24px', fontSize: 13, color: 'var(--fg-muted)' }}>
      Atomic primitives — buttons, inputs, badges, status, sidebar bits.
    </p>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
      <div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--fg-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 10,
          }}
        >
          Buttons
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <Button variant="primary">Primary</Button>
          <Button variant="default">Default</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="subtle">Subtle</Button>
          <Button variant="danger">Danger</Button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <Button variant="primary" icon="plus">
            New host
          </Button>
          <Button variant="outline" icon="download">
            Import
          </Button>
          <Button variant="primary" iconRight="arrow_right">
            Connect
          </Button>
          <Button variant="outline" kbd="⌘K">
            Search
          </Button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Button variant="primary" size="sm">
            Small
          </Button>
          <Button variant="primary" size="md">
            Medium
          </Button>
          <Button variant="primary" size="lg">
            Large
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>

        <div
          style={{
            fontSize: 11,
            color: 'var(--fg-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            margin: '24px 0 10px',
          }}
        >
          Inputs
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}>
          <Input label="Address" mono value="10.0.4.21" icon="server" />
          <Input
            label="Master password"
            mono
            placeholder="Enter password…"
            icon="key"
            suffix={<Icon name="eye" size={14} color="var(--fg-faint)" />}
          />
          <Input
            label="Email"
            type="email"
            value="not-an-email"
            icon="mail"
            error
            hint="Enter a valid email."
          />
        </div>

        <div
          style={{
            fontSize: 11,
            color: 'var(--fg-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            margin: '24px 0 10px',
          }}
        >
          Badges & status
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          <Badge tone="neutral">neutral</Badge>
          <Badge tone="accent">accent</Badge>
          <Badge tone="danger">danger</Badge>
          <Badge tone="warning">warning</Badge>
          <Badge tone="info">info</Badge>
          <Badge tone="outline" mono>
            ed25519
          </Badge>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Dot state="connected" /> Connected
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Dot state="connecting" /> Connecting
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Dot state="error" /> Error
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Dot state="idle" /> Idle
          </span>
        </div>

        <div
          style={{
            fontSize: 11,
            color: 'var(--fg-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            margin: '24px 0 10px',
          }}
        >
          Toggles, kbd
        </div>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          <Toggle on label="On" />
          <Toggle label="Off" />
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>{' '}
            <span style={{ color: 'var(--fg-faint)', fontSize: 12, marginLeft: 4 }}>Search</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Kbd>⌘</Kbd>
            <Kbd>N</Kbd>{' '}
            <span style={{ color: 'var(--fg-faint)', fontSize: 12, marginLeft: 4 }}>New</span>
          </span>
        </div>
      </div>

      <div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--fg-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 10,
          }}
        >
          Sidebar
        </div>
        <div
          style={{
            width: 220,
            background: 'var(--bg-elev)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-3)',
            padding: 8,
          }}
        >
          <SideItem icon="server" label="Hosts" active badge={14} />
          <SideItem icon="code" label="Snippets" badge={8} />
          <SideItem icon="key" label="Identities" badge={4} />
          <SideItem icon="tunnel" label="Tunnels" badge={3} />
          <SectionLabel>Groups</SectionLabel>
          <SideItem icon="folder" label="Production" badge={6} color="#f17a7a" />
          <SideItem icon="folder" label="Staging" badge={4} color="#e0b870" />
        </div>

        <div
          style={{
            fontSize: 11,
            color: 'var(--fg-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            margin: '24px 0 10px',
          }}
        >
          Toast
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Card
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, maxWidth: 360 }}
          >
            <Icon name="check" size={14} color="var(--accent)" />
            <div style={{ flex: 1, fontSize: 12 }}>Host saved · web-01.prod</div>
            <Icon name="x" size={12} color="var(--fg-faint)" />
          </Card>
          <Card
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: 12,
              maxWidth: 360,
              borderColor: 'var(--danger)',
            }}
          >
            <Icon name="x" size={14} color="var(--danger)" />
            <div style={{ flex: 1, fontSize: 12 }}>Connection refused · 10.0.4.21:22</div>
            <Icon name="x" size={12} color="var(--fg-faint)" />
          </Card>
        </div>

        <div
          style={{
            fontSize: 11,
            color: 'var(--fg-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            margin: '24px 0 10px',
          }}
        >
          Dropdown
        </div>
        <div
          style={{
            width: 220,
            background: 'var(--bg-elev)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--r-3)',
            boxShadow: 'var(--sh-3)',
            padding: 4,
          }}
        >
          {[
            { icon: 'terminal', label: 'Open terminal', kbd: '⏎' },
            { icon: 'folder', label: 'Open SFTP', kbd: '⌘F' },
            { icon: 'code', label: 'Run snippet…', kbd: '⌘R' },
          ].map((it, i) => (
            <div
              key={i}
              style={{
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderRadius: 'var(--r-2)',
                background: i === 0 ? 'var(--surface-3)' : 'transparent',
              }}
            >
              <Icon name={it.icon} size={13} />
              <span style={{ flex: 1, fontSize: 12 }}>{it.label}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
                {it.kbd}
              </span>
            </div>
          ))}
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          <div
            style={{
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--danger)',
            }}
          >
            <Icon name="trash" size={13} />
            <span style={{ flex: 1, fontSize: 12 }}>Delete host</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
              ⌫
            </span>
          </div>
        </div>

        <div
          style={{
            fontSize: 11,
            color: 'var(--fg-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            margin: '24px 0 10px',
          }}
        >
          Spacing & radius
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--fg-muted)', lineHeight: 1.7 }}>
          space: 2 · 4 · 6 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56
          <br />
          radius: 0 · 2 · 4 · 6 · 8 · 999
          <br />
          shadow: sh-1 (subtle) · sh-2 (popover) · sh-3 (modal/drawer)
        </div>
      </div>
    </div>
  </div>
)

// ---------- Light mode hosts (mini) ----------
const LightHostsSample = () => (
  <div
    data-theme="light"
    style={{
      background: 'var(--bg)',
      color: 'var(--fg)',
      fontFamily: 'var(--font-ui)',
      padding: 0,
      minHeight: 600,
      display: 'flex',
      flexDirection: 'column',
    }}
  >
    <div
      style={{
        height: 40,
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        gap: 10,
        background: 'var(--bg-elev)',
      }}
    >
      <Logo size={13} />
      <div style={{ flex: 1 }} />
      <Badge tone="outline" mono>
        <Icon name="unlock" size={11} style={{ marginRight: 4 }} />
        unlocked
      </Badge>
    </div>
    <div style={{ flex: 1, display: 'flex' }}>
      <div
        style={{
          width: 200,
          background: 'var(--bg-elev)',
          borderRight: '1px solid var(--border)',
          padding: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 28,
            padding: '0 10px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-3)',
            fontSize: 12,
            color: 'var(--fg-faint)',
            marginBottom: 10,
          }}
        >
          <Icon name="search" size={12} />
          <span style={{ flex: 1 }}>Search</span>
          <Kbd>⌘K</Kbd>
        </div>
        <SideItem icon="server" label="Hosts" active badge={14} />
        <SideItem icon="code" label="Snippets" badge={8} />
        <SideItem icon="key" label="Identities" badge={4} />
        <SideItem icon="tunnel" label="Tunnels" badge={3} />
      </div>
      <div style={{ flex: 1, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 14, fontWeight: 500 }}>Production</span>
          <span style={{ fontSize: 11, color: 'var(--fg-faint)' }}>4 hosts · 2 connected</span>
          <div style={{ flex: 1 }} />
          <Button variant="primary" icon="plus" size="md">
            New host
          </Button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {[
            { name: 'web-01.prod', addr: '10.0.4.21', user: 'deploy', state: 'connected' },
            { name: 'web-02.prod', addr: '10.0.4.22', user: 'deploy', state: 'connected' },
            { name: 'db-primary', addr: 'db.prod.acme', user: 'postgres', state: 'idle' },
            { name: 'db-replica-01', addr: '10.0.6.11', user: 'postgres', state: 'connecting' },
          ].map((h) => (
            <Card key={h.name} hover>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 'var(--r-2)',
                    background: '#c64545' + '22',
                    color: '#c64545',
                    border: '1px solid #c6454540',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="server" size={13} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{h.name}</span>
                    <Dot state={h.state} size={6} />
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
                    {h.user}@{h.addr}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <Badge tone="outline" mono>
                  nginx
                </Badge>
                <Badge tone="outline" mono>
                  us-east
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  </div>
)

const LightAuthSample = () => (
  <div
    data-theme="light"
    style={{
      background:
        'radial-gradient(800px 400px at 50% -10%, rgba(47,138,91,0.06), transparent 60%), var(--bg)',
      color: 'var(--fg)',
      fontFamily: 'var(--font-ui)',
      minHeight: 600,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}
  >
    <div style={{ width: 360, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Logo size={15} />
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Sign in</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--fg-muted)' }}>Welcome back.</p>
      </div>
      <Input label="Email" value="riley@acme.io" icon="mail" />
      <Input label="Password" value="••••••••••••" icon="lock" />
      <Button variant="primary" full size="lg">
        Sign in
      </Button>
      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--fg-faint)' }}>
        <span style={{ color: 'var(--accent)' }}>Connect to a different server →</span>
      </div>
    </div>
  </div>
)

Object.assign(window, {
  ColorTokens,
  TypeScale,
  ComponentsShowcase,
  LightHostsSample,
  LightAuthSample,
})
