/* Trominal — Auth screens
 * Connect to server, Sign up, Login, 2FA, Master unlock
 * Each screen is a centered card on the dark canvas.
 */

const { Icon, Button, Input, Field, Badge, Dot, Logo, AppFrame } = trPrim

const AuthShell = ({ title, subtitle, children, footer, width = 360, server }) => (
  <div
    style={{
      flex: 1,
      minHeight: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background:
        'radial-gradient(1200px 600px at 50% -10%, rgba(125,211,160,0.05), transparent 60%), var(--bg)',
      padding: 24,
    }}
  >
    <div style={{ width, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Logo size={15} />
        {server && (
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--fg-faint)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Dot state="connected" size={6} />
            {server}
          </div>
        )}
      </div>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.5 }}>
            {subtitle}
          </p>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
      {footer && (
        <div
          style={{
            borderTop: '1px solid var(--border)',
            paddingTop: 14,
            fontSize: 12,
            color: 'var(--fg-faint)',
          }}
        >
          {footer}
        </div>
      )}
    </div>
  </div>
)

// ---------- 1. First-launch / Connect to server ----------
const ScreenConnect = () => (
  <AppFrame title="trominal — connect" style={{ width: 880, height: 600 }}>
    <AuthShell
      title="Connect to your Trominal server"
      subtitle="Trominal is self-hosted. Point this client at your server's API URL to get started."
      width={380}
      footer={
        <>
          Don't have a server yet?{' '}
          <span style={{ color: 'var(--accent)' }}>Read the deploy guide →</span>
        </>
      }
    >
      <Input label="Server URL" mono value="https://trominal.acme.internal" icon="server" />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          background: 'var(--accent-soft)',
          border: '1px solid rgba(125,211,160,0.18)',
          borderRadius: 'var(--r-3)',
          fontSize: 12,
          color: 'var(--fg)',
        }}
      >
        <Icon name="check" size={14} color="var(--accent)" />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500 }}>Reachable · v1.4.2</div>
          <div className="mono" style={{ color: 'var(--fg-muted)', fontSize: 11, marginTop: 2 }}>
            tls 1.3 · cert valid · 38 ms
          </div>
        </div>
      </div>
      <Button variant="primary" full size="lg">
        Connect
      </Button>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: 'var(--fg-faint)',
          fontSize: 11,
        }}
      >
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span>or</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>
      <Button variant="outline" full icon="bolt">
        Use Trominal Cloud (beta)
      </Button>
    </AuthShell>
  </AppFrame>
)

// ---------- 2. Sign up ----------
const ScreenSignup = () => {
  const StrengthBar = () => (
    <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            background: i <= 3 ? 'var(--accent)' : 'var(--surface-3)',
          }}
        />
      ))}
    </div>
  )
  return (
    <AppFrame title="trominal — sign up" style={{ width: 880, height: 700 }}>
      <AuthShell
        title="Create your account"
        subtitle="Your master password encrypts everything client-side. We never see it — losing it means losing your vault."
        width={400}
        server="trominal.acme.internal"
        footer={
          <>
            Already have an account? <span style={{ color: 'var(--accent)' }}>Sign in</span>
          </>
        }
      >
        <Input label="Email" type="email" value="riley@acme.io" icon="mail" />
        <Input
          label="Login password"
          value="••••••••••••"
          icon="lock"
          suffix={<Icon name="eye_off" size={14} color="var(--fg-faint)" />}
          hint="Used to authenticate with the server."
        />
        <div>
          <Input
            label="Master password"
            mono
            value="•••••••••••••••••••••"
            icon="key"
            suffix={<Icon name="eye" size={14} color="var(--fg-faint)" />}
          />
          <StrengthBar />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              color: 'var(--fg-faint)',
              marginTop: 4,
            }}
          >
            <span>Strong · 142 bits of entropy</span>
            <span className="mono">21 chars</span>
          </div>
        </div>
        <Input label="Confirm master password" mono value="•••••••••••••••••••••" icon="key" />
        <label
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            fontSize: 12,
            color: 'var(--fg-muted)',
            lineHeight: 1.5,
          }}
        >
          <span
            style={{
              width: 14,
              height: 14,
              marginTop: 1,
              borderRadius: 3,
              background: 'var(--accent)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon name="check" size={10} color="var(--accent-fg)" />
          </span>
          <span>
            I understand the master password cannot be recovered, and I accept the{' '}
            <span style={{ color: 'var(--accent)' }}>terms of service</span> and{' '}
            <span style={{ color: 'var(--accent)' }}>privacy policy</span>.
          </span>
        </label>
        <Button variant="primary" full size="lg">
          Create account
        </Button>
      </AuthShell>
    </AppFrame>
  )
}

// ---------- 3. Login ----------
const ScreenLogin = () => (
  <AppFrame title="trominal — sign in" style={{ width: 880, height: 600 }}>
    <AuthShell
      title="Sign in"
      subtitle="Welcome back."
      width={360}
      server="trominal.acme.internal"
      footer={<span style={{ color: 'var(--accent)' }}>Connect to a different server →</span>}
    >
      <Input label="Email" type="email" value="riley@acme.io" icon="mail" />
      <Input
        label="Password"
        value="••••••••••••"
        icon="lock"
        suffix={<Icon name="eye_off" size={14} color="var(--fg-faint)" />}
      />
      <Button variant="primary" full size="lg">
        Sign in
      </Button>
      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--fg-faint)' }}>
        <span style={{ color: 'var(--accent)' }}>Forgot password?</span>
      </div>
    </AuthShell>
  </AppFrame>
)

// ---------- 4. 2FA ----------
const Screen2FA = () => {
  const code = ['7', '3', '9', '4', '2', '']
  return (
    <AppFrame title="trominal — verify" style={{ width: 880, height: 540 }}>
      <AuthShell
        title="Two-factor authentication"
        subtitle="Enter the 6-digit code from your authenticator app."
        width={400}
        server="trominal.acme.internal"
        footer={
          <>
            Lost access? <span style={{ color: 'var(--accent)' }}>Use a recovery code →</span>
          </>
        }
      >
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
          {code.map((c, i) => (
            <div
              key={i}
              className="mono"
              style={{
                width: 48,
                height: 56,
                borderRadius: 'var(--r-3)',
                background: 'var(--surface)',
                border: `1px solid ${i === 5 ? 'var(--accent)' : 'var(--border-strong)'}`,
                boxShadow: i === 5 ? '0 0 0 3px var(--accent-ring)' : undefined,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                fontWeight: 500,
                color: c ? 'var(--fg)' : 'var(--fg-faint)',
              }}
            >
              {c ||
                (i === 5 ? (
                  <span
                    style={{
                      width: 1,
                      height: 22,
                      background: 'var(--accent)',
                      animation: 'blink 1s step-end infinite',
                    }}
                  />
                ) : (
                  '·'
                ))}
            </div>
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            color: 'var(--fg-faint)',
          }}
        >
          <span>Code expires in 23s</span>
          <span style={{ color: 'var(--accent)' }}>Resend</span>
        </div>
        <Button variant="primary" full size="lg" disabled>
          Verify
        </Button>
      </AuthShell>
    </AppFrame>
  )
}

// ---------- 5. Master password unlock ----------
const ScreenUnlock = () => (
  <AppFrame title="trominal — locked" style={{ width: 880, height: 540 }}>
    <AuthShell
      title="Vault locked"
      subtitle="Enter your master password to decrypt your hosts, snippets, and identities."
      width={380}
      server="trominal.acme.internal · riley@acme.io"
      footer={
        <>
          <Icon name="shield" size={11} style={{ verticalAlign: -1, marginRight: 5 }} /> Auto-locks
          after 15 min of inactivity
        </>
      }
    >
      <Input
        label="Master password"
        mono
        value="•••••••••••••••••••••"
        icon="key"
        suffix={<Icon name="eye_off" size={14} color="var(--fg-faint)" />}
      />
      <Button variant="primary" full size="lg" icon="unlock">
        Unlock vault
      </Button>
      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--fg-faint)' }}>
        Wrong account? <span style={{ color: 'var(--accent)' }}>Sign out</span>
      </div>
    </AuthShell>
  </AppFrame>
)

Object.assign(window, { ScreenConnect, ScreenSignup, ScreenLogin, Screen2FA, ScreenUnlock })
