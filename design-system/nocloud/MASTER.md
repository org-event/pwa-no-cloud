# Design System Master File

> Источник токенов: **Telegram Mini Apps · UI Kit (Community).fig**  
> (локально через OpenPencil CLI / MCP). Файл `.fig` в git не коммитим.

**Project:** NoCloud  
**Visual:** Telegram Mini Apps — светлая тема по умолчанию

---

## Color Palette (light)

| Role | Hex | CSS |
|------|-----|-----|
| Primary / CTA | `#007AFF` | `--color-primary` |
| Primary hover | `#3395FF` | `--color-primary-hover` |
| Background | `#EFEFF4` | `--color-background` |
| Card / surface | `#FFFFFF` | `--color-card` |
| Muted fill | `#F7F7F7` | `--color-muted` |
| Foreground | `#000000` | `--color-foreground` |
| Secondary text | `#707579` | `--color-muted-foreground` |
| Border | `#D9D9D9` | `--color-border` |
| Destructive | `#E53935` | `--color-destructive` |

Dark: `prefers-color-scheme: dark` → `#000` / `#1C1C1E` / `#2C2C2E` / `#8E8E93`.

## Typography

- Stack: SF Pro / system UI (`-apple-system`, `Segoe UI`, Roboto…)
- Body: **17 / 22** (`--font-size-body`)
- Secondary / legend: **15 / 20** (`--font-size-secondary`)
- Button label: 17 semibold

## Spacing & radius

| Token | Value | Notes from kit |
|-------|-------|----------------|
| `--space-sm` | 8px | gaps |
| `--space-md` | 12px | padding mode |
| `--space-lg` | 16px | section |
| `--avatar-gap` | 12px | avatar ↔ name |
| `--radius-control` | 10px | Button (iOS) |
| `--radius-field` | 12px | text fields |
| `--control-height` | 50px | primary button |
| `--field-height` | 44px | inputs |

## Components

- **Button:** fill `#007AFF`, height 50, radius 10, no heavy shadow
- **Input (outlined-field):** white card fill, 1px border, focus ring 3px primary @22%
- **Avatar:** circle 40px default; row min-height 52px

## Anti-patterns

- Не коммитить `.fig` (gitignore `*.fig`)
- Не Inter как единственный brand-font (kit = SF Pro / system)
- Не тёмный slate `#0F172A` как default light
