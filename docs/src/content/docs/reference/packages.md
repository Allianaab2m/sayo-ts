---
title: Packages
description: The packages sayo ships and what they need.
---

| Package | Description |
| --- | --- |
| `@sayo-ts/core` | `UseCase`, `Fault`, `Http`, `App` |
| `@sayo-ts/create` | Templates for `vp create @sayo-ts`. The `api` template doubles as the example app. |
| `@sayo-ts/cli` | `sayo dev` serves a profile and restarts on changes; `sayo generate usecase <name>` writes a skeleton. Built with [`Cli`](../../guides/cli/). |

Project setup, tests, formatting and linting are left to [Vite+](https://viteplus.dev). The sayo CLI only covers what Vite+ cannot.

## Requirements

- TypeScript 5.9+
- Node.js 22.18+ (or 24.11+)
- effect 4.x
