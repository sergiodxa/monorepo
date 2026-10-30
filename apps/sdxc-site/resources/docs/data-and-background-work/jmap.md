---
title: Read and send mail over JMAP
description: Read a mailbox and send as the account's identity on a JMAP server such as Fastmail, from a Worker, with batched calls and MSW tests.
section:
    title: Data & background work
    order: 7
order: 21
lastUpdated: 2026-10-25
outcomes:
    - "How to read the latest emails in an inbox with one batched JMAP request"
    - "How to send a message as the account's own identity and file it under Sent"
    - "How to test the JMAP services against MSW"
---

JMAP is the JSON protocol that replaces IMAP and SMTP submission with method calls sent in
batches over HTTPS, which makes a mailbox something a Worker can read and write with `fetch`.
This guide connects to [Fastmail](https://www.fastmail.com/dev/) with
[`@sdxc/jmap`](/api/jmap), reads the inbox, sends a message, and tests both against MSW. Every
failure is a [`@sdxc/result`](/api/result) value, and `remix` is the client's peer dependency.

```bash
npm add @sdxc/jmap @sdxc/result remix
```

## Connect to the server

The client takes the Session URL and a bearer token. With Fastmail the token is an API token
created under Settings, Privacy & Security, scoped to Email and Email submission.

```typescript {% title="app/initializers/jmap.ts" %}
import { env } from "cloudflare:workers";
import { JMAP } from "@sdxc/jmap";

export const jmap = new JMAP({
	url: "https://api.fastmail.com/jmap/session",
	token: env.FASTMAIL_TOKEN,
});
```

Declare `FASTMAIL_TOKEN: bindings.secret()` in `cloudflare.config.ts` and set it with
`cf workers secrets update` before the first deploy. The constructor does no I/O; the Session is
fetched on first use and kept for the life of the isolate.

> [!WARNING]
> The token reads and sends as the person who created it. Keep it a Worker secret, give it only
> the scopes the app calls, and revoke it from the same settings page when the app no longer
> needs it.

## Find the account and its mailboxes

The Session names the primary account for each capability. The services below take the client
as their first argument, so a test passes one pointed at MSW:

```typescript {% title="app/services/mail/account.ts" %}
import type { JMAP, JMAPRequestError } from "@sdxc/jmap";
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

export class MailError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "MailError";
	}
}

export async function accountFor(
	jmap: JMAP,
	capability: string,
): Promise<Result<string, JMAPRequestError | MailError>> {
	let session = await jmap.session();
	if (isFailure(session)) return session;

	let accountId = session.data.primaryAccounts[capability];
	if (accountId === undefined) {
		return failure(new MailError(`The token reaches no ${capability} account.`));
	}
	return success(accountId);
}
```

Mailbox names vary by account and language, but their `role` stays fixed: `inbox`, `drafts`,
`sent`, `trash`. One `Mailbox/get` maps each role to its id:

```typescript {% title="app/services/mail/mailboxes.ts" %}
import type { JMAP } from "@sdxc/jmap";

import { Batch } from "@sdxc/jmap";
import { isFailure, success } from "@sdxc/result";

export async function mailboxRoles(jmap: JMAP, accountId: string) {
	let batch = new Batch();
	let mailboxes = batch.call("Mailbox/get", { accountId, properties: ["role"] });

	let response = await jmap.send(batch);
	if (isFailure(response)) return response;
	let result = response.data.get(mailboxes);
	if (isFailure(result)) return result;

	let roles = new Map<string, string>();
	for (let mailbox of result.data.list) {
		if (mailbox.role) roles.set(mailbox.role, mailbox.id);
	}
	return success(roles);
}
```

`jmap.send()` fails when the request as a whole was refused, and `response.get(call)` reads each
call's own outcome.

## Read the latest emails in the inbox

Calls added to one `Batch` run in order in one request. `query.ref("/ids")` hands the ids the
query found to the `Email/get` after it, so the search and the fetch cost one round trip:

```typescript {% title="app/services/mail/inbox.ts" %}
import type { JMAP } from "@sdxc/jmap";

import { Batch, CAPABILITIES } from "@sdxc/jmap";
import { isFailure, success } from "@sdxc/result";

import { accountFor } from "~/app/services/mail/account";
import { mailboxRoles } from "~/app/services/mail/mailboxes";

export async function latestInbox(jmap: JMAP, limit = 10) {
	let accountId = await accountFor(jmap, CAPABILITIES.mail);
	if (isFailure(accountId)) return accountId;
	let roles = await mailboxRoles(jmap, accountId.data);
	if (isFailure(roles)) return roles;
	let inboxId = roles.data.get("inbox");
	if (inboxId === undefined) return success([]);

	let batch = new Batch();
	let query = batch.call("Email/query", {
		accountId: accountId.data,
		filter: { inMailbox: inboxId },
		sort: [{ property: "receivedAt", isAscending: false }],
		limit,
	});
	let emails = batch.call("Email/get", {
		accountId: accountId.data,
		ids: query.ref("/ids"),
		properties: ["from", "subject", "receivedAt", "preview"],
	});

	let response = await jmap.send(batch);
	if (isFailure(response)) return response;
	let result = response.data.get(emails);
	if (isFailure(result)) return result;
	return success(result.data.list);
}
```

`preview` is up to 256 characters of the body as plain text. A query that fails makes the
`Email/get` that references it fail too, so reading the last call is enough.

> [!NOTE]
> A server caps the ids in one `/get` at `maxObjectsInGet`, in
> `session.capabilities["urn:ietf:params:jmap:core"]`, and refuses a request over it as a whole.
> Keep `limit` on a query below that cap.

## Send a message

Sending is two calls in one request. `Email/set` creates the message in Drafts,
`EmailSubmission/set` submits it as the account's identity by its creation id, `#draft`, and
`onSuccessUpdateEmail` moves it to Sent once the submission is accepted:

```typescript {% title="app/services/mail/send.ts" %}
import type { JMAP } from "@sdxc/jmap";

import { Batch, CAPABILITIES } from "@sdxc/jmap";
import { failure, isFailure, success } from "@sdxc/result";

import { accountFor, MailError } from "~/app/services/mail/account";
import { mailboxRoles } from "~/app/services/mail/mailboxes";

export interface Message {
	to: string;
	subject: string;
	text: string;
}

export async function sendMessage(jmap: JMAP, message: Message) {
	let accountId = await accountFor(jmap, CAPABILITIES.mail);
	if (isFailure(accountId)) return accountId;
	let roles = await mailboxRoles(jmap, accountId.data);
	if (isFailure(roles)) return roles;
	let drafts = roles.data.get("drafts");
	let sent = roles.data.get("sent");
	if (drafts === undefined || sent === undefined) {
		return failure(new MailError("The account has no Drafts or Sent mailbox."));
	}

	let lookup = new Batch();
	let identities = lookup.call("Identity/get", { accountId: accountId.data });
	let found = await jmap.send(lookup);
	if (isFailure(found)) return found;
	let identity = found.data.get(identities);
	if (isFailure(identity)) return identity;
	let sender = identity.data.list[0];
	if (sender === undefined)
		return failure(new MailError("The account has no identity."));

	let batch = new Batch();
	let draft = batch.call("Email/set", {
		accountId: accountId.data,
		create: {
			draft: {
				mailboxIds: { [drafts]: true },
				keywords: { $draft: true, $seen: true },
				from: [{ name: sender.name ?? null, email: sender.email ?? "" }],
				to: [{ name: null, email: message.to }],
				subject: message.subject,
				bodyValues: { body: { value: message.text } },
				textBody: [{ partId: "body", type: "text/plain" }],
			},
		},
	});
	let submission = batch.call("EmailSubmission/set", {
		accountId: accountId.data,
		create: { send: { identityId: sender.id, emailId: "#draft" } },
		onSuccessUpdateEmail: {
			"#send": {
				[`mailboxIds/${drafts}`]: null,
				[`mailboxIds/${sent}`]: true,
				"keywords/$draft": null,
			},
		},
	});

	let response = await jmap.send(batch);
	if (isFailure(response)) return response;
	let created = response.data.get(draft);
	if (isFailure(created)) return created;
	let refused = created.data.notCreated?.draft;
	if (refused)
		return failure(new MailError(`The draft was refused: ${refused.type}`));

	let submitted = response.data.get(submission);
	if (isFailure(submitted)) return submitted;
	let notSent = submitted.data.notCreated?.send;
	if (notSent)
		return failure(new MailError(`The message was not sent: ${notSent.type}`));
	return success(submitted.data.created?.send?.id ?? null);
}
```

> [!NOTE]
> The identity decides the `From` address the recipient sees, and the server refuses a
> submission whose `From` does not match it with `forbiddenFrom`. List them with `Identity/get`
> and let the person pick one when the account has several.

Send from a [background job](/docs/data-and-background-work/jobs-and-cron) when the request
should answer before the server does.

## Test the services with MSW

The client calls the global `fetch`, so MSW answers the Session and the API while the client
under test is the real one. The API handler answers each method call by name:

```typescript {% title="app/services/mail/inbox.test.ts" %}
import { JMAP } from "@sdxc/jmap";
import { isFailure } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";

import { latestInbox } from "~/app/services/mail/inbox";

const ORIGIN = "https://jmap.fastmail.com";

const SESSION = {
	capabilities: {
		"urn:ietf:params:jmap:core": {},
		"urn:ietf:params:jmap:mail": {},
	},
	accounts: {
		u1: {
			name: "me@fastmail.com",
			isPersonal: true,
			isReadOnly: false,
			accountCapabilities: {},
		},
	},
	primaryAccounts: { "urn:ietf:params:jmap:mail": "u1" },
	username: "me@fastmail.com",
	apiUrl: `${ORIGIN}/api/`,
	downloadUrl: `${ORIGIN}/download/{accountId}/{blobId}/{name}?type={type}`,
	uploadUrl: `${ORIGIN}/upload/{accountId}/`,
	eventSourceUrl: `${ORIGIN}/events/?types={types}&closeafter={closeafter}&ping={ping}`,
	state: "s1",
};

const ANSWERS: Record<string, object> = {
	"Mailbox/get": {
		accountId: "u1",
		state: "m1",
		list: [{ id: "inbox-id", role: "inbox" }],
		notFound: [],
	},
	"Email/query": {
		accountId: "u1",
		queryState: "q1",
		canCalculateChanges: false,
		position: 0,
		ids: ["e1"],
	},
	"Email/get": {
		accountId: "u1",
		state: "e1",
		list: [{ id: "e1", subject: "Your invoice", preview: "Thanks for…" }],
		notFound: [],
	},
};

const server = setupServer(
	http.get(`${ORIGIN}/.well-known/jmap`, () => HttpResponse.json(SESSION)),
	http.post(SESSION.apiUrl, async ({ request }) => {
		let body = (await request.json()) as {
			methodCalls: [string, object, string][];
		};
		let methodResponses = body.methodCalls.map(([name, , id]) => [
			name,
			ANSWERS[name],
			id,
		]);
		return HttpResponse.json({ methodResponses, sessionState: "s1" });
	}),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test("reads the newest emails in the inbox", async () => {
	let jmap = new JMAP({ url: ORIGIN, token: "test-token" });

	let emails = await latestInbox(jmap);
	if (isFailure(emails)) throw emails.error;

	expect(emails.data.map((email) => email.subject)).toEqual(["Your invoice"]);
});
```

Answer a call with `["error", { type: "serverUnavailable" }, id]` through `server.use`, and the
same service returns a failure whose `error.retryable` is `true`.

## Where to go next

- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — send from a job
  so the request answers first.
- [Send email](/docs/data-and-background-work/send-email) — transactional mail your app sends
  on its own behalf.
- [`@sdxc/jmap`](/api/jmap) — contacts, change sync, uploads, push, and every error type.
