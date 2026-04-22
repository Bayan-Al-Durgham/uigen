# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Initial setup (installs deps, generates Prisma client, runs migrations)
npm run setup

# Development server (Turbopack)
npm run dev

# Run tests (watch mode)
npm test

# Run a single test file
npx vitest run src/components/__tests__/SomeComponent.test.tsx

# Lint
npm run lint

# Build for production
npm run build

# Reset database
npm run db:reset
```

## Environment

Requires an `.env` file with:
- `ANTHROPIC_API_KEY` — without it, the app falls back to `MockLanguageModel` that generates deterministic placeholder code based on prompt keywords (form/card/counter)
- `JWT_SECRET` — optional; defaults to `"development-secret-key"` if unset (must be set in production)

## Architecture

UIGen is a Next.js 15 App Router app where users describe React components in a chat interface and Claude generates them in real-time with live preview.

### AI Tool-Use Loop

The core flow lives in `src/app/api/chat/route.ts`. It uses the Vercel AI SDK's `streamText()` with two registered tools and up to 40 tool-use steps (reduced to 4 for the mock provider):

- `str_replace_editor` (`src/lib/tools/str-replace.ts`) — creates or edits files via string replacement commands
- `file_manager` (`src/lib/tools/file-manager.ts`) — renames or deletes files

The system prompt (in `src/lib/prompts/generation.tsx`) instructs Claude to always use `/App.jsx` as the entry point, use Tailwind CSS, use `@/` for local imports, and never create HTML files.

Prompt caching is enabled via `providerOptions.anthropic.cacheControl` on the system message. The route has a 120-second timeout and 10,000 max output tokens.

The AI model is selected in `src/lib/provider.ts`: real Claude (`claude-haiku-4-5-20251001`) when `ANTHROPIC_API_KEY` is set, otherwise `MockLanguageModel`.

### Virtual File System

All generated files are stored in-memory via `VirtualFileSystem` (`src/lib/file-system.ts`) — nothing is written to disk. The file tree is serialized to a `Record<string, FileNode>` plain object (children maps are excluded from serialization and reconstructed via `deserializeFromNodes()`). This JSON is stored in the `Project.data` column in SQLite.

State is managed through `FileSystemProvider` context (`src/lib/contexts/file-system-context.tsx`). Tool call results from the AI stream are intercepted here via `handleToolCall()`, which applies changes to the VFS and increments a `refreshTrigger` counter to signal re-renders.

### Live Preview

`src/components/preview/PreviewFrame.tsx` renders a sandboxed iframe. The transform layer (`src/lib/transform/`) uses Babel standalone to transpile JSX at runtime and constructs an import map with blob URLs for all virtual files.

Entry point detection order: `/App.jsx` → `/App.tsx` → `/index.jsx` → `/index.tsx` → `/src/App.jsx` → `/src/App.tsx` → first `.jsx`/`.tsx` file found.

Each file is registered in the import map under four aliases: `/path`, `path`, `@/path`, and `@path`. Third-party package imports are resolved via `esm.sh`. CSS imports are stripped from JS code and injected as `<style>` tags instead. Tailwind CSS is loaded via CDN in the preview iframe.

### State Management

Two React contexts carry app state:

- `ChatProvider` (`src/lib/contexts/chat-context.tsx`) — wraps Vercel AI SDK's `useChat`, owns message history and triggers saves to the database
- `FileSystemProvider` (`src/lib/contexts/file-system-context.tsx`) — owns the `VirtualFileSystem` instance and processes tool call results from the AI stream

### Authentication & Persistence

- JWT sessions via `jose`, stored in httpOnly cookies (7-day expiry) — see `src/lib/auth.ts`
- Prisma + SQLite: `User` (email, password) and `Project` (name, nullable userId, messages, data). Both `messages` and `data` are stored as JSON strings — always `JSON.stringify()`/`JSON.parse()` when reading/writing.
- Anonymous usage is supported; `userId` is nullable on `Project`. Anonymous work is tracked in `sessionStorage` via `src/lib/anon-work-tracker.ts`.
- Server actions in `src/actions/` handle auth and project CRUD
- `src/middleware.ts` protects `/api/projects` and `/api/filesystem` routes

### UI Layout

`src/app/main-content.tsx` is the root UI shell. It uses `react-resizable-panels` for a two-column layout: chat (default 35%, min 25%, max 50%) and a tabbed code editor/preview panel (default 65%). Code editor uses Monaco (`@monaco-editor/react`) with vs-dark theme. Shadcn/ui components (Radix UI + Tailwind v4) are in `src/components/ui/`.

### Testing

Tests use Vitest + React Testing Library, colocated in `__tests__` directories next to the code they test. Configuration is in `vitest.config.mts` (jsdom environment). External dependencies like Babel and Monaco are mocked with `vi.mock()`.

### Path Alias

`@/` maps to `src/` throughout the codebase (configured in `tsconfig.json`). This alias also works inside the virtual file system — generated code uses `@/` for cross-file imports.
