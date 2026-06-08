# 快乐识字 (hanzi-learn)

## Stack

- **Runtime** — Next.js 14 (App Router) on Node.js
- **Language** — TypeScript (strict mode)
- **UI** — React 18, Tailwind CSS 3, Framer Motion 11
- **Chart** — Recharts 2 (parent dashboard only)
- **AI API** — DeepSeek Chat (API key via `DEEPSEEK_API_KEY` env)

## Layout

```
src/
├── app/              Next.js App Router pages + API
│   ├── api/generate/ DeepSeek proxy + output validation
│   ├── child/        Kids' UI (word bank picker, sentence page)
│   └── parent/       Password gate, stats dashboard, settings
├── components/       React components, grouped by domain
├── hooks/            useSound, useWeightEngine, useStats, useIdleTimeout
└── lib/              Pure-logic modules (validator, weightEngine, wordBanks, etc.)
```

## Commands

| Action | Command |
|--------|---------|
| dev server  | `npm run dev` |
| production build | `npm run build` |
| start prod  | `npm run start` |
| lint        | `npm run lint` |

## Conventions

- **All interactive pages** use `'use client'` — there are no Server Components in the UI layer.
- **`src/lib/` modules are pure functions** with no React dependencies; importable from both client and API routes.
- **`HELPERS` array** in `wordBanks.ts` contains ~65 common Chinese characters auto-appended to every word bank (gated by `getEffectiveUseHelpers()`).
- **Weight engine** tracks only theme chars; helpers are excluded from weight tracking.
- **All data persistence** uses `localStorage` via `storage.ts` (try/catch wrapped for SSR privacy mode).
- **Sound** uses Web Audio API + Web Speech API — no audio files loaded.

## Watch out for

- **`.env.local`** must contain `DEEPSEEK_API_KEY=sk-...` for AI generation; without it, every request returns a hardcoded fallback sentence.
- **`edit_file` SEARCH must match byte-for-byte.** When the file has been edited multiple times in one session, read the current content first — stale SEARCH will be rejected.
- **`run_background` does NOT support `&&`, `|`, or `$()`** — use two separate calls for sequential operations (e.g. `kill` then `start`).
- **DeepSeek v4 flash** model uses reasoning tokens that can consume the `max_tokens` budget; if responses come back empty, switch to `deepseek-chat` (no reasoning).
- **Next.js build overwrites `.next/`** which kills the running dev server; after `npm run build`, you must `kill -9 <pid>` and restart dev.
