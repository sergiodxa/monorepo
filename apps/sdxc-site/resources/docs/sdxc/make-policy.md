---
title: Make a policy
description: Write an authorization rule with sdxc make policy, a function that says whether an actor may do something, with the test that asks it.
section:
    title: The sdxc command
    order: 2
order: 2.09
lastUpdated: 2026-10-19
---

A policy answers one question: may this actor do this? `sdxc make policy` writes the rule in
`app/policies/`, apart from the controllers, jobs and tools that ask it, so every way in applies
the same answer:

```bash
sdxc make policy can-edit
```

```text
Wrote app/policies/can-edit.ts
Wrote app/policies/can-edit.test.ts
```

Reach for it whenever an action depends on who asks: editing a post, seeing an invoice, inviting
a member.

## Flags

| Flag                  | Default      | What it does                         |
| --------------------- | ------------ | ------------------------------------ |
| `--test`, `--no-test` | `make.tests` | write the test beside it, or skip it |
| `--dry-run`           |              | print the files and change nothing   |

## What it writes

A function named after the file's last segment in camelCase, starting from the rule that a
signed-in actor passes and an anonymous visitor does not:

```typescript {% title="app/policies/can-edit.ts" %}
/** Who an authorization rule is asked about; `null` for an anonymous visitor. */
export interface Actor {
	id: string;
}

/** Whether `actor` passes the Can edit rule. */
export function canEdit(actor: Actor | null): boolean {
	return actor !== null;
}
```

Nothing is declared or mapped. Group a resource's rules in a folder, `posts/can-edit` and
`posts/can-delete`, or in one file per resource as [`sdxc scaffold`](/docs/sdxc/scaffold-a-resource)
writes them.

## The test

```typescript {% title="app/policies/can-edit.test.ts" %}
import { describe, expect, test } from "vitest";

import { canEdit } from "~/app/policies/can-edit";

describe("canEdit", () => {
	test("refuses an anonymous visitor", () => {
		expect(canEdit(null)).toBe(false);
	});

	test("allows a signed-in actor", () => {
		expect(canEdit({ id: "1" })).toBe(true);
	});
});
```

```bash
bun run test app/policies/can-edit.test.ts
```

## Fill it in

Take the record the rule is about as a second parameter, and replace `Actor` with your app's user
type:

```typescript {% title="app/policies/can-edit.ts" %}
export function canEdit(actor: Actor | null, post: PostRow): boolean {
	return actor !== null && post.author_id === actor.id;
}
```

Ask it where the traffic arrives: in the controller's handler, in a middleware or a `lazy()`
guard for a group of routes, and in every MCP tool and command that reaches the same records.
Add a test per case the rule decides. [Authorization](/docs/identity-and-security/authorization)
covers roles, scopes and answering a refusal, and [`@sdxc/authz`](/api/authz) the whole API.

## Where to go next

- [Make a controller](/docs/sdxc/make-controller) — where most policies are asked.
- [Make a middleware](/docs/sdxc/make-middleware) — ask a policy for every route in a chain.
- [Generate files](/docs/sdxc/generate-files) — the flags, configuration and stubs every kind
  shares.
