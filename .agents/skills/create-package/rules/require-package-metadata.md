---
title: Require Package Metadata Before Writing Files
impact: HIGH
tags: [packages, bootstrapping, inputs]
---

# Require Package Metadata Before Writing Files

Ask for the package name, its one-line description, and the surface it will expose before
creating `packages/<name>/`. The surface is not a detail to be discovered while writing —
it is what decides how many `exports` entries there are and whether `src/` is one file or
twelve.

## Why

- **The `exports` map is a contract.** Every entry is an import path a consumer may write,
  and removing one later is a breaking change across the repo. Deciding the surface up
  front is what keeps the map from accreting an entry per file.
- **The description is the README's second line and the package's reason to exist.** A
  package that cannot be described in one line is usually two packages, or a helper that
  belongs in the app that needs it.
- **Whether it is app-agnostic is decided at this point.** If the honest description names
  an app, the thing being built is app code.

## Pattern

```text
# Bad: start with a file and let the surface emerge
packages/hostname/src/index.ts  ->  export function doTheThing() { … }
                                    (twelve exports later, nobody knows what it is)

# Good: decide first
name:        hostname                       -> @pkg/hostname
description: Cloudflare for SaaS custom-hostname client.
surface:     one class HostnameClient, HostnameApiError, and the option/result types
             -> one entry point: "." -> ./src/index.ts
```

Ask two more questions while you are asking:

- **Does this need to be a package?** It does when two workspaces need it, or when the
  logic is worth testing away from a request. A helper one app uses stays in that app's
  `app/lib/`.
- **What does it depend on?** Every `@pkg/*` it uses is a `workspace:*` dependency, and a
  package depending on an app is not a package.

## Rules

1. Require the package name, the one-line description, and the intended public surface before creating the directory
2. Turn the surface into the `exports` map before writing `src/`
3. Reject the package if the honest one-line description names an app — that is app code
4. List the `@pkg/*` dependencies up front, as `workspace:*`
