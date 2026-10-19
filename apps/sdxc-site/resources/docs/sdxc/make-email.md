---
title: Make an email
description: Write an email with sdxc make email, its props declared from the fields you name, its template mapped on the email registry, and the test that renders it.
section:
    title: The sdxc command
    order: 2
order: 2.11
lastUpdated: 2026-10-19
outcomes:
    - "How fields become an email's props, subject and body"
    - "What `make email` writes, declares and maps"
    - "How to translate the copy and send the email"
---

An email is a message the app sends: an invitation, a receipt, a password reset. `sdxc make
email` declares it in `app/emails/index.ts` with the props it takes, writes its template in
`app/emails/` with [`@sdxc/mail`](/api/mail) components, maps the template on the email registry
and writes a test that renders it:

```bash
sdxc make email teams/invite team invite_url 'expires_on?' is_admin
```

```text
Wrote app/emails/teams/invite.tsx
Wrote app/emails/teams/invite.test.tsx
Edited app/emails/index.ts
Edited app/initializers/mail.ts
```

## Flags

| Flag                   | Default      | What it does                                                 |
| ---------------------- | ------------ | ------------------------------------------------------------ |
| `[field[:type][?]...]` |              | a prop per field, after the name                             |
| `--test`, `--no-test`  | `make.tests` | write the test beside it, or skip it                         |
| `--force`              |              | replace the template and its test, keeping their declaration |
| `--dry-run`            |              | print the files and the diffs, and change nothing            |

## Fields

A field is `name`, `name:type` or `name?`, typed as
[`make model`](/docs/sdxc/make-model#fields) types a column: a bare name takes its type from its
name, an explicit type wins, and a trailing `?` makes the prop optional. Quote a field with `?`
in zsh. Each field becomes a camelCase prop, and its type decides how the template shows it:

| Type                   | Prop          | In the body                                             |
| ---------------------- | ------------- | ------------------------------------------------------- |
| `string`, `text`       | `s.string()`  | `<Email.Text>`                                          |
| `url`                  | `s.string()`  | `<Email.Button>` linking to it                          |
| `email`                | `s.string()`  | `<Email.Link>` to `mailto:` it                          |
| `boolean`              | `s.boolean()` | a line of text shown when it is true                    |
| `date`                 | `s.string()`  | `<Email.Text>`, `YYYY-MM-DD`                            |
| `integer`, `timestamp` | `s.number()`  | `<Email.Text>`; a timestamp is milliseconds since epoch |

The first required `string` or `text` prop is the subject and the `<Email.Heading>`. An optional
prop renders only when it is set. With no fields, the email takes a `heading` and a `body`.
An email's props are values, so a `references` field and the `:index` and `:unique` modifiers
are refused.

## What it writes

The template default-exports `createEmail()` over the declaration, with a `preview` built from a
sample of each prop:

```tsx {% title="app/emails/teams/invite.tsx" %}
import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";

export default createEmail(emails.teams.invite, {
	subject: ({ team }) => team,
	body: (handle) => () => (
		<Email.Layout lang={handle.props.locale} title={handle.props.team}>
			<Email.Heading>{handle.props.team}</Email.Heading>
			<Email.Button href={handle.props.inviteUrl}>Invite url</Email.Button>
			{handle.props.expiresOn === undefined ? null : (
				<Email.Text>{handle.props.expiresOn}</Email.Text>
			)}
			{handle.props.isAdmin ? <Email.Text>Is admin</Email.Text> : null}
		</Email.Layout>
	),
	preview: () => ({
		team: "Sample team",
		inviteUrl: "https://example.com/",
		expiresOn: "2026-01-31",
		isAdmin: true,
	}),
});
```

Every member receives the parsed props with `locale` and `t` beside them, so the copy is
translated when the email renders, in the language of whoever receives it.

## What it edits

The props are declared in `app/emails/index.ts`, and the template is mapped through `lazy()` on
the registry the initializer in `app/initializers/` creates with `createMail`:

```text
--- a/app/emails/index.ts
+++ b/app/emails/index.ts
-import { emails } from "@sdxc/mail";
+import { emails, email } from "@sdxc/mail";
+import * as s from "remix/data-schema";

-export default emails({});
+export default emails({
+	teams: {
+		invite: email({
+			props: s.object({
+				team: s.string(),
+				inviteUrl: s.string(),
+				expiresOn: s.optional(s.string()),
+				isAdmin: s.boolean(),
+			}),
+		}),
+	},
+});
--- a/app/initializers/mail.ts
+++ b/app/initializers/mail.ts
-import { createMail } from "@sdxc/mail";
+import { createMail, lazy } from "@sdxc/mail";
+import emails from "~/app/emails";
@@
 export const mail = createMail({ translator: translate });
+mail.map(emails.teams.invite, lazy(() => import("~/app/emails/teams/invite")));
```

The path is the email's name: `teams/invite` is `emails.teams.invite`, named `teams.invite` on
every queued delivery, so rename it only when no delivery under the old name is waiting. In a
project with no registry initializer, the command writes the files and prints the declaration
and the mapping to add by hand.

## The test

The test renders the email through the app's registry with the preview's props:

```tsx {% title="app/emails/teams/invite.test.tsx" %}
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import emails from "~/app/emails";
import { mail } from "~/app/initializers/mail";

describe("Invite email", () => {
	test("renders its props into the subject and both body parts", async () => {
		let rendered = unwrap(
			await mail.render(emails.teams.invite, {
				props: {
					team: "Sample team",
					inviteUrl: "https://example.com/",
					expiresOn: "2026-01-31",
					isAdmin: true,
				},
			}),
		);

		expect(rendered.subject).toBe("Sample team");
		expect(rendered.text).toContain("Sample team");
	});
});
```

```bash
bun run test app/emails/teams/invite.test.tsx
```

## Fill it in

1. Write the copy in your message bundles and read it through `t`, such as
   `subject: ({ team, t }) => t("emails.teamInvite.subject", { team })` and
   `{handle.props.t("emails.teamInvite.action")}` for the button.
2. Lay out the rest with the `Email` components, and keep the test's expectations on the
   rendered subject and text.
3. Send it by its declaration from a controller, a job or a command, with the recipient, their
   language and the props:

```typescript
await ctx.email.queue(emails.teams.invite, {
	to: invitee.email,
	locale: invitee.language,
	props: { team: team.name, inviteUrl, isAdmin: false },
});
```

`queue()` validates the props now and a job delivers the email with retries; `send()` waits and
returns a `Result`, and `later()` sends once the response is out.
[Send email](/docs/data-and-background-work/send-email) covers the three, the delivery job,
previews and testing what was sent.

## Where to go next

- [Send email](/docs/data-and-background-work/send-email) — the registry, the mailers and the
  delivery job.
- [Translate your app](/docs/building-remix-apps/translate-your-app) — the message bundles the
  copy comes from.
- [Generate files](/docs/sdxc/generate-files) — the flags, configuration and stubs every kind
  shares.
