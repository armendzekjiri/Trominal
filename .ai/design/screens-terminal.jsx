/* Trominal — Terminal screen + AI panel */

const { Icon, Button, Input, Field, Badge, Dot, Logo, AppFrame, Kbd } = trPrim

// ---------- ANSI-styled line ----------
const Line = ({ children, prompt, dim }) => (
  <div
    className="mono"
    style={{
      fontSize: 13,
      lineHeight: 1.55,
      color: dim ? 'var(--ansi-bright-black)' : 'var(--ansi-white)',
      whiteSpace: 'pre-wrap',
    }}
  >
    {prompt && <span style={{ color: 'var(--ansi-green)' }}>{prompt} </span>}
    {children}
  </div>
)
const C = ({ c, children }) => <span style={{ color: `var(--ansi-${c})` }}>{children}</span>

const TerminalBody = ({ withGhost, withAi }) => (
  <div style={{ flex: 1, padding: '14px 18px', overflow: 'auto', background: 'var(--ansi-black)' }}>
    <Line dim>Last login: Tue May 6 14:22:03 2026 from 10.4.2.1</Line>
    <Line prompt="deploy@web-01:~$">
      <C c="green">cd</C> /srv/app
    </Line>
    <Line prompt="deploy@web-01:/srv/app$">
      <C c="green">git</C> <C c="cyan">status</C>
    </Line>
    <Line>
      On branch <C c="bright-green">main</C>
    </Line>
    <Line>
      Your branch is up to date with <C c="cyan">'origin/main'</C>.
    </Line>
    <Line />
    <Line>Changes not staged for commit:</Line>
    <Line>
      {' '}
      (use <C c="bright-blue">"git add &lt;file&gt;..."</C> to update what will be committed)
    </Line>
    <Line />
    <Line>
      {' '}
      <C c="red">modified: config/database.yml</C>
    </Line>
    <Line>
      {' '}
      <C c="red">modified: app/controllers/api/v1/sessions_controller.rb</C>
    </Line>
    <Line />
    <Line prompt="deploy@web-01:/srv/app$">
      <C c="green">tail</C> -n 6 log/production.log
    </Line>
    <Line>
      <C c="bright-black">[2026-05-06 14:22:09]</C> <C c="green">INFO</C> Started GET
      "/api/v1/users/42" for 10.0.4.2
    </Line>
    <Line>
      <C c="bright-black">[2026-05-06 14:22:09]</C> <C c="green">INFO</C> Processing by
      Api::V1::UsersController#show
    </Line>
    <Line>
      <C c="bright-black">[2026-05-06 14:22:09]</C> <C c="green">INFO</C> Completed 200 OK in 38ms
      (Views: 12ms | DB: 8ms)
    </Line>
    <Line>
      <C c="bright-black">[2026-05-06 14:22:11]</C> <C c="yellow">WARN</C> Slow query (412ms):
      SELECT * FROM events WHERE…
    </Line>
    <Line>
      <C c="bright-black">[2026-05-06 14:22:14]</C> <C c="green">INFO</C> Started POST
      "/api/v1/sessions"
    </Line>
    <Line>
      <C c="bright-black">[2026-05-06 14:22:14]</C> <C c="red">ERROR</C> Postgres::ConnectionError:
      too many connections
    </Line>
    <Line />
    <div
      className="mono"
      style={{ fontSize: 13, color: 'var(--ansi-white)', display: 'flex', alignItems: 'center' }}
    >
      <span style={{ color: 'var(--ansi-green)' }}>deploy@web-01:/srv/app$ </span>
      <span>psql -h db.prod.acme -U postgres -c </span>
      {withGhost && (
        <span style={{ color: 'var(--ansi-bright-black)', fontStyle: 'italic' }}>
          "SELECT count(*) FROM pg_stat_activity;"
        </span>
      )}
      <span
        style={{
          width: 8,
          height: 16,
          background: 'var(--ansi-green)',
          marginLeft: 1,
          animation: 'blink 1s step-end infinite',
        }}
      />
    </div>
    {withGhost && (
      <div
        className="mono"
        style={{
          fontSize: 11,
          color: 'var(--fg-faint)',
          marginTop: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Icon name="sparkles" size={11} color="var(--accent)" />
        AI suggestion · <Kbd>tab</Kbd> to accept · <Kbd>esc</Kbd> to dismiss
      </div>
    )}
  </div>
)

const TerminalTabs = ({ active = 0 }) => {
  const tabs = [
    { name: 'web-01.prod', state: 'connected' },
    { name: 'db-primary', state: 'connected' },
    { name: 'k8s-master', state: 'connecting' },
  ]
  return (
    <div
      style={{
        height: 34,
        background: 'var(--bg-elev)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'stretch',
        padding: '0 8px',
        gap: 1,
      }}
    >
      {tabs.map((t, i) => (
        <div
          key={t.name}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '0 12px',
            height: 34,
            background: i === active ? 'var(--ansi-black)' : 'transparent',
            borderTop: i === active ? '1px solid var(--accent)' : '1px solid transparent',
            color: i === active ? 'var(--fg)' : 'var(--fg-muted)',
            fontSize: 12,
            cursor: 'pointer',
            marginTop: -1,
          }}
        >
          <Dot state={t.state} size={6} />
          <span className="mono">{t.name}</span>
          <Icon name="x" size={11} color="var(--fg-faint)" />
        </div>
      ))}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          color: 'var(--fg-faint)',
        }}
      >
        <Icon name="plus" size={13} />
      </div>
      <div style={{ flex: 1 }} />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 8px',
          color: 'var(--fg-faint)',
        }}
      >
        <Icon name="split" size={13} />
        <Icon name="search" size={13} />
        <Icon name="more" size={13} />
      </div>
    </div>
  )
}

const StatusBar = ({ withAi }) => (
  <div
    className="mono"
    style={{
      height: 22,
      background: 'var(--bg-elev)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      gap: 14,
      fontSize: 11,
      color: 'var(--fg-faint)',
      flexShrink: 0,
    }}
  >
    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <Dot state="connected" size={6} /> ssh deploy@10.0.4.21
    </span>
    <span>22ms</span>
    <span>↑ 1.2 KB/s ↓ 8.4 KB/s</span>
    <span>tty: xterm-256color</span>
    <div style={{ flex: 1 }} />
    {withAi && <span style={{ color: 'var(--accent)' }}>● AI ready</span>}
    <span>UTF-8</span>
    <span>bash 5.1</span>
    <span>78 × 24</span>
  </div>
)

// ---------- 10. Terminal screen ----------
const ScreenTerminal = () => (
  <AppFrame title="trominal — terminal" style={{ width: 1280, height: 800 }}>
    <AppShell active="hosts" collapsed>
      <TerminalTabs active={0} />
      <TerminalBody />
      <StatusBar />
    </AppShell>
  </AppFrame>
)

// ---------- 14. AI panel (slide-in next to terminal) ----------
const AiMessage = ({ role, children }) => (
  <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: 'var(--r-2)',
        flexShrink: 0,
        background: role === 'ai' ? 'var(--accent-soft)' : 'var(--surface-2)',
        color: role === 'ai' ? 'var(--accent)' : 'var(--fg-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid ' + (role === 'ai' ? 'rgba(125,211,160,0.2)' : 'var(--border)'),
      }}
    >
      <Icon name={role === 'ai' ? 'sparkles' : 'user'} size={11} />
    </div>
    <div style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--fg)' }}>
      {children}
    </div>
  </div>
)

const ScreenTerminalWithAi = () => (
  <AppFrame title="trominal — terminal + AI" style={{ width: 1440, height: 820 }}>
    <AppShell active="hosts" collapsed>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <TerminalTabs active={0} />
          <TerminalBody withGhost />
          <StatusBar withAi />
        </div>
        <div
          style={{
            width: 380,
            background: 'var(--bg-elev)',
            borderLeft: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Icon name="sparkles" size={14} color="var(--accent)" />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Ask AI</span>
            <Badge tone="outline" mono>
              claude-sonnet-4.5
            </Badge>
            <div style={{ flex: 1 }} />
            <Icon name="more" size={14} color="var(--fg-faint)" />
            <Icon name="x" size={14} color="var(--fg-muted)" />
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>
            <AiMessage role="user">
              We're seeing{' '}
              <span className="mono" style={{ color: 'var(--accent)' }}>
                too many connections
              </span>{' '}
              errors on db.prod.acme. What should I check?
            </AiMessage>
            <AiMessage role="ai">
              <div style={{ marginBottom: 10 }}>
                Postgres has hit <span className="mono">max_connections</span>. Three quick checks:
              </div>
              <ol style={{ margin: 0, paddingLeft: 20, color: 'var(--fg-muted)' }}>
                <li style={{ marginBottom: 4 }}>Count current sessions and group by state</li>
                <li style={{ marginBottom: 4 }}>Check for long-running idle transactions</li>
                <li>Look at the app's pool size vs. max_connections</li>
              </ol>
              <div
                style={{
                  marginTop: 10,
                  background: 'var(--ansi-black)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-2)',
                  padding: '8px 10px',
                  position: 'relative',
                }}
              >
                <div className="mono" style={{ fontSize: 12, lineHeight: 1.6 }}>
                  <C c="green">SELECT</C> state, <C c="cyan">count</C>(*)
                  <br />
                  <C c="green">FROM</C> pg_stat_activity
                  <br />
                  <C c="green">GROUP BY</C> state;
                </div>
                <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4 }}>
                  <Icon name="copy" size={12} color="var(--fg-faint)" />
                  <Icon name="terminal" size={12} color="var(--accent)" />
                </div>
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--fg-faint)' }}>
                Want me to run this on db-primary?
              </div>
            </AiMessage>
          </div>
          <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--r-3)',
                padding: 10,
              }}
            >
              <div
                className="mono"
                style={{ fontSize: 12, color: 'var(--fg-faint)', minHeight: 36 }}
              >
                Ask anything — the current terminal output is included as context
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <Badge tone="outline" mono>
                  <Icon name="terminal" size={10} style={{ marginRight: 4 }} />
                  last 50 lines
                </Badge>
                <div style={{ flex: 1 }} />
                <Kbd>⏎</Kbd>
                <Button variant="primary" size="sm" icon="arrow_right">
                  Send
                </Button>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 6,
                marginTop: 8,
                fontSize: 11,
                color: 'var(--fg-faint)',
              }}
            >
              <span
                style={{
                  padding: '2px 6px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                }}
              >
                /explain
              </span>
              <span
                style={{
                  padding: '2px 6px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                }}
              >
                /fix
              </span>
              <span
                style={{
                  padding: '2px 6px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                }}
              >
                /diagnose
              </span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  </AppFrame>
)

Object.assign(window, { ScreenTerminal, ScreenTerminalWithAi })
