# Agents

## Cursor Cloud specific instructions

### Overview

Aura is a single-service Next.js 16 + custom WebSocket server app. There is no database, no Docker Compose, and no monorepo — just one process serving both the frontend and the WebSocket proxy to Google's Gemini Live API.

### Running the dev server

```bash
npm run dev
```

This runs `tsx server/index.ts`, which boots both the Next.js dev server and the WebSocket server on **port 8080**. See `README.md` for full architecture details.

### Environment variables

Copy `.env.example` to `.env` and set `GEMINI_API_KEY`. Without a valid key, the server starts and serves the frontend but WebSocket sessions to Gemini will fail with "No API key configured on server."

### Lint / Build / Start

Standard scripts in `package.json`:
- `npm run lint` — runs ESLint (note: the codebase has pre-existing lint errors for `@typescript-eslint/no-explicit-any` and a React hooks ordering issue in `LiveAgent.tsx`)
- `npm run build` — runs `next build`
- `npm run start` — production mode via `tsx server/index.ts`

### Caveats

- The app requires webcam + microphone browser permissions for the live session feature. In headless/cloud environments, "Start Live Session" will show a permission error — this is expected.
- The server warns at startup if `GEMINI_API_KEY` is missing but does not crash; the frontend still loads normally.
- No automated test suite exists in this repo. Validation is manual (lint + build + browser check).
