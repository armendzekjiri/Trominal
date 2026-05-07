/* Trominal — Snippets, Identities, Tunnels, SFTP screens */

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
  SideItem,
  SectionLabel,
  Toggle,
} = trPrim

// Helper: list-detail layout
const ListDetail = ({ list, detail, listWidth = 280 }) => (
  <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
    <div
      style={{
        width: listWidth,
        borderRight: '1px solid var(--border)',
        background: 'var(--bg-elev)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {list}
    </div>
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>{detail}</div>
  </div>
)

// ---------- 11. Snippets ----------
const ScreenSnippets = () => {
  const snippets = [
    { name: 'k8s · pod logs', tag: 'k8s', active: true },
    { name: 'psql · active sessions', tag: 'db' },
    { name: 'nginx · reload', tag: 'ops' },
    { name: 'docker · prune', tag: 'docker' },
    { name: 'rails · console', tag: 'rails' },
    { name: 'tail prod log', tag: 'ops' },
    { name: 'redis · flush', tag: 'db' },
    { name: 'ssh · port forward', tag: 'net' },
  ]
  return (
    <AppFrame title="trominal — snippets" style={{ width: 1280, height: 800 }}>
      <AppShell active="snippets">
        <ListDetail
          list={
            <>
              <div
                style={{
                  padding: 12,
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '0 10px',
                    height: 28,
                    background: 'var(--surface)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--r-3)',
                  }}
                >
                  <Icon name="search" size={12} color="var(--fg-faint)" />
                  <span style={{ fontSize: 12, color: 'var(--fg-faint)', flex: 1 }}>
                    Search snippets…
                  </span>
                </div>
                <Button variant="primary" size="sm" icon="plus" />
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
                {snippets.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--r-3)',
                      marginBottom: 2,
                      background: s.active ? 'var(--surface-3)' : 'transparent',
                      borderLeft: s.active ? '2px solid var(--accent)' : '2px solid transparent',
                      paddingLeft: s.active ? 8 : 10,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon name="code" size={12} color="var(--fg-muted)" />
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: s.active ? 500 : 400,
                          color: s.active ? 'var(--fg)' : 'var(--fg-muted)',
                          flex: 1,
                        }}
                      >
                        {s.name}
                      </span>
                      <Badge tone="outline" mono>
                        {s.tag}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </>
          }
          detail={
            <>
              <div
                style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Icon name="code" size={16} color="var(--accent)" />
                <input
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--fg)',
                    fontSize: 14,
                    fontWeight: 500,
                    flex: 1,
                    outline: 'none',
                  }}
                  value="k8s · pod logs"
                  readOnly
                />
                <div style={{ display: 'flex', gap: 4 }}>
                  <Badge tone="outline" mono>
                    k8s
                  </Badge>
                  <Badge tone="outline" mono>
                    kubectl
                  </Badge>
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: 'var(--fg-faint)', padding: '2px 6px' }}
                  >
                    + tag
                  </span>
                </div>
                <div style={{ flex: 1 }} />
                <Button variant="outline" size="sm" icon="copy">
                  Copy
                </Button>
                <Button variant="primary" size="sm" icon="terminal">
                  Run
                </Button>
              </div>
              <div
                style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 0 }}
              >
                <div
                  style={{
                    borderRight: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div
                    style={{
                      padding: '8px 14px',
                      fontSize: 11,
                      color: 'var(--fg-faint)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    Source
                  </div>
                  <div
                    className="mono"
                    style={{
                      flex: 1,
                      padding: '12px 14px',
                      fontSize: 13,
                      lineHeight: 1.7,
                      color: 'var(--fg)',
                      overflow: 'auto',
                      background: 'var(--ansi-black)',
                    }}
                  >
                    <span style={{ color: 'var(--fg-faint)' }}>1</span>
                    {'  '}
                    <span style={{ color: 'var(--ansi-cyan)' }}>kubectl</span> logs \<br />
                    <span style={{ color: 'var(--fg-faint)' }}>2</span>
                    {'    '}-n{' '}
                    <span style={{ color: 'var(--ansi-yellow)' }}>
                      {'{{'} namespace {'}}'}
                    </span>{' '}
                    \<br />
                    <span style={{ color: 'var(--fg-faint)' }}>3</span>
                    {'    '}-l app=
                    <span style={{ color: 'var(--ansi-yellow)' }}>
                      {'{{'} app {'}}'}
                    </span>{' '}
                    \<br />
                    <span style={{ color: 'var(--fg-faint)' }}>4</span>
                    {'    '}--tail=
                    <span style={{ color: 'var(--ansi-yellow)' }}>
                      {'{{'} lines {'}}'}
                    </span>{' '}
                    \<br />
                    <span style={{ color: 'var(--fg-faint)' }}>5</span>
                    {'    '}--since=
                    <span style={{ color: 'var(--ansi-yellow)' }}>
                      {'{{'} since {'}}'}
                    </span>{' '}
                    \<br />
                    <span style={{ color: 'var(--fg-faint)' }}>6</span>
                    {'    '}-f
                    <br />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div
                    style={{
                      padding: '8px 14px',
                      fontSize: 11,
                      color: 'var(--fg-faint)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>Preview</span>
                    <span
                      style={{ color: 'var(--accent)', textTransform: 'none', letterSpacing: 0 }}
                    >
                      4 variables
                    </span>
                  </div>
                  <div
                    style={{
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '90px 1fr',
                        gap: 8,
                        alignItems: 'center',
                      }}
                    >
                      <span className="mono" style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
                        namespace
                      </span>
                      <Input mono value="prod" />
                      <span className="mono" style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
                        app
                      </span>
                      <Input mono value="api" />
                      <span className="mono" style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
                        lines
                      </span>
                      <Input mono value="200" />
                      <span className="mono" style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
                        since
                      </span>
                      <Input mono value="10m" />
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '8px 14px',
                      fontSize: 11,
                      color: 'var(--fg-faint)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    Resolved command
                  </div>
                  <div
                    className="mono"
                    style={{
                      margin: '0 14px 14px',
                      padding: 12,
                      background: 'var(--ansi-black)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-2)',
                      fontSize: 12,
                      lineHeight: 1.6,
                      color: 'var(--ansi-white)',
                    }}
                  >
                    <span style={{ color: 'var(--ansi-cyan)' }}>kubectl</span> logs -n{' '}
                    <span style={{ color: 'var(--ansi-green)' }}>prod</span> -l app=
                    <span style={{ color: 'var(--ansi-green)' }}>api</span> --tail=
                    <span style={{ color: 'var(--ansi-green)' }}>200</span> --since=
                    <span style={{ color: 'var(--ansi-green)' }}>10m</span> -f
                  </div>
                </div>
              </div>
            </>
          }
        />
      </AppShell>
    </AppFrame>
  )
}

// ---------- 12. Identities ----------
const ScreenIdentities = () => {
  const keys = [
    { name: 'acme-deploy', algo: 'ed25519', added: 'Mar 14', used: '2m ago', default: true },
    { name: 'personal-laptop', algo: 'ed25519', added: 'Jan 02', used: 'yesterday' },
    { name: 'legacy-rsa', algo: 'rsa-4096', added: '2024', used: '3 weeks ago', warn: true },
    { name: 'ci-bot', algo: 'ed25519', added: 'Apr 21', used: '1h ago' },
  ]
  return (
    <AppFrame title="trominal — identities" style={{ width: 1280, height: 800 }}>
      <AppShell active="identities">
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 500 }}>SSH Identities</span>
          <span style={{ fontSize: 12, color: 'var(--fg-faint)' }}>{keys.length} keys</span>
          <div style={{ flex: 1 }} />
          <Button variant="outline" icon="upload">
            Import key
          </Button>
          <Button variant="primary" icon="plus">
            Generate new
          </Button>
        </div>
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {keys.map((k) => (
            <Card key={k.name} padded={false}>
              <div style={{ padding: 14, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--r-2)',
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="key" size={15} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{k.name}</span>
                    <Badge tone={k.warn ? 'warning' : 'outline'} mono>
                      {k.algo}
                    </Badge>
                    {k.default && <Badge tone="accent">default</Badge>}
                    {k.warn && <Badge tone="warning">consider rotating</Badge>}
                  </div>
                  <div
                    className="mono"
                    style={{ fontSize: 11, color: 'var(--fg-faint)', marginBottom: 8 }}
                  >
                    SHA256:7Hd9k3LpQa+vRz0xT8fNjW4mC2eYsB1KvUgX6oP/r8E
                  </div>
                  <div
                    style={{
                      background: 'var(--ansi-black)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-2)',
                      padding: 8,
                      position: 'relative',
                    }}
                  >
                    <div
                      className="mono"
                      style={{
                        fontSize: 11,
                        color: 'var(--fg-muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      ssh-{k.algo} AAAAC3NzaC1lZDI1NTE5AAAAIPq8mF1jY2RhRk0p9CgvY/lZ0K3eXJ8aN7…{' '}
                      {k.name}@trominal
                    </div>
                    <Icon
                      name="copy"
                      size={12}
                      color="var(--fg-faint)"
                      style={{ position: 'absolute', top: 8, right: 8 }}
                    />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 14,
                      fontSize: 11,
                      color: 'var(--fg-faint)',
                      marginTop: 8,
                    }}
                  >
                    <span>Added {k.added}</span>
                    <span>·</span>
                    <span>Last used {k.used}</span>
                    <span>·</span>
                    <span>3 hosts</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button variant="ghost" size="sm" icon="copy">
                    Public key
                  </Button>
                  <Button variant="ghost" size="sm" icon="more" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </AppShell>
    </AppFrame>
  )
}

// ---------- 13. Tunnels ----------
const ScreenTunnels = () => {
  const tunnels = [
    {
      kind: 'L',
      local: '5432',
      remote: 'db.prod.acme:5432',
      host: 'web-01.prod',
      on: true,
      autostart: true,
      traffic: '12.4 MB',
    },
    {
      kind: 'L',
      local: '8080',
      remote: 'internal-dash:80',
      host: 'k8s-master',
      on: true,
      autostart: false,
      traffic: '1.1 MB',
    },
    {
      kind: 'R',
      local: '9000',
      remote: 'localhost:9000',
      host: 'stage-app',
      on: false,
      autostart: false,
      traffic: '—',
    },
    {
      kind: 'D',
      local: '1080',
      remote: 'SOCKS5',
      host: 'bastion-eu',
      on: true,
      autostart: true,
      traffic: '184 MB',
    },
  ]
  const kindLabel = { L: 'Local', R: 'Remote', D: 'SOCKS' }
  const kindTone = { L: 'info', R: 'warning', D: 'accent' }
  return (
    <AppFrame title="trominal — tunnels" style={{ width: 1280, height: 800 }}>
      <AppShell active="tunnels">
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 500 }}>Tunnels</span>
          <span style={{ fontSize: 12, color: 'var(--fg-faint)' }}>3 active · 1 stopped</span>
          <div style={{ flex: 1 }} />
          <Button variant="outline" icon="refresh">
            Refresh
          </Button>
          <Button variant="primary" icon="plus">
            New tunnel
          </Button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 18 }}>
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
                gridTemplateColumns: '60px 1fr 1fr 200px 120px 90px 60px',
                padding: '10px 14px',
                fontSize: 11,
                color: 'var(--fg-faint)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span>Type</span>
              <span>Local</span>
              <span>Remote</span>
              <span>Via host</span>
              <span>Traffic</span>
              <span>Auto</span>
              <span>State</span>
            </div>
            {tunnels.map((t, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 1fr 1fr 200px 120px 90px 60px',
                  padding: '12px 14px',
                  fontSize: 12,
                  alignItems: 'center',
                  borderBottom: i < tunnels.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                <Badge tone={kindTone[t.kind]} mono>
                  {t.kind}·{kindLabel[t.kind]}
                </Badge>
                <span className="mono">
                  {t.kind === 'D' ? '127.0.0.1:' + t.local : '127.0.0.1:' + t.local}
                </span>
                <span className="mono" style={{ color: 'var(--fg-muted)' }}>
                  {t.remote}
                </span>
                <span
                  className="mono"
                  style={{
                    color: 'var(--fg-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Icon name="server" size={11} />
                  {t.host}
                </span>
                <span
                  className="mono"
                  style={{ color: t.on ? 'var(--accent)' : 'var(--fg-faint)' }}
                >
                  {t.traffic}
                </span>
                <Toggle on={t.autostart} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Dot state={t.on ? 'connected' : 'idle'} size={6} />
                  <Icon
                    name={t.on ? 'square' : 'play'}
                    size={11}
                    color={t.on ? 'var(--danger)' : 'var(--accent)'}
                  />
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 18,
              fontSize: 12,
              color: 'var(--fg-faint)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Icon name="bolt" size={12} /> Tunnels persist across app restarts when "Auto" is on.
            Right-click a row for advanced options.
          </div>
        </div>
      </AppShell>
    </AppFrame>
  )
}

// ---------- 14. SFTP browser ----------
const ScreenSFTP = () => {
  const localFiles = [
    { name: '..', icon: 'folder', size: '—', date: '' },
    { name: 'Documents', icon: 'folder', size: '—', date: 'Apr 22' },
    { name: 'Downloads', icon: 'folder', size: '—', date: 'today' },
    { name: 'trominal-config.json', icon: 'file', size: '1.2 KB', date: 'today' },
    { name: 'deploy.sh', icon: 'file', size: '412 B', date: 'May 03' },
    { name: 'screenshot.png', icon: 'file', size: '284 KB', date: 'today', selected: true },
    { name: 'notes.md', icon: 'file', size: '8.4 KB', date: 'yesterday' },
  ]
  const remoteFiles = [
    { name: '..', icon: 'folder', size: '—', date: '' },
    { name: 'config', icon: 'folder', size: '—', date: 'Apr 11' },
    { name: 'log', icon: 'folder', size: '—', date: 'today' },
    { name: 'public', icon: 'folder', size: '—', date: 'May 01' },
    { name: 'Gemfile', icon: 'file', size: '2.1 KB', date: 'Apr 11' },
    { name: 'Gemfile.lock', icon: 'file', size: '14.2 KB', date: 'Apr 11' },
    { name: 'README.md', icon: 'file', size: '3.4 KB', date: 'Mar 02' },
    { name: 'config.ru', icon: 'file', size: '284 B', date: 'Jan 14' },
  ]
  const FilePane = ({ title, path, files, badge }) => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Icon
          name={badge === 'remote' ? 'server' : 'monitor'}
          size={13}
          color={badge === 'remote' ? 'var(--accent)' : 'var(--fg-muted)'}
        />
        <span style={{ fontSize: 12, fontWeight: 500 }}>{title}</span>
        <Badge tone={badge === 'remote' ? 'accent' : 'outline'} mono>
          {badge === 'remote' ? 'remote' : 'local'}
        </Badge>
        <div style={{ flex: 1 }} />
        <Icon name="refresh" size={13} color="var(--fg-faint)" />
      </div>
      <div
        className="mono"
        style={{
          padding: '8px 12px',
          fontSize: 11,
          color: 'var(--fg-muted)',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--surface)',
        }}
      >
        {path}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 80px 80px',
            padding: '6px 12px',
            fontSize: 11,
            color: 'var(--fg-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <span>Name</span>
          <span style={{ textAlign: 'right' }}>Size</span>
          <span style={{ textAlign: 'right' }}>Modified</span>
        </div>
        {files.map((f, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 80px 80px',
              padding: '5px 12px',
              fontSize: 12,
              alignItems: 'center',
              background: f.selected ? 'var(--surface-3)' : 'transparent',
              color: f.selected ? 'var(--fg)' : 'var(--fg-muted)',
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
              <Icon
                name={f.icon}
                size={13}
                color={f.icon === 'folder' ? 'var(--info)' : 'var(--fg-faint)'}
              />
              <span
                className="mono"
                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {f.name}
              </span>
            </span>
            <span className="mono" style={{ textAlign: 'right', fontSize: 11 }}>
              {f.size}
            </span>
            <span
              className="mono"
              style={{ textAlign: 'right', fontSize: 11, color: 'var(--fg-faint)' }}
            >
              {f.date}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
  return (
    <AppFrame title="trominal — sftp" style={{ width: 1280, height: 800 }}>
      <AppShell active="sftp">
        <div
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Badge tone="outline" mono>
            <Dot state="connected" size={6} /> deploy@web-01.prod
          </Badge>
          <span className="mono" style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
            sftp · 22ms
          </span>
          <div style={{ flex: 1 }} />
          <Button variant="outline" size="sm" icon="upload">
            Upload
          </Button>
          <Button variant="outline" size="sm" icon="folder">
            New folder
          </Button>
          <Button variant="ghost" size="sm" icon="more" />
        </div>
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <FilePane title="MacBook Pro" path="~/Projects/acme" files={localFiles} badge="local" />
          <div style={{ width: 1, background: 'var(--border)' }} />
          <FilePane title="web-01.prod" path="/srv/app" files={remoteFiles} badge="remote" />
        </div>
        {/* Transfer panel */}
        <div
          style={{
            height: 130,
            background: 'var(--bg-elev)',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <Icon name="arrow_up_down" size={13} color="var(--fg-muted)" />
            <span style={{ fontSize: 12, fontWeight: 500 }}>Transfers</span>
            <Badge tone="accent">2 active</Badge>
            <span style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
              · 1 queued · 8 done today
            </span>
            <div style={{ flex: 1 }} />
            <span className="mono" style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
              ↑ 3.4 MB/s
            </span>
            <Icon name="more" size={13} color="var(--fg-faint)" />
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 14px' }}>
            {[
              {
                dir: '↑',
                name: 'screenshot.png',
                from: '~/Downloads',
                to: '/srv/app/public',
                pct: 64,
                speed: '1.8 MB/s',
              },
              {
                dir: '↓',
                name: 'production.log',
                from: '/srv/app/log',
                to: '~/Documents',
                pct: 28,
                speed: '1.6 MB/s',
              },
              {
                dir: '↑',
                name: 'deploy.sh',
                from: '~/Projects/acme',
                to: '/srv/app',
                pct: 100,
                speed: 'done',
                done: true,
              },
            ].map((t, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '20px 1fr 80px 60px',
                  gap: 10,
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <span style={{ color: t.done ? 'var(--accent)' : 'var(--fg-muted)' }}>
                  {t.done ? '✓' : t.dir}
                </span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <span className="mono">{t.name}</span>
                    <span className="mono" style={{ color: 'var(--fg-faint)', fontSize: 11 }}>
                      {t.from} → {t.to}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 3,
                      background: 'var(--surface-3)',
                      borderRadius: 2,
                      marginTop: 4,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: t.pct + '%',
                        background: t.done ? 'var(--fg-faint)' : 'var(--accent)',
                      }}
                    />
                  </div>
                </div>
                <span
                  className="mono"
                  style={{ fontSize: 11, color: 'var(--fg-faint)', textAlign: 'right' }}
                >
                  {t.speed}
                </span>
                <span className="mono" style={{ fontSize: 11, textAlign: 'right' }}>
                  {t.pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </AppShell>
    </AppFrame>
  )
}

Object.assign(window, { ScreenSnippets, ScreenIdentities, ScreenTunnels, ScreenSFTP })
