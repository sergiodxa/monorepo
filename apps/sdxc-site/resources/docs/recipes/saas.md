---
title: Build a SaaS
description: A multi-tenant app where people sign in, work inside a team, pay per team for a plan, get only what their role and plan allow, and invite teammates by email.
section:
    title: Recipes
    order: 1.7
order: 2
lastUpdated: 2026-10-25
outcomes:
    - "How to build a SaaS from the identity, billing and email guides, in order"
    - "Where the signed-in member meets the team's plan and the policy"
    - "How to check that a team's purchase opens a gated page"
---

At the end of this recipe you have a SaaS on Workers: people sign in with your identity
provider, each works inside a team, a team buys a plan through a hosted checkout, every page
answers from the member's role and the team's plan, and members invite teammates by email.
Each linked guide lists the packages it installs; the code on this page adds:

```bash
npm add @sdxc/authz @sdxc/billing @sdxc/result remix
```

## Create the app and model teams

`sdxc create` writes an app with the session, the policy binding, email and jobs already wired
in, and every later step extends them: follow
[Create the project](/docs/getting-started/build-an-app#create-the-project). Then add `teams`,
`users` keyed on the provider's subject, and `memberships` holding each user's `role` in a team,
with [Model your tables](/docs/data-and-background-work/data-models).

## Sign people in

Follow [Sign in with OpenID Connect](/docs/identity-and-security/sign-in-with-oidc), putting
`page` on its controllers instead of adding a second session to the router. The callback stores
who signed in as `ctx.session.set(ACTOR_KEY, { id, teamId })`, the shape the next steps read,
and creates the user's team and an `admin` membership on a first sign-in.

## Charge each team

The team is the customer: it pays, and every member uses what it holds. Follow
[Charge for your app](/docs/data-and-background-work/billing) with the team as the account, so
`linkCustomer` runs when the callback creates a team and every snapshot is keyed by team id.
The billing middleware's `entitlements` reader is `teamEntitlements`, below.

## Decide who can do what

Write the abilities, roles and guards from
[Decide who can do what](/docs/identity-and-security/authorization), with
`actor: fact<Actor>({ optional: true })` and `Actor` as `{ id: string; teamId: string }`. The
app's binding becomes the one place that joins the signed-in member, their role and their
team's plan:

```typescript {% title="app/http/middleware/access.ts" %}
import type { RequestContext } from "remix/router";

import { fromEntitlements } from "@sdxc/authz/facts/billing";
import { access } from "@sdxc/authz/middleware/router";
import * as s from "remix/data-schema";
import { Session } from "remix/session";

import type { Actor } from "~/app/policies/policy";

import { renderDenied } from "~/app/http/middleware/denied";
import { Entitlements } from "~/app/models/entitlements";
import abilities from "~/app/policies/abilities";
import policy from "~/app/policies/policy";

export const ACTOR_KEY = "actor";

const STORED_ACTOR = s.object({ id: s.string(), teamId: s.string() });

export function signedIn(session: Session | undefined): Actor | undefined {
	let stored = s.parseSafe(STORED_ACTOR, session?.get(ACTOR_KEY));
	return stored.success ? stored.value : undefined;
}

export async function teamEntitlements(ctx: RequestContext) {
	let actor = signedIn(ctx.get(Session));
	return actor ? await Entitlements.snapshot(ctx.db, actor.teamId) : null;
}

export default access(policy, {
	roles: async (ctx) => {
		let actor = signedIn(ctx.get(Session));
		if (actor === undefined) return [];
		let { id: user_id, teamId: team_id } = actor;
		let membership = await ctx.models.memberships.findBy({ team_id, user_id });
		return membership === null ? [] : [membership.role];
	},
	facts: {
		actor: (ctx) => signedIn(ctx.get(Session)),
		billing: fromEntitlements(),
	},
	load: [abilities],
	onDenied: renderDenied,
});
```

> [!NOTE]
> The billing middleware runs in the router, but `teamEntitlements` reads the session, which the
> page chain loads. Put `page` before `requireEntitlement` on every gated page.

## Invite teammates by email

Declare a `teams.invite` email and queue it from the invite action with
[Send email](/docs/data-and-background-work/send-email), passing the invitee's locale. Its link
opens a page that adds a `member` membership for the signed-in user.

## Test the stages together

Sign in through `signIn({ id, teamId })` from the app's test helpers, request the gated page
from [Gate a feature](/docs/data-and-background-work/billing#gate-a-feature) through the router,
and expect a redirect to pricing. Then buy the plan and sync it as
[the billing guide's test](/docs/data-and-background-work/billing#test-the-sync-against-an-in-memory-platform)
does, with the team id as the customer's `externalId`, and expect the page.

## Deploy

Set the provider's client and the billing platform's secrets with
[Deploy your app](/docs/getting-started/first-deploy) before the first `sdxc deploy`.

## Where to go next

- [Custom domains for your customers](/docs/identity-and-security/verify-domains) — serve each
  team on a domain it proves it owns.
- [Enterprise sign-on with SAML and SCIM](/docs/identity-and-security/enterprise-sso) — sign in
  and provision a larger customer's people from their own directory.
- [Feature flags](/docs/data-and-background-work/feature-flags) — roll a change out to some
  teams before the rest.
