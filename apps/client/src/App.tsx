function App() {
  return (
    <main className="min-h-screen bg-bg text-fg">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-8 py-10">
        <div className="max-w-3xl">
          <p className="mb-4 font-mono text-sm uppercase tracking-wide text-accent">
            Phase 0 foundation
          </p>
          <h1 className="text-5xl font-semibold tracking-normal text-fg">Trominal</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-fg-muted">
            A self-hostable SSH workspace with a zero-knowledge vault, a Tauri desktop client, a web
            client, and a Laravel Filament operator panel.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <div className="rounded-md border border-border bg-bg-elev p-5">
            <h2 className="font-mono text-sm text-fg">Client</h2>
            <p className="mt-3 text-sm leading-6 text-fg-muted">
              Tauri 2, React 18, TypeScript, Vite, Tailwind, and shadcn/ui foundations.
            </p>
          </div>
          <div className="rounded-md border border-border bg-bg-elev p-5">
            <h2 className="font-mono text-sm text-fg">Backend</h2>
            <p className="mt-3 text-sm leading-6 text-fg-muted">
              Laravel 13 API foundation with PostgreSQL, Redis, Pest, Pint, and Larastan.
            </p>
          </div>
          <div className="rounded-md border border-border bg-bg-elev p-5">
            <h2 className="font-mono text-sm text-fg">Security</h2>
            <p className="mt-3 text-sm leading-6 text-fg-muted">
              Zero-knowledge vault architecture, audit logging, and strict secret handling.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
