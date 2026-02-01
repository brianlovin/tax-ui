# Taxes

Tax return PDF parser using Claude API and Bun.

## Stack

- Bun with HTML imports (React frontend)
- Anthropic SDK for PDF parsing
- Tailwind CSS v4
- Zod for schema validation

## Commands

- `bun run dev` — Start dev server with HMR
- `bun run build` — Production build

## Architecture

- `src/index.ts` — Bun.serve() routes
- `src/lib/parser.ts` — Claude API PDF parsing
- `src/lib/storage.ts` — Local file persistence
- `src/App.tsx` — React frontend entry

## Components

Use shared components from `src/components/` instead of raw HTML:
- `Button` — all buttons (variants: primary, secondary, ghost, outline, danger, pill)
- `Dialog` — modals and dialogs (wraps Base UI Dialog)
- `Menu` / `MenuItem` — dropdown menus
- `Tooltip` — hover tooltips
- `Tabs` — use `@base-ui/react/tabs` for tab navigation

When adding new UI patterns, check if Base UI has a primitive first: https://base-ui.com

## Patterns

### Modal State
Use a single union state for mutually exclusive modals:
```tsx
const [openModal, setOpenModal] = useState<"settings" | "reset" | null>(null);
```
Not separate booleans for each modal.

## Verification

After changes, run type check only:
- `bunx tsc --noEmit`

Do NOT run `bun run build` — the dev server uses HMR so builds are unnecessary during development.
