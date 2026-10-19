---
title: Make a policy
description: Add a resource's create, read, update and delete abilities to the app's catalog and grant them in its policy with sdxc make policy, with the test that decides them.
section:
    title: The sdxc command
    order: 2
order: 2.09
lastUpdated: 2026-10-19
---

An app's authorization lives in two files: `app/policies/abilities.ts`, the catalog of everything
a visitor can do, and `app/policies/policy.ts`, which grants those abilities to roles. Both use
[`@sdxc/authz`](/api/authz), and every page, endpoint, tool and job checks the same abilities
through them. `sdxc make policy` adds one resource to both:

```bash
sdxc make policy post
```

```text
Wrote app/policies/post.test.ts
Edited app/policies/abilities.ts
Edited app/policies/policy.ts
```

Reach for it whenever a resource needs rules about who reads and who changes it: posts, invoices,
team members.

## Flags

| Flag                  | Default      | What it does                                  |
| --------------------- | ------------ | --------------------------------------------- |
| `--test`, `--no-test` | `make.tests` | write the test, or skip it                    |
| `--dry-run`           |              | print the test and both edits, change nothing |

## What it edits

The catalog gains the resource's four abilities. `read`, `update` and `delete` are checked
against a record, typed by the model's row when `app/models/post.ts` exports `PostRow` and by
`{ id: string }` otherwise; a refused `read` answers as not found, so a hidden post looks exactly
like a missing one:

```typescript {% title="app/policies/abilities.ts" %}
import type { PostRow } from "~/app/models/post";

import { abilities, ability, context } from "@sdxc/authz";

export default abilities({
	post: {
		create: ability(),
		read: ability({
			context: context<{ post: PostRow }>("post"),
			deniedAs: "notFound",
		}),
		update: ability({ context: context<{ post: PostRow }>("post") }),
		delete: ability({ context: context<{ post: PostRow }>("post") }),
	},
});
```

The policy grants the read to everyone and the writes to members:

```typescript {% title="app/policies/policy.ts" %}
const policy = definePolicy(abilities, {
	facts: { actor: fact<Actor>({ optional: true }) },
	everyone: [allow("post.read", { id: "post-read" })],
	roles: {
		member: [
			allow(["post.create", "post.update", "post.delete"], {
				id: "post-write",
			}),
		],
	},
});
```

A visitor is a `member` once the session holds them: the app template's
`app/http/middleware/access.ts` binds `member` and the `actor` fact for a session where
`ctx.session.set("actor", { id })` ran, and a guest otherwise. A folder in the name nests the
abilities, so `sdxc make policy billing/invoice` declares `billing.invoice.read` and its siblings.

When the catalog or the policy is missing, or not written the way `make` can edit, it writes the
test and prints the lines to add to each file instead.

## The test

The test decides every ability for a guest and a member with `testAccess` from
`@sdxc/authz/testing`:

```typescript {% title="app/policies/post.test.ts" %}
import type { ContextOf } from "@sdxc/authz";

import { testAccess } from "@sdxc/authz/testing";
import { describe, expect, test } from "vitest";

import abilities from "~/app/policies/abilities";
import policy from "~/app/policies/policy";

const RECORD = { id: "1" } as ContextOf<typeof abilities.post.read>["post"];

describe("post", () => {
	test("lets a guest read one", () => {
		let guest = testAccess(policy, { roles: [] });

		expect(guest.can(abilities.post.read, { post: RECORD })).toBe(true);
	});

	test("lets a member create, update and delete one", () => {
		let member = testAccess(policy, {
			roles: ["member"],
			facts: { actor: { id: "1" } },
		});

		expect(member.can(abilities.post.create)).toBe(true);
		expect(member.can(abilities.post.update, { post: RECORD })).toBe(true);
		expect(member.can(abilities.post.delete, { post: RECORD })).toBe(true);
	});
});
```

```bash
bun run test app/policies/post.test.ts
```

## Fill it in

Narrow a grant with a condition. Letting members change only their own posts reads the record
and the actor:

```typescript {% title="app/policies/policy.ts" %}
const policy = definePolicy(abilities, {
	facts: { actor: fact<Actor>({ optional: true }) },
	conditions: {
		author: {
			op: "all",
			of: [
				{ op: "exists", field: "actor" },
				{ op: "eq", field: "post.author_id", path: "actor.id" },
			],
		},
	},
	everyone: [allow("post.read", { id: "post-read" })],
	roles: {
		member: [
			allow("post.create", { id: "post-create" }),
			allow(["post.update", "post.delete"], {
				id: "post-own",
				when: { op: "condition", name: "author" },
			}),
		],
	},
});
```

Check the abilities where the traffic arrives. A handler reads `ctx.access`, bound by the page
and API middleware with every ability loaded, so a check is synchronous:

```typescript {% title="app/http/controllers/posts/show.tsx" %}
let row = await ctx.models.post.find(ctx.params.id);
if (row === null || !ctx.access.can(abilities.post.read, { post: row })) {
	return new Response(null, { status: 404 });
}
```

Add a test case for each condition, and give the record the fields it reads.
[Authorization](/docs/identity-and-security/authorization) covers roles, guards, scopes and
answering a refusal, and [`@sdxc/authz`](/api/authz) the whole API.

## Where to go next

- [Scaffold a resource](/docs/sdxc/scaffold-a-resource) — pages, tools and tests that check these
  abilities, written together.
- [Make a controller](/docs/sdxc/make-controller) — `--resource` checks these abilities in a new controller.
- [Generate files](/docs/sdxc/generate-files) — the flags, configuration and stubs every kind
  shares.
