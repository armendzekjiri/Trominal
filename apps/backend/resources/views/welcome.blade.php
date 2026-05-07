<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        <title>{{ config('app.name', 'Trominal') }}</title>

        @vite(['resources/css/app.css', 'resources/js/app.js'])
    </head>
    <body class="min-h-screen bg-bg text-fg antialiased">
        <main class="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-8 py-10">
            <p class="mb-4 font-mono text-sm uppercase tracking-wide text-accent">Laravel 13 API</p>
            <h1 class="text-5xl font-semibold tracking-normal">Trominal backend</h1>
            <p class="mt-5 max-w-2xl text-lg leading-8 text-fg-muted">
                Phase 0 foundation is running. The API and Filament admin panel will be built on
                this Laravel application in the next phases.
            </p>
            <div class="mt-10 grid gap-4 md:grid-cols-3">
                <div class="rounded-md border border-border bg-bg-elev p-5">
                    <h2 class="font-mono text-sm">PostgreSQL</h2>
                    <p class="mt-3 text-sm leading-6 text-fg-muted">Local dev port 55432.</p>
                </div>
                <div class="rounded-md border border-border bg-bg-elev p-5">
                    <h2 class="font-mono text-sm">Redis</h2>
                    <p class="mt-3 text-sm leading-6 text-fg-muted">Local dev port 6379.</p>
                </div>
                <div class="rounded-md border border-border bg-bg-elev p-5">
                    <h2 class="font-mono text-sm">Quality</h2>
                    <p class="mt-3 text-sm leading-6 text-fg-muted">Pest, Pint, and Larastan level 8.</p>
                </div>
            </div>
        </main>
    </body>
</html>
