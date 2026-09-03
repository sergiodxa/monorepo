---
title: Use One Kebab-Case Name Everywhere
impact: HIGH
tags: [packages, naming, conventions]
---

# Use One Kebab-Case Name Everywhere

The directory under `packages/` and the segment after `@sdxc/` are the same kebab-case
string. The README H1 is the full scoped name.

## Why

- **`bun install` resolves workspaces by the `packages/*` glob.** Directory and package
  name drifting apart makes the workspace awkward to address from either side.
- **The import path is the only name most readers ever see.** `@sdxc/data-table-d1`
  reading as `packages/dataTableD1` on disk costs a lookup every time somebody goes from
  an import to the source.
- **Kebab-case is what all 49 of them use.** Consistency here is the whole benefit.

## Pattern

```text
# Bad
packages/dataTableD1/     -> "@sdxc/data-table-d1"
packages/session_kv/      -> "@sdxc/session-storage-kv"

# Good
packages/data-table-d1/       package.json -> "@sdxc/data-table-d1"
packages/session-storage-kv/  package.json -> "@sdxc/session-storage-kv"
README.md                     -> "# @sdxc/data-table-d1"
```

Name the package for what it is, not for who uses it: `@sdxc/hostname`, not
`@sdxc/blog-saas-hostnames`. A name that carries an app in it is a name that stops being
true the second app adopts it.

## Rules

1. Directory name and the `@sdxc/` segment are the same kebab-case string
2. README H1 is the full scoped name, `# @sdxc/<name>`
3. Name for the capability, never for a consumer
