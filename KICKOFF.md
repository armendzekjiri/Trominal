# Trominal — Kickoff Guide

Read this once. It tells you how to start, regardless of which AI tool you use.

## What's in this starter

```
trominal/
├── CLAUDE.md                       # Entry point for Claude Code
├── AGENTS.md                       # Entry point for Codex
├── README.md                       # Project overview
├── SECURITY.md                     # Threat model
├── CHANGELOG.md
├── KICKOFF.md                      # ← you are here
├── .gitignore
├── .editorconfig
├── .ai/
│   ├── shared/
│   │   ├── PROJECT_BRIEF.md        # AUTHORITATIVE spec — all AI tools read this
│   │   ├── CODING_RULES.md         # Universal coding rules
│   │   └── ARCHITECTURE.md         # Diagrams + data flows
│   ├── design/
│   │   └── README.md               # Visual reference entry point
│   └── skills/
│       ├── design-reference.md     # Client visual implementation rules
│       ├── crypto.md               # Crypto/vault/auth
│       ├── laravel-backend.md      # Laravel 13 + Spatie Permission
│       ├── filament-admin.md       # Filament admin panel patterns ← NEW
│       ├── tauri-react-client.md   # Tauri + React patterns
│       ├── testing.md              # Testing strategy
│       └── git-workflow.md         # Commits/PRs
├── .github/
│   ├── copilot-instructions.md     # Auto-loaded by GitHub Copilot
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── ISSUE_TEMPLATE/
│       └── security.md
├── .cursor/
│   └── rules/                      # Auto-attached by Cursor
│       ├── 00-project-core.mdc     # Always applied
│       ├── 10-backend.mdc          # Auto when in apps/backend/**
│       ├── 15-filament-admin.mdc   # Auto when in app/Filament/** ← NEW
│       ├── 20-client.mdc           # Auto when in apps/client/**
│       ├── 30-crypto.mdc           # Auto when in crypto-relevant files
│       └── 40-testing.mdc          # Auto when in tests
├── .vscode/
│   ├── extensions.json
│   └── settings.json
└── docs/
    └── (populated by AI in later phases)
```

## How AI tools find their instructions

| Tool               | File it reads                     | When                                 |
| ------------------ | --------------------------------- | ------------------------------------ |
| **Claude Code**    | `CLAUDE.md`                       | On every session start               |
| **Codex**          | `AGENTS.md`                       | On every session start               |
| **GitHub Copilot** | `.github/copilot-instructions.md` | Automatically loaded                 |
| **Cursor**         | `.cursor/rules/*.mdc`             | Auto-attached based on glob patterns |

All four point back to the same source-of-truth files in `.ai/shared/` and `.ai/skills/`. Edit those once, all four tools update.

## The two surfaces of Trominal

This is the most important concept to grasp before starting:

### 1. Client app (Tauri + React)

The thing end-users live in. SSH terminals, snippets, tunnels, SFTP, AI. Cross-platform. Web + macOS + Windows + Linux today; mobile later.

### 2. Filament admin panel (`/admin` on the Laravel backend)

The operator's control room. Manages users, roles, permissions, teams, instance settings, audit log. Blade-based, lives at `https://<your-instance>/admin`. End-users never need to see this.

The first registered user gets BOTH `admin` and `user` roles, so they:

- Use the **client app** for their own SSH workflow (as a regular user)
- Use the **admin panel** to manage the instance (as an admin)

Subsequent users typically only get the `user` role unless promoted.

## How to start

### Step 1: Create the GitHub repo

```bash
unzip trominal-starter.zip
cd trominal
git init
git add .
git commit -m "chore: initial project scaffold and AI agent instructions"

# Either:
gh repo create trominal --private --source=. --push
# Or create the repo via web UI and push manually
```

Make it private at first. Flip to public after Phase 1 is solid and you've added a `LICENSE` file.

### Step 2: Add the LICENSE file

The brief commits to AGPL-3.0. Get the official text from:

https://www.gnu.org/licenses/agpl-3.0.txt

Save as `LICENSE` in the repo root before going public.

### Step 3: Pick your AI tool

#### Claude Code (recommended for the heavy lifting)

```bash
cd trominal
claude
```

Then say:

> Read CLAUDE.md and follow the working agreement. Begin with Phase 0.

#### Codex

```bash
cd trominal
codex
```

Then say:

> Read AGENTS.md and follow the working agreement. Begin with Phase 0.

#### Cursor

Open the folder. The `.cursor/rules/00-project-core.mdc` is `alwaysApply: true` so context loads automatically. Other rules attach based on which file you're editing.

In Cursor chat:

> Following the project brief, begin Phase 0.

#### GitHub Copilot

Open in VS Code. `.github/copilot-instructions.md` loads automatically. In Copilot Chat:

> Read the project brief and start Phase 0.

### Step 4: Watch the AI work

For each phase:

1. AI reads the brief, summarizes back to you
2. You confirm understanding
3. AI builds the phase
4. AI runs tests, commits, opens a PR
5. **You review** — most important step
6. Merge → next phase

Don't rubber-stamp PRs. Especially crypto, auth, and admin panel code — read every line. The AI is fast but not infallible.

## The phased plan (high level)

| Phase | Goal                                                           |
| ----- | -------------------------------------------------------------- |
| 0     | Foundation: monorepo, both apps scaffolded, Docker dev env, CI |
| 1     | Backend auth + single-user mode + Spatie Permission            |
| 2     | **Filament admin panel** (users, roles, permissions, settings) |
| 3     | Vault backend (encrypted resources, sync)                      |
| 4     | Client foundation: crypto, auth UI, master password unlock     |
| 5     | Hosts, snippets, identities, terminal (SSH)                    |
| 6     | Tunneling + SFTP                                               |
| 7     | AI integration (BYOK)                                          |
| 8     | Teams (shared workspaces with team-key crypto)                 |
| 9     | Polish, docs, v0.1.0 release                                   |

You can ship v0.1.0 after Phase 7 and defer teams to v0.2 if you want to release sooner.

## Switching AI tools mid-project

You can. All four tools read the same shared files. Just open the project in the new tool — context loads automatically.

The only thing that doesn't transfer is the conversation history with the previous AI. Hand off important decisions by adding them to:

- `CHANGELOG.md` — what was done
- `.ai/shared/PROJECT_BRIEF.md` — any spec changes
- A new file under `docs/decisions/NNN-title.md` for significant architecture decisions (ADR format)

## Customizing for your project

If you want to change a locked decision:

1. Edit `.ai/shared/PROJECT_BRIEF.md` (single source of truth)
2. AI tools pick up the change on next session
3. Add a `breaking:` or `docs:` commit explaining what changed and why

## Recommended order of operations

1. **Now:** push this scaffold to GitHub
2. **Today:** Phase 0 — basic monorepo + Docker dev environment
3. **This week:** Phase 1 (auth) + Phase 2 (Filament admin panel)
4. **Next week:** Phase 3 (vault backend) + Phase 4 (client foundation)
5. **Ongoing:** review every PR carefully, especially security-relevant code

The brief is comprehensive — trust it but verify the AI's work.
