---
title: Invite a teammate
description: Let a team's admins invite someone by email with a single-use link whose token only the invitee ever sees.
section:
    title: Recipes
    order: 1.7
order: 7
lastUpdated: 2026-10-25
outcomes:
    - "What guides build a team invitation, and in what order to follow them"
    - "How to mint, store and email an invitation link from one guarded action"
    - "Why the database keeps only the invitation token's digest"
---

By the end of this recipe a team admin types an address, the invitee receives a link, and
following it adds them to the team. The link carries a random token, the database keeps only its
digest, and the policy decides who may send one.

```bash
npm add @sdxc/authz @sdxc/http @sdxc/result @sdxc/validate remix
```

## Decide who may invite

The guard comes first, so everything after it runs only for someone allowed to invite. Follow
[Decide who can do what](/docs/identity-and-security/authorization) through
[Guard a route](/docs/identity-and-security/authorization#guard-a-route), adding
`team: { invite: ability({ description: "Invite people to the team" }) }` to the catalog, which
the `admin` role's `allow("*")` grants and a `member` never holds.

## Mint the invitation

Follow
[Mint secrets with randomToken](/docs/conventions/identifiers-and-secrets#mint-secrets-with-randomtoken)
for `issueInvitation`, and add an `email` column to the invitation's table so you know who it was
for.

## Email the link

Follow [Send email](/docs/data-and-background-work/send-email) through
[Deliver queued email](/docs/data-and-background-work/send-email#deliver-queued-email), declaring
`teams.invite` with `team` and `url` props. The invite action joins the stages: the guard refuses
anyone else, and the token leaves the request only inside the email:

```typescript {% title="app/http/controllers/teams/invite.ts" %}
import { requireAbility } from "@sdxc/authz/middleware/router";
import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { email } from "remix/data-schema/checks";
import { createAction } from "remix/router";

import emails from "~/app/emails";
import { teamAccess } from "~/app/http/middleware/access";
import { createInvitation } from "~/app/models/invitations";
import abilities from "~/app/policies/abilities";
import { issueInvitation } from "~/app/services/invitations";
import { SITE_URL } from "~/config/constants";
import routes from "~/routes/web";

const INVITE = s.object({ email: s.string().pipe(email()) });

export default createAction(routes.teams.invite, {
	middleware: [teamAccess, requireAbility(abilities.team.invite)],
	handler: async (ctx) => {
		let form = await validate(ctx.formData, INVITE);
		if (isFailure(form))
			return new Response("Enter an email address.", { status: 400 });

		let issued = await issueInvitation(ctx.team.id);
		if (isFailure(issued)) {
			ctx.log.fail(issued.error);
			return new Response("Something went wrong.", { status: 500 });
		}

		let { invitation, token } = issued.data;
		await createInvitation(ctx.db, { ...invitation, email: form.data.email });

		let url = new URL(routes.invitations.accept.href({ token }), SITE_URL);
		let queued = await ctx.email.queue(emails.teams.invite, {
			to: form.data.email,
			props: { team: ctx.team.name, url: url.href },
		});
		if (isFailure(queued))
			ctx.log.warn("invitation.not_queued", { id: invitation.id });

		return redirect(routes.teams.members.href(), {
			status: redirect.Status.SeeOther,
		});
	},
});
```

`createInvitation` is your own model function over the invitation's table.

## Accept the invitation

The accept route hashes the token from its URL with `hashInvitationToken`, finds the row by
`tokenHash`, adds the signed-in person to `invitation.teamId` and deletes the row, so the link
works once. A token that finds no row answers the same not-found page as any unknown URL.

## Test it

Test each stage as its guide does:
[Test the policy as a table](/docs/identity-and-security/authorization#test-the-policy-as-a-table)
checks that only an `admin` holds `team.invite`, and
[Test with the memory transport](/docs/data-and-background-work/send-email#test-with-the-memory-transport)
checks the email that carries the link.

## Where to go next

- [Sign in with OpenID Connect](/docs/identity-and-security/sign-in-with-oidc) — who the
  invitee is when they follow the link.
- [Hash, sign and encrypt with Web Crypto](/docs/identity-and-security/web-crypto) — signed
  links and sealed secrets built on the same tokens.
- [Make a policy](/docs/sdxc/make-policy) — add a resource's abilities and grants in one command.
