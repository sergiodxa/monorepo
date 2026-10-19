---
title: Make an email
description: Write an email template with sdxc make email, its subject and body typed by the copy it takes, and the test that renders it.
section:
    title: The sdxc command
    order: 2
order: 2.11
lastUpdated: 2026-10-19
---

An email template is the message the app sends: a welcome, a receipt, a password reset.
`sdxc make email` writes one in `app/emails/`, built with [`@sdxc/mail`](/api/mail) components,
with a test that renders it:

```bash
sdxc make email welcome
```

```text
Wrote app/emails/welcome.tsx
Wrote app/emails/welcome.test.tsx
```

## Flags

| Flag                  | Default      | What it does                         |
| --------------------- | ------------ | ------------------------------------ |
| `--test`, `--no-test` | `make.tests` | write the test beside it, or skip it |
| `--dry-run`           |              | print the files and change nothing   |

## What it writes

An email class named after the file's last segment in PascalCase, and the copy it takes, already
translated for its reader:

```tsx {% title="app/emails/welcome.tsx" %}
import { defineEmail, Email } from "@sdxc/mail";

/** What the Welcome email says, already translated for its reader. */
export interface WelcomeCopy {
	heading: string;
	body: string;
}

/** The Welcome email, sent with `new WelcomeEmail(recipient, copy)`. */
export const WelcomeEmail = defineEmail<WelcomeCopy>({
	subject: (copy) => copy.heading,
	body: (handle) => () => (
		<Email.Layout preview={handle.props.heading} title={handle.props.heading}>
			<Email.Heading>{handle.props.heading}</Email.Heading>
			<Email.Text>{handle.props.body}</Email.Text>
			{/* TODO: lay out the rest of the email */}
		</Email.Layout>
	),
});
```

`receipts/order-paid` writes `app/emails/receipts/order-paid.tsx` exporting `OrderPaidEmail` and
`OrderPaidCopy`. Nothing is declared or mapped: whatever sends it imports the class.

## The test

```tsx {% title="app/emails/welcome.test.tsx" %}
import { render } from "@sdxc/mail";
import { describe, expect, test } from "vitest";

import { WelcomeEmail } from "~/app/emails/welcome";

describe("WelcomeEmail", () => {
	test("is addressed to its recipient under its heading", async () => {
		let email = new WelcomeEmail("ada@example.com", {
			heading: "Hello",
			body: "Welcome.",
		});

		expect(email.to).toEqual({ email: "ada@example.com" });
		expect(email.subject).toBe("Hello");
		expect((await render(email.body())).text).toContain("Welcome.");
	});
});
```

```bash
bun run test app/emails/welcome.test.tsx
```

## Fill it in

1. Add the fields the message needs to its copy interface, such as a link or an amount, and lay
   them out with the `Email` components.
2. Take the strings from your translations where you build the copy, so the email reads in the
   recipient's language.
3. Send it through the mailer the router's `mail()` middleware publishes as `ctx.email`.
   `later()` sends after the response, so a slow provider never holds the request; `send()`
   waits and returns a `Result`:

```typescript
ctx.email.later(new WelcomeEmail(user.email, { heading, body }));
```

[Send email](/docs/data-and-background-work/send-email) covers transports, previews and testing
what was sent, and [`@sdxc/mail`](/api/mail) the components and the whole API.

## Where to go next

- [Make a job](/docs/sdxc/make-job) — send the email off the request.
- [Generate files](/docs/sdxc/generate-files) — the flags, configuration and stubs every kind
  shares.
