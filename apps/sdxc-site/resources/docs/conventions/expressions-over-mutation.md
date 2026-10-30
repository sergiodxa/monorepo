---
title: Expressions over mutation
description: Produce one value from branching control flow with an immediately invoked callback, and know when the block deserves a name instead.
section:
    title: Conventions
    order: 3
order: 6
lastUpdated: 2026-10-25
outcomes:
    - "How `iife` turns `if` chains into a single assignment"
    - "What `iife` returns for a sync and an async callback"
    - "When to extract a named function instead"
---

A value decided by more than one condition tends to arrive as an outer `let` filled by
`if`/`else`, or as a nested ternary. [`@sdxc/iife`](/api/iife) runs a callback on the spot and
hands back what it returns, so a block of statements sits where only an expression fits and the
value is assigned exactly once.

```bash
npm add @sdxc/iife
```

## Assign once with an immediately invoked callback

Wrap the decision in `iife` and each branch returns its value instead of assigning an outer
`let`:

```typescript {% title="app/services/drafts/status.ts" %}
import { iife } from "@sdxc/iife";

export interface Draft {
	title: string;
	publishedAt: Date | null;
	scheduledFor: Date | null;
}

export function describeDraft(draft: Draft) {
	let label = iife(() => {
		if (draft.publishedAt !== null) return "Published";
		if (draft.scheduledFor !== null) return "Scheduled";
		return "Draft";
	});

	return `${draft.title} (${label})`;
}
```

`iife` calls the callback once, synchronously, and returns its result, so `label` takes the type
of what the branches return. The same block fits an object field or a JSX child, where a nested
ternary usually appears.

> [!NOTE]
> A `return` inside the callback leaves the callback. To leave the enclosing function on one of
> the branches, return a value that says so from the callback and branch on it after the
> assignment.

An async callback gives you a promise, which you `await` like any other:
`let viewer = await iife(async () => { … })`. A callback that throws surfaces where the `iife`
call stands; for code that throws, reach for `wrap` from
[`@sdxc/result`](/docs/conventions/result-everywhere#cross-the-boundary-with-wrap), which
returns the failure as a value.

## Extract a named function when the block grows

`iife` suits a decision short enough to read in place. Give the block a name when another
module needs the same decision, when it deserves a test of its own, or when it reads many
locals from the enclosing scope:

```typescript {% title="app/services/billing/plan-notice.ts" %}
export interface PlanState {
	plan: "free" | "pro" | "enterprise";
	trialEndsAt: Date | null;
}

/** The support line every page shows for a plan; an active trial outranks the plan's own. */
export function planNotice({ plan, trialEndsAt }: PlanState): string {
	if (plan === "enterprise") return "Priority support is on.";
	if (trialEndsAt !== null) return `Trial ends ${trialEndsAt.toDateString()}.`;
	return "Standard support.";
}
```

## Test the decision through its function

An inline `iife` is part of the function around it, so test that function: every branch of the
callback is a case of its output.

```typescript {% title="app/services/drafts/status.test.ts" %}
import { expect, test } from "vitest";

import { describeDraft } from "~/app/services/drafts/status";

test("labels a draft by the furthest state it reached", () => {
	let base = { title: "Launch", publishedAt: null, scheduledFor: null };

	expect(describeDraft(base)).toBe("Launch (Draft)");
	expect(describeDraft({ ...base, scheduledFor: new Date() })).toBe(
		"Launch (Scheduled)",
	);
	expect(describeDraft({ ...base, publishedAt: new Date() })).toBe(
		"Launch (Published)",
	);
});
```

## Where to go next

- [Result everywhere](/docs/conventions/result-everywhere) — `wrap` for code that throws, and
  the early returns these callbacks are written in.
- [Naming](/docs/conventions/naming) — the names an extracted function and its exports follow.
- [`@sdxc/iife`](/api/iife) — the one export and its signature.
