---
title: Add a contact form
description: Validate a contact form, keep bots and spam out of it, and email each message that gets through to your own inbox.
section:
    title: Recipes
    order: 1.7
order: 6
lastUpdated: 2026-10-25
outcomes:
    - "What guides build a contact form, and in what order to follow them"
    - "How to email a message to your inbox only after every guard and the schema accept it"
    - "Where the reply to a message goes"
---

By the end of this recipe your site has a contact form whose messages land in your inbox, with
replies going straight to the sender. Bots are trapped, rate-limited and challenged before your
handler runs, and the handler accepts only a message that fits its schema.

```bash
npm add @sdxc/http @sdxc/result @sdxc/validate remix
```

## Describe the message

The schema is the rule the handler relies on, so it comes first. Write `ContactSchema` in
`app/http/validators/contact.ts`, with a `name`, an `email` and a `message` field, as
[Describe the form as a schema](/docs/building-remix-apps/forms-and-params#describe-the-form-as-a-schema)
does.

## Guard the form

Follow [Protect forms from bots and abuse](/docs/identity-and-security/protect-forms) from
[Mount the guards on the route](/docs/identity-and-security/protect-forms#mount-the-guards-on-the-route)
through
[Score what was written](/docs/identity-and-security/protect-forms#score-what-was-written), with a
`contact: form("/contact")` route and a `contactSent` page in place of `signUp` and
`checkYourEmail`, and score `{ content: "message", name: "name", email: "email" }`.

## Email the message to your inbox

Follow [Send email](/docs/data-and-background-work/send-email) through
[Deliver queued email](/docs/data-and-background-work/send-email#deliver-queued-email), declaring
`contact.message` with the same three props. The action is where the stages meet: it reads the
honeypot's outcome, validates the message and queues it, so a slow provider never delays the
visitor:

```typescript {% title="app/http/controllers/contact/action.ts" %}
import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";

import emails from "~/app/emails";
import { renderContact } from "~/app/http/controllers/contact/render";
import { ContactSchema } from "~/app/http/validators/contact";
import { CONTACT_INBOX } from "~/config/constants";
import routes from "~/routes/web";

export const action = createAction(routes.contact.action, async (ctx) => {
	let trap = ctx.honeypotOutcome;
	let form = await validate(ctx.formData, ContactSchema);
	if (isFailure(trap)) return renderContact(ctx, "Send it again.");
	if (isFailure(form)) return renderContact(ctx, "Fill in every field.");

	let queued = await ctx.email.queue(emails.contact.message, {
		to: CONTACT_INBOX,
		replyTo: { email: form.data.email, name: form.data.name },
		props: form.data,
	});
	if (isFailure(queued)) {
		ctx.log.fail(queued.error);
		return renderContact(ctx, "Something went wrong. Please try again.");
	}

	return redirect(routes.contactSent.href(), { status: redirect.Status.SeeOther });
});
```

`renderContact` is the guard guide's `renderSignUp` with your contact fields, and
`CONTACT_INBOX` is the address that reads your messages.

## Test it

Test each stage as its guide does:
[Test the guards](/docs/identity-and-security/protect-forms#test-the-guards) posts through the
router with a test challenge, and
[Test with the memory transport](/docs/data-and-background-work/send-email#test-with-the-memory-transport)
checks the email that was sent.

## Where to go next

- [Security headers and CSP](/docs/identity-and-security/security-headers) — allow the
  challenge's script and frame on the contact page.
- [Translate your app](/docs/building-remix-apps/translate-your-app) — the form and the email
  in your visitor's language.
- [`@sdxc/spam`](/api/spam) — reputation providers and a trainable classifier for a form that
  draws more spam.
