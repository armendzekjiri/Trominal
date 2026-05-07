/* Trominal — App shell + Hosts screens */

const {
  Icon,
  Button,
  Input,
  Field,
  Badge,
  Dot,
  Logo,
  AppFrame,
  SideItem,
  SectionLabel,
  Card,
  Kbd,
} = trPrim

// ---------- App shell with sidebar ----------
const AppShell = ({
  active = 'hosts',
  collapsed = false,
  locked = false,
  children,
  hideTopbar,
}) => {
  const navItems = [
    { id: 'hosts', icon: 'server', label: 'Hosts', badge: 14 },
    { id: 'snippets', icon: 'code', label: 'Snippets', badge: 8 },
    { id: 'identities', icon: 'key', label: 'Identities', badge: 4 },
    { id: 'tunnels', icon: 'tunnel', label: 'Tunnels', badge: 3 },
    { id: 'sftp', icon: 'folder', label: 'SFTP' },
    { id: 'settings', icon: 'settings', label: 'Settings' },
  ]
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <div
        style={{
          width: collapsed ? 52 : 220,
          background: 'var(--bg-elev)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            padding: collapsed ? '12px 8px' : '12px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {collapsed ? (
            <span
              className="mono"
              style={{ color: 'var(--accent)', fontSize: 16, fontWeight: 600, margin: '0 auto' }}
            >
              {'>'}
            </span>
          ) : (
            <Logo size={13} />
          )}
        </div>
        {!collapsed && (
          <div style={{ padding: '0 10px 10px' }}>
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
              }}
            >
              <Icon name="search" size={13} />
              <span style={{ flex: 1 }}>Search</span>
              <Kbd>⌘K</Kbd>
            </div>
          </div>
        )}
        <div
          style={{
            padding: collapsed ? '0 6px' : '0 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {navItems.map((n) =>
            collapsed ? (
              <div
                key={n.id}
                title={n.label}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--r-3)',
                  background: active === n.id ? 'var(--surface-3)' : 'transparent',
                  color: active === n.id ? 'var(--fg)' : 'var(--fg-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  margin: '0 auto',
                  borderLeft: active === n.id ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                <Icon name={n.icon} size={16} />
              </div>
            ) : (
              <SideItem
                key={n.id}
                icon={n.icon}
                label={n.label}
                active={active === n.id}
                badge={n.badge}
              />
            ),
          )}
        </div>
        {!collapsed && (
          <>
            <SectionLabel style={{ marginTop: 18 }}>Groups</SectionLabel>
            <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
              <SideItem icon="folder" label="Production" badge={6} color="#f17a7a" />
              <SideItem icon="folder" label="Staging" badge={4} color="#e0b870" />
              <SideItem icon="folder" label="K8s nodes" badge={3} color="#7aa2f7" />
              <SideItem icon="folder" label="Personal" badge={1} color="#c897e0" />
            </div>
          </>
        )}
        <div style={{ marginTop: 'auto', padding: 10, borderTop: '1px solid var(--border)' }}>
          {collapsed ? (
            <div
              style={{
                width: 36,
                height: 36,
                margin: '0 auto',
                borderRadius: 'var(--r-3)',
                background: 'var(--surface-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span className="mono" style={{ fontSize: 11, fontWeight: 600 }}>
                RM
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 'var(--r-3)',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span className="mono" style={{ fontSize: 10, fontWeight: 600 }}>
                  RM
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  riley@acme.io
                </div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--fg-faint)' }}>
                  acme.internal
                </div>
              </div>
              <Icon name="chevron_right" size={12} color="var(--fg-faint)" />
            </div>
          )}
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {!hideTopbar && (
          <div
            style={{
              height: 40,
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              padding: '0 14px',
              gap: 10,
              background: 'var(--bg)',
              flexShrink: 0,
            }}
          >
            <Icon name="server" size={14} color="var(--fg-muted)" />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Hosts</span>
            <span style={{ color: 'var(--fg-dim)' }}>/</span>
            <span style={{ fontSize: 13, color: 'var(--fg-muted)' }}>All</span>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Badge tone="outline" mono>
                <Icon name={locked ? 'lock' : 'unlock'} size={11} style={{ marginRight: 4 }} />
                {locked ? 'locked' : 'unlocked'}
              </Badge>
              <Icon name="bolt" size={15} color="var(--fg-muted)" />
              <Icon name="sparkles" size={15} color="var(--fg-muted)" />
            </div>
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ---------- 6. Empty state — Hosts ----------
const ScreenHostsEmpty = () => (
  <AppFrame title="trominal" style={{ width: 1180, height: 720 }}>
    <AppShell active="hosts">
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
        }}
      >
        <div style={{ maxWidth: 380, textAlign: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 'var(--r-4)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 18,
            }}
          >
            <Icon name="server" size={22} color="var(--accent)" />
          </div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>No hosts yet</h2>
          <p
            style={{
              margin: '8px 0 22px',
              fontSize: 13,
              color: 'var(--fg-muted)',
              lineHeight: 1.5,
            }}
          >
            Add your first server to start connecting. You can also import from{' '}
            <span className="mono" style={{ color: 'var(--fg)' }}>
              ~/.ssh/config
            </span>
            .
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <Button variant="primary" icon="plus">
              New host
            </Button>
            <Button variant="outline" icon="download">
              Import ssh_config
            </Button>
          </div>
          <div
            className="mono"
            style={{
              marginTop: 28,
              fontSize: 11,
              color: 'var(--fg-faint)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Kbd>⌘</Kbd>
            <Kbd>N</Kbd> new host · <Kbd>⌘</Kbd>
            <Kbd>K</Kbd> command palette
          </div>
        </div>
      </div>
    </AppShell>
  </AppFrame>
)

// ---------- 7. Hosts list ----------
const HostCard = ({ name, addr, user, group, color, tags = [], state = 'idle', last }) => (
  <Card hover style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 'var(--r-2)',
          background: color + '22',
          color,
          border: `1px solid ${color}40`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name="server" size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </span>
          <Dot state={state} size={6} />
        </div>
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: 'var(--fg-faint)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {user}@{addr}
        </div>
      </div>
      <Icon name="more" size={14} color="var(--fg-faint)" />
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {tags.map((t) => (
        <Badge key={t} tone="outline" mono>
          {t}
        </Badge>
      ))}
    </div>
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 8,
        borderTop: '1px solid var(--border-subtle)',
      }}
    >
      <span style={{ fontSize: 11, color: 'var(--fg-faint)' }}>{last}</span>
      <span
        className="mono"
        style={{
          fontSize: 11,
          color: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        connect <Icon name="arrow_right" size={11} />
      </span>
    </div>
  </Card>
)

const ScreenHostsList = () => {
  const hosts = [
    {
      name: 'web-01.prod',
      addr: '10.0.4.21',
      user: 'deploy',
      color: '#f17a7a',
      tags: ['nginx', 'us-east'],
      state: 'connected',
      last: 'Connected · 2m ago',
    },
    {
      name: 'web-02.prod',
      addr: '10.0.4.22',
      user: 'deploy',
      color: '#f17a7a',
      tags: ['nginx', 'us-east'],
      state: 'connected',
      last: 'Connected · 14m ago',
    },
    {
      name: 'db-primary',
      addr: 'db.prod.acme',
      user: 'postgres',
      color: '#f17a7a',
      tags: ['postgres', 'primary'],
      state: 'idle',
      last: 'Last: yesterday',
    },
    {
      name: 'db-replica-01',
      addr: '10.0.6.11',
      user: 'postgres',
      color: '#f17a7a',
      tags: ['postgres', 'replica'],
      state: 'connecting',
      last: 'Connecting…',
    },
    {
      name: 'stage-app',
      addr: 'stage.acme.io',
      user: 'ubuntu',
      color: '#e0b870',
      tags: ['staging'],
      state: 'idle',
      last: 'Last: 3 days ago',
    },
    {
      name: 'stage-worker',
      addr: '10.1.2.4',
      user: 'ubuntu',
      color: '#e0b870',
      tags: ['staging', 'worker'],
      state: 'error',
      last: 'Auth failed · 1m ago',
    },
    {
      name: 'k8s-master',
      addr: 'k8s.acme.local',
      user: 'core',
      color: '#7aa2f7',
      tags: ['k8s', 'control'],
      state: 'connected',
      last: 'Connected · 1h',
    },
    {
      name: 'k8s-worker-03',
      addr: '10.2.0.13',
      user: 'core',
      color: '#7aa2f7',
      tags: ['k8s', 'node'],
      state: 'idle',
      last: 'Last: today',
    },
    {
      name: 'homelab-nas',
      addr: '192.168.1.42',
      user: 'riley',
      color: '#c897e0',
      tags: ['personal'],
      state: 'idle',
      last: 'Last: last week',
    },
  ]
  return (
    <AppFrame title="trominal" style={{ width: 1280, height: 800 }}>
      <AppShell active="hosts">
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flex: 1,
              maxWidth: 380,
              height: 30,
              padding: '0 10px',
              background: 'var(--surface)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--r-3)',
              fontSize: 13,
            }}
          >
            <Icon name="search" size={13} color="var(--fg-faint)" />
            <span style={{ flex: 1, color: 'var(--fg-faint)' }}>
              Search hosts, tags, addresses…
            </span>
            <Kbd>⌘K</Kbd>
          </div>
          <Button variant="outline" icon="filter" size="md">
            All groups
          </Button>
          <Button variant="outline" icon="tag" size="md">
            Tags
          </Button>
          <Button variant="outline" icon="arrow_up_down" size="md">
            Recent
          </Button>
          <div style={{ flex: 1 }} />
          <Button variant="primary" icon="plus" size="md">
            New host
          </Button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 18 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Production</span>
              <span style={{ fontSize: 11, color: 'var(--fg-faint)' }}>4 hosts · 2 connected</span>
            </div>
            <Icon name="chevron_down" size={14} color="var(--fg-faint)" />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 10,
              marginBottom: 22,
            }}
          >
            {hosts.slice(0, 4).map((h) => (
              <HostCard key={h.name} {...h} group="Production" />
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Staging</span>
              <span style={{ fontSize: 11, color: 'var(--fg-faint)' }}>2 hosts</span>
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 10,
              marginBottom: 22,
            }}
          >
            {hosts.slice(4, 6).map((h) => (
              <HostCard key={h.name} {...h} />
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>K8s nodes</span>
              <span style={{ fontSize: 11, color: 'var(--fg-faint)' }}>2 hosts · 1 connected</span>
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 10,
            }}
          >
            {hosts.slice(6, 9).map((h) => (
              <HostCard key={h.name} {...h} />
            ))}
          </div>
        </div>
      </AppShell>
    </AppFrame>
  )
}

// ---------- 8. Host detail / edit drawer ----------
const ScreenHostDetail = () => (
  <AppFrame title="trominal — edit host" style={{ width: 1280, height: 800 }}>
    <AppShell active="hosts">
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Dimmed list behind */}
        <div
          style={{ flex: 1, padding: 18, opacity: 0.35, pointerEvents: 'none', overflow: 'hidden' }}
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
                  }}
                />
              </Card>
            ))}
          </div>
        </div>
        {/* Drawer */}
        <div
          style={{
            width: 480,
            background: 'var(--bg-elev)',
            borderLeft: '1px solid var(--border-strong)',
            boxShadow: '-12px 0 40px rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 'var(--r-2)',
                background: '#f17a7a22',
                color: '#f17a7a',
                border: '1px solid #f17a7a40',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="server" size={14} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Edit host</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
                web-01.prod
              </div>
            </div>
            <Icon name="x" size={16} color="var(--fg-muted)" />
          </div>
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <Input label="Label" value="web-01.prod" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8 }}>
              <Input label="Address" mono value="10.0.4.21" />
              <Input label="Port" mono value="22" fullWidth={false} />
            </div>
            <Input label="Username" mono value="deploy" icon="user" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="Group">
                <Input
                  value="Production"
                  suffix={<Icon name="chevron_down" size={12} color="var(--fg-faint)" />}
                />
              </Field>
              <Field label="Color">
                <div style={{ display: 'flex', gap: 6, height: 32, alignItems: 'center' }}>
                  {['#f17a7a', '#e0b870', '#7dd3a0', '#7aa2f7', '#c897e0', '#7dd3c0'].map(
                    (c, i) => (
                      <span
                        key={c}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 'var(--r-2)',
                          background: c,
                          border: i === 0 ? '2px solid var(--fg)' : '2px solid transparent',
                          cursor: 'pointer',
                        }}
                      />
                    ),
                  )}
                </div>
              </Field>
            </div>
            <Field label="Tags">
              <div
                style={{
                  display: 'flex',
                  gap: 4,
                  flexWrap: 'wrap',
                  padding: '6px 8px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--r-3)',
                  minHeight: 32,
                  alignItems: 'center',
                }}
              >
                <Badge tone="outline" mono>
                  nginx <Icon name="x" size={10} style={{ marginLeft: 4 }} />
                </Badge>
                <Badge tone="outline" mono>
                  us-east <Icon name="x" size={10} style={{ marginLeft: 4 }} />
                </Badge>
                <span className="mono" style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
                  + add tag
                </span>
              </div>
            </Field>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--fg-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 10,
                }}
              >
                Authentication
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 4,
                  padding: 3,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-3)',
                  marginBottom: 12,
                }}
              >
                {[
                  { id: 'key', label: 'SSH key', active: true },
                  { id: 'pwd', label: 'Password' },
                  { id: 'agent', label: 'Agent' },
                ].map((t) => (
                  <div
                    key={t.id}
                    style={{
                      flex: 1,
                      height: 26,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      borderRadius: 'var(--r-2)',
                      background: t.active ? 'var(--surface-3)' : 'transparent',
                      color: t.active ? 'var(--fg)' : 'var(--fg-muted)',
                      fontWeight: t.active ? 500 : 400,
                      cursor: 'pointer',
                    }}
                  >
                    {t.label}
                  </div>
                ))}
              </div>
              <Field label="Identity">
                <Input
                  mono
                  value="acme-deploy (ed25519)"
                  icon="key"
                  suffix={<Icon name="chevron_down" size={12} color="var(--fg-faint)" />}
                />
              </Field>
            </div>
            <div
              style={{
                borderTop: '1px solid var(--border)',
                paddingTop: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <Field label="Initial command (optional)">
                <Input
                  mono
                  value="cd /srv/app && tail -f log/production.log"
                  placeholder="e.g. tmux a -t main"
                />
              </Field>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  color: 'var(--fg-muted)',
                }}
              >
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    background: 'var(--accent)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="check" size={10} color="var(--accent-fg)" />
                </span>
                Use as default identity for this host
              </label>
            </div>
          </div>
          <div
            style={{ padding: 14, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}
          >
            <Button variant="ghost" icon="trash" style={{ color: 'var(--danger)' }}>
              Delete
            </Button>
            <div style={{ flex: 1 }} />
            <Button variant="outline">Cancel</Button>
            <Button variant="primary">Save host</Button>
          </div>
        </div>
      </div>
    </AppShell>
  </AppFrame>
)

// ---------- 9. TOFU dialog ----------
const ScreenTOFU = () => (
  <AppFrame title="trominal" style={{ width: 1180, height: 720 }}>
    <AppShell active="hosts">
      <div style={{ flex: 1, position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(10,9,7,0.7)',
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
              width: 520,
              background: 'var(--bg-elev)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--r-4)',
              boxShadow: 'var(--sh-3)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '18px 20px 14px',
                display: 'flex',
                gap: 12,
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--r-2)',
                  background: 'var(--warning-soft)',
                  color: 'var(--warning)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name="shield" size={16} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Verify host fingerprint</div>
                <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>
                  This is the first time connecting to{' '}
                  <span className="mono" style={{ color: 'var(--fg)' }}>
                    db-primary
                  </span>
                  . Confirm the key matches what your server administrator provided.
                </div>
              </div>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-3)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '100px 1fr',
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--fg-faint)' }}>Host</span>
                  <span className="mono" style={{ fontSize: 12 }}>
                    db.prod.acme:22
                  </span>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '100px 1fr',
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--fg-faint)' }}>Algorithm</span>
                  <span className="mono" style={{ fontSize: 12 }}>
                    ssh-ed25519 · 256 bit
                  </span>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '100px 1fr',
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border-subtle)',
                    alignItems: 'flex-start',
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--fg-faint)', marginTop: 2 }}>
                    SHA256
                  </span>
                  <span
                    className="mono"
                    style={{ fontSize: 12, wordBreak: 'break-all', color: 'var(--accent)' }}
                  >
                    SHA256:7Hd9k3LpQa+vRz0xT8fNjW4mC2eYsB1KvUgX6oP/r8E
                  </span>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '100px 1fr',
                    padding: '10px 14px',
                    alignItems: 'flex-start',
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--fg-faint)', marginTop: 2 }}>
                    Public key
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: 'var(--fg-muted)',
                      wordBreak: 'break-all',
                      lineHeight: 1.5,
                    }}
                  >
                    AAAAC3NzaC1lZDI1NTE5AAAAIPq8mF1jY2RhRk0p9CgvY/lZ0K3eXJ8aN7…
                  </span>
                </div>
              </div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  color: 'var(--fg-muted)',
                }}
              >
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    background: 'var(--accent)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="check" size={10} color="var(--accent-fg)" />
                </span>
                Trust this host fingerprint and remember it
              </label>
            </div>
            <div
              style={{
                padding: 14,
                borderTop: '1px solid var(--border)',
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
              }}
            >
              <Button variant="outline">Cancel</Button>
              <Button variant="ghost" icon="copy">
                Copy fingerprint
              </Button>
              <Button variant="primary" icon="check">
                Trust & connect
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  </AppFrame>
)

Object.assign(window, { AppShell, ScreenHostsEmpty, ScreenHostsList, ScreenHostDetail, ScreenTOFU })
