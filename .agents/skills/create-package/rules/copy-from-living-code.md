---
title: Copy Each Concern From the Package That Ships It
impact: HIGH
tags: [packages, references, reuse]
---

# Copy Each Concern From the Package That Ships It

Past the minimum file set, do not invent a shape. Open the package that already ships that
concern, read how it does it, and copy that. There are 49 of them; one of them has already
solved it.

## Why

- **A shipping package is a spec that cannot go stale.** A template directory records what
  was true when somebody last touched it; `packages/hostname` records what the repo
  merged this month.
- **The concerns differ in the details that matter.** An HTTP client needs MSW-backed
  tests and `remix/data-schema` response validation; a CLI needs a `bin` field and a
  shebang; a mocks package needs `@cloudflare/workers-types` in its tsconfig. No single
  example carries all of that.

## Pattern

| Concern | Read | Why this one |
| --- | --- | --- |
| Pure functions, one export per file | `packages/result` | The cleanest barrel: explicit re-exports, one concept per file, a test beside each |
| A client over an external HTTP API | `packages/hostname` | Calls the global `fetch` directly, validates every response with `remix/data-schema`, maps failures onto a typed error, and takes its config through the constructor so it is DI-friendly |
| MSW-backed tests for outbound HTTP | `packages/hostname` (`src/index.test.ts`) | `setupServer` from `msw/node` with `beforeAll`/`afterEach`/`afterAll`, which is the only sanctioned way to fake HTTP here |
| Cloudflare binding test doubles | `packages/cloudflare-mocks` | A large flat `src/` with a barrel, plus the tsconfig override that pulls in `@cloudflare/workers-types` |
| A package with a CLI | `packages/spec` | The `bin` field pointing at `./src/cli.ts`, and a `build` script that compiles a standalone binary with `bun build --compile` |
| Many entry points off one src tree | `packages/u` | Wildcard `exports` per group, each group with its own `index.ts`, plus a `.css` export |
| Subpath-only surface, no root export | `packages/http` | Every capability behind its own path (`/status-code`, `/response/json`, `/middleware/head-requests`) and no `"."` at all |
| Middleware that augments `RequestContext` | `packages/logger` (`src/middleware.ts`) | The `declare module "remix/router"` augmentation shipped from the package rather than from each app's `config/` |
| Types-only package | `packages/types` | What a package looks like with no runtime code at all |

```text
# Bad
"I'll write the MSW setup from memory."

# Good
open packages/hostname/src/index.test.ts  ->  copy the setupServer lifecycle,
                                              then write this package's handlers
```

Two rules from the root `AGENTS.md` are worth restating because they are the ones a
from-memory HTTP client gets wrong:

- Call the global `fetch` directly. Never add an injectable fetch parameter such as
  `fetchImpl: typeof fetch = fetch`; tests intercept with MSW.
- Validate untrusted data with `remix/data-schema` through `@pkg/validate`. Do not add Zod.

## Rules

1. Open the referenced package before writing a concern past the minimum
2. Copy the shape, then write this package's own reasoning next to it
3. Never name an app in a comment or README — see [keep-packages-app-agnostic](./keep-packages-app-agnostic.md)
4. Use MSW for outbound HTTP in tests; never stub `globalThis.fetch` or inject a fake
5. When no package ships the concern yet, write an ADR for the decision
