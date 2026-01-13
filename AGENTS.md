# Frontend Agent Rules

See [`AGENTS.md`](https://github.com/sajankp/to-do/blob/main/AGENTS.md) and [development workflows](https://github.com/sajankp/to-do/tree/main/.agent/workflows) for full development workflows.

## Frontend-Specific Notes

- **Framework:** Vite + React 19 + TypeScript
- **API Layer:** All backend calls go through `services/api.ts`
- **Styling:** Tailwind CSS (via CDN) for utility-first styling
- **Components:** Reusable components in `components/` directory

## Key Patterns

- JWT tokens stored in `localStorage`, attached via `api.ts` interceptor
- Voice assistant uses backend proxy for Gemini API (not direct client calls)
- All new components should follow existing patterns in `components/`
