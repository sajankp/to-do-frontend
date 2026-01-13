# Frontend Agent Rules

See `../to-do/AGENTS.md` and `../to-do/.agent/workflows/` for full development workflows.

## Frontend-Specific Notes

- **Framework:** Vite + React 19 + TypeScript
- **API Layer:** All backend calls go through `services/api.ts`
- **Styling:** Inline styles with CSS-in-JS patterns
- **Components:** Reusable components in `components/` directory

## Key Patterns

- JWT tokens stored in `localStorage`, attached via `api.ts` interceptor
- Voice assistant uses backend proxy for Gemini API (not direct client calls)
- All new components should follow existing patterns in `components/`
