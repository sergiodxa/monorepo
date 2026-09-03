---
title: Keep Packages App-Agnostic
impact: HIGH
tags: [packages, boundaries, comments]
---

# Keep Packages App-Agnostic

A package may not import from `apps/*`, and may not name an app in its code, its comments,
or its README. Anything that varies per consumer is a constructor option, a function
parameter, or a generic — never a branch on which app is calling.

## Why

- **The dependency only points one way.** Apps depend on packages; a package that reaches
  back is a cycle that Bun will happily resolve and nobody can reason about.
- **A named app in a comment is a fact with an expiry date.** It stops being true the
  second app adopts the package, and nothing fails when it does — the comment just
  quietly starts lying.
- **Configurability is the test of whether the abstraction is right.** If a value cannot
  be lifted into an option, the package is carrying an assumption that belongs to one
  consumer.

## Pattern

```ts
// Bad: the package knows who is calling
import { BLOG_ZONE_ID } from "../../apps/blog-saas/config/zones";

/** Custom-hostname client for the blog-saas control plane. */
export class HostnameClient {
	async listForBlog(blogId: string) {
		// blog-saas stores the blog id under `blog_id`
		return this.list({ blog_id: blogId });
	}
}
```

```ts
// Good: the varying part is an option, and the comment describes the mechanism
/**
 * The stored `custom_metadata` key that identifies the owning entity is configurable
 * via the constructor (`metadataKey`), so a caller keys hostnames by whatever entity id
 * it owns — nothing about the metadata written to Cloudflare changes.
 */
export class HostnameClient {
	constructor(options: { zoneId: string; metadataKey: string }) {}

	async listForEntity(entityId: string) {
		return this.list({ [this.metadataKey]: entityId });
	}
}
```

The same applies to prose:

```markdown
<!-- Bad, in packages/hostname/README.md -->

Used by the blog-saas control plane to attach custom domains to a blog.

<!-- Good -->

Attaches a custom hostname to a Cloudflare zone and tracks its SSL validation, keying
each hostname to the caller's own entity id through `custom_metadata`.
```

The rule reaches one step further for public content: articles and tutorials in the blog
must not mention `@sdxc/*` imports or `packages/*` paths either — they use public APIs or
local example modules.

## Rules

1. No imports from `apps/*`, ever
2. No app named in code, comments, README, or JSDoc — describe the package on its own terms
3. Lift anything consumer-specific into a constructor option, parameter, or type parameter
4. Name the package for its capability, not for who uses it
5. If the package cannot be described without naming an app, it is app code — put it in that app's `app/lib/`
