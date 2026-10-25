---
title: Read and send mail over JMAP
description: Read a mailbox, send as the account's identity, search contacts and follow changes on a JMAP server such as Fastmail, from a Worker, with batched calls and MSW tests.
section:
    title: Data & background work
    order: 7
order: 21
lastUpdated: 2026-10-24
outcomes:
    - "How to read the latest emails in an inbox with one batched JMAP request"
    - "How to send a message as the account's own identity and file it under Sent"
    - "How to search contacts, follow changes and test the client with MSW"
---

JMAP is the JSON protocol that replaces IMAP, SMTP submission and CardDAV with method calls
sent in batches over HTTPS. That makes a mailbox something a Worker can read and write with
`fetch`: an app that files support mail, a bot that answers from your own address, a page
that lists the people in your address book. This guide connects to
[Fastmail](https://www.fastmail.com/dev/), reads the inbox, sends a message, searches
contacts and syncs what changed, and tests all of it against MSW.

[`@sdxc/jmap`](/api/jmap) is the client: it reads the Session, sends batches typed by method
name, lets one call take its arguments from an earlier call's result, and covers mail,
submission and contacts. Every failure is a [`@sdxc/result`](/api/result) value. `remix` is
its peer dependency, because responses are checked with `remix/data-schema`.

```bash
npm add @sdxc/jmap @sdxc/result remix
```

This guide sends mail from a person's mailbox. Transactional mail your app sends on its own
behalf belongs in [Send email](/docs/data-and-background-work/send-email).

## Connect to the server

The client takes the Session URL and a bearer token. With Fastmail the token is an API token
created under Settings, Privacy & Security, scoped to the data the app needs: Email for
reading, Email submission for sending, Contacts for the address book.

```typescript {% title="app/initializers/jmap.ts" %}
import { env } from "cloudflare:workers";
import { JMAP } from "@sdxc/jmap";

export const jmap = new JMAP({
	url: "https://api.fastmail.com/jmap/session",
	token: env.FASTMAIL_TOKEN,
});
```

Declare `FASTMAIL_TOKEN: bindings.secret()` in `cloudflare.config.ts` and set it with
`cf workers secrets update` before the first deploy. A URL with only an origin, such as
`https://jmap.example.com`, reads that host's `/.well-known/jmap` instead.

The constructor does no I/O, so the instance lives at module scope. The Session is fetched on
first use and kept for the life of the isolate, and the client fetches it again when a
response reports a different `sessionState`. The upload, download and event-source URLs it
holds are RFC 6570 templates, which the client expands with
[`@sdxc/uri-template`](/docs/http-apis/uri-templates).

<warning>
The token reads and sends as the person who created it. Keep it a Worker secret, give it only
the scopes the app calls, and revoke it from the same settings page when the app no longer
needs it.
</warning>

## Find the account and its mailboxes

The Session lists the accounts the token reaches and the primary one for each capability.
The services below take the client as their first argument, so a test passes one pointed at
MSW and the app passes the initializer's.

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

Mailboxes are named by people, so a folder called "Inbox" in one account is "Bandeja de
entrada" in another. Their `role` is what stays fixed: `inbox`, `drafts`, `sent`, `trash`.
One `Mailbox/get` for every mailbox, asking only for `role`, maps each role to its id:

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

`jmap.send()` fails with a `JMAPRequestError` when the request as a whole was refused, and
each call's outcome is read separately with `response.get(call)`, which fails with a
`JMAPMethodError` naming the method error type.

## Read the latest emails in the inbox

Calls added to one `Batch` run in order in one request. `query.ref("/ids")` hands the ids the
query found to the `Email/get` after it as a whole argument, so the search and the fetch of
what it found cost one round trip.

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

`preview` is up to 256 characters of the body as plain text, enough for a message list
without fetching bodies. A query that fails makes the `Email/get` that references it fail too,
with `invalidResultReference`, so reading the last call is enough.

<note>
A server caps the calls in one request at its `maxCallsInRequest` and the ids in one `/get` at
`maxObjectsInGet`, both in `session.capabilities["urn:ietf:params:jmap:core"]`. A request over
a cap fails as a whole with `type` `"limit"` and the cap's name in `limit`; keep `limit` on a
query below `maxObjectsInGet`.
</note>

## Send a message

Sending is two calls in one request. `Email/set` creates the message in Drafts, and
`EmailSubmission/set` submits it as one of the account's identities, naming the new message by
its creation id, `#draft`. `onSuccessUpdateEmail` moves it from Drafts to Sent once the
submission is accepted.

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

A body part being created names only its `partId`, which `bodyValues` is keyed by, and its
`type`; the server fills in the size, charset and headers. `Email/set` takes an `EmailCreate`,
whose body parts are typed that way, so the draft needs no cast. The `Email/set` the submission's `onSuccessUpdateEmail`
triggers comes back as a second response to the same call, and
`response.get(submission, "Email/set")` reads it.

<note>
The identity decides the `From` address the recipient sees, and the server refuses a
submission whose `From` does not match it with `forbiddenFrom`. List them with `Identity/get`
and let the person pick one when the account has several.
</note>

Each `SetError` names its `type` (`invalidProperties`, `forbiddenFrom`, `tooManyRecipients`
and so on), and `invalidProperties` adds the `properties` that failed. Send from a
[background job](/docs/data-and-background-work/jobs-and-cron) when the request should answer
before the server does, and retry the job when `jmap.send()` fails with a `network` code.

## Search the address book

Contacts are JSContact Cards in address books, and `ContactCard/query` takes the same
`ref` chaining as mail. The contacts account comes from the contacts capability:

```typescript {% title="app/services/mail/contacts.ts" %}
import type { JMAP } from "@sdxc/jmap";

import { Batch, CAPABILITIES } from "@sdxc/jmap";
import { isFailure, success } from "@sdxc/result";

import { accountFor } from "~/app/services/mail/account";

export async function searchContacts(jmap: JMAP, text: string) {
	let accountId = await accountFor(jmap, CAPABILITIES.contacts);
	if (isFailure(accountId)) return accountId;

	let batch = new Batch();
	let query = batch.call("ContactCard/query", {
		accountId: accountId.data,
		filter: { text },
		limit: 20,
	});
	let cards = batch.call("ContactCard/get", {
		accountId: accountId.data,
		ids: query.ref("/ids"),
	});

	let response = await jmap.send(batch);
	if (isFailure(response)) return response;
	let result = response.data.get(cards);
	if (isFailure(result)) return result;
	return success(result.data.list);
}
```

Each Card carries its `addressBookIds` beside the JSContact properties, `name`, `emails`,
`phones` and the rest. [Read and write contact cards](/docs/content-and-feeds/contact-cards)
validates them and converts them to vCard for apps that want a `.vcf`.

## Sync what changed

A `/get` answers with a `state`. Keep it, and later ask `/changes` for what changed since:
the created and updated ids feed two `/get` calls in the same request, so a sync is one round
trip however much moved.

```typescript {% title="app/services/mail/sync.ts" %}
import type { JMAP } from "@sdxc/jmap";

import { Batch } from "@sdxc/jmap";
import { isFailure, success } from "@sdxc/result";

const PROPERTIES = ["from", "subject", "receivedAt", "preview", "keywords"] as const;

export async function emailChanges(
	jmap: JMAP,
	accountId: string,
	sinceState: string,
) {
	let batch = new Batch();
	let changes = batch.call("Email/changes", { accountId, sinceState });
	let created = batch.call("Email/get", {
		accountId,
		ids: changes.ref("/created"),
		properties: [...PROPERTIES],
	});
	let updated = batch.call("Email/get", {
		accountId,
		ids: changes.ref("/updated"),
		properties: [...PROPERTIES],
	});

	let response = await jmap.send(batch);
	if (isFailure(response)) return response;
	let changed = response.data.get(changes);
	if (isFailure(changed)) return changed;
	let added = response.data.get(created);
	if (isFailure(added)) return added;
	let modified = response.data.get(updated);
	if (isFailure(modified)) return modified;

	return success({
		created: added.data.list,
		updated: modified.data.list,
		destroyed: changed.data.destroyed,
		state: changed.data.newState,
		more: changed.data.hasMoreChanges,
	});
}
```

Store `state` where the next run reads it and call again while `more` is true. A failure whose
`error.type` is `"cannotCalculateChanges"` means the state is too old for the server to diff:
fetch the mailbox again with a query and keep the new state. Run the sync from a
[cron trigger](/docs/data-and-background-work/jobs-and-cron), or open `jmap.events()` for the
server's event-source stream where a long-lived connection fits; a push service delivering to
a `PushSubscription` POSTs the same `StateChange` objects, which `parsePush()` reads.

## Test the services with MSW

The client calls the global `fetch`, so MSW answers the Session and the API and the client
under test is the real one. The API handler answers each method call by name, which keeps the
two requests `latestInbox` makes in one handler:

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

`afterEach` resets only handlers added with `server.use`, so the two passed to `setupServer`
stay for every test. Add one with `server.use` that answers `HttpResponse.json(...)` with
`["error", { type: "serverUnavailable" }, id]` for a call, and the same service returns a
failure whose `error.retryable` is `true`.

## Where to go next

- [Read and write contact cards](/docs/content-and-feeds/contact-cards) — validate the
  JSContact Cards `ContactCard/get` returns and turn them into vCard.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — send from a job
  and run the sync on a schedule.
- [`@sdxc/jmap`](/api/jmap) — uploads and downloads, push, typing another capability's
  methods, and every error type.
