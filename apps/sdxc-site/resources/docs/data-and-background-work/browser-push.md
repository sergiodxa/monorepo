---
title: Send browser push notifications
description: Subscribe a browser from a click, store the subscription safely, and send encrypted Web Push from a Worker, directly or as one more messaging destination.
section:
    title: Data & background work
    order: 7
order: 14
lastUpdated: 2026-10-25
outcomes:
    - "How to subscribe a browser from a click and store the subscription with `@sdxc/web-push`"
    - "How to send an encrypted notification from a Worker, directly or through messaging"
    - "How to rotate the sender's keys and test without a push service"
---

This guide lets a team member turn on alerts in their browser: a button on the settings page
subscribes this browser, the server stores the subscription, and later a failed sync shows up
as a notification even when the app is closed.

[`@sdxc/web-push`](/api/web-push) holds both halves: its main entry encrypts and signs one
`POST` to the browser's push service, and `@sdxc/web-push/browser` subscribes from a click.
There is no provider to sign up for; each browser hands you an endpoint on its vendor's push
service, and your Worker is identified only by the key pair you generate below.

```bash
npm add @sdxc/messaging @sdxc/result @sdxc/validate @sdxc/web-push remix
```

## Generate the sender's keys

A push service identifies a sender by one P-256 key pair. Generate it once per deployment:

```bash
bun -e 'import { WebPush } from "@sdxc/web-push"; console.log(await WebPush.generateKeys())'
```

The public key goes to every page that subscribes, so it can live in plain configuration; the
private key is a Worker secret:

```bash
cf workers secrets update VAPID_PRIVATE_KEY
```

> [!WARNING]
> Every browser subscription is bound to the public key it was made with, and a push service
> refuses a message signed by any other. Keep the pair stable, and when it must change, rotate
> it as [Rotate the keys](#rotate-the-keys) shows.

## Draw the notification in a service worker

The browser wakes your service worker with the payload. Serve it from the origin's root, so it
controls every page:

```javascript {% title="public/sw.js" %}
self.addEventListener("push", (event) => {
	let payload = event.data?.json();
	if (!payload?.title) return;

	event.waitUntil(
		self.registration.showNotification(payload.title, {
			body: payload.body,
			tag: payload.tag,
			data: { url: payload.url },
		}),
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	event.waitUntil(self.clients.openWindow(event.notification.data?.url ?? "/"));
});
```

`tag` replaces an earlier notification with the same tag, so a recovery takes the place of
the failure it answers instead of stacking beside it.

## Subscribe from a click

Safari and Firefox show the permission prompt only during a user gesture, so `subscribe` runs
from a click. It asks for permission, registers the worker, and reuses the browser's existing
subscription or replaces one made under another key:

```tsx {% title="resources/components/enable-push.tsx" %}
import type { Handle } from "remix/component";

import { isSuccess } from "@sdxc/result";
import { isSupported, subscribe } from "@sdxc/web-push/browser";
import { clientEntry, on } from "remix/component";

type EnablePushProps = { applicationServerKey: string; action: string };

export const EnablePush = clientEntry(
	import.meta.url,
	function EnablePush(handle: Handle<EnablePushProps>) {
		async function enable() {
			let subscribed = await subscribe({
				worker: "/sw.js",
				scope: "/",
				applicationServerKey: handle.props.applicationServerKey,
			});
			if (!isSuccess(subscribed)) return;

			await fetch(handle.props.action, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ subscription: subscribed.data }),
			});
		}

		return () => (
			<button type="button" hidden={!isSupported()} mix={[on("click", enable)]}>
				Alert me in this browser
			</button>
		);
	},
);
```

A failed `subscribe` answers `unsupported`, `denied` or `failed` and never throws. On iOS and
iPadOS, push exists only in a web app added to the Home Screen, which is when `isSupported`
answers `true`.

## Store the subscription

> [!WARNING]
> The endpoint in a subscription is a URL your Worker will later `POST` to, so it is untrusted
> input. Validate it before you store it.

`SUBSCRIPTION_SCHEMA` applies the checks a send applies: a public `https:` host, a
P-256 key on the curve and a 16-byte auth secret. A row it accepts is one a send will not
refuse:

```typescript {% title="app/http/controllers/push-subscriptions.ts" %}
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { SUBSCRIPTION_SCHEMA } from "@sdxc/web-push";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import Subscriptions from "~/app/models/push-subscriptions";
import routes from "~/routes/web";

const REGISTRATION = s.object({ subscription: SUBSCRIPTION_SCHEMA });

export default createAction(routes.pushSubscriptions, async (ctx) => {
	let body = await validate(ctx.request, REGISTRATION);
	if (isFailure(body)) {
		return Response.json({ errors: body.error.issues }, { status: 400 });
	}

	await Subscriptions.save(ctx.db, ctx.user.id, body.data.subscription);
	return new Response(null, { status: 204 });
});
```

`Subscriptions` is your own model, and `ctx.user` the signed-in user your auth middleware
publishes. `save` upserts on the endpoint and stores both keys and `applicationServerKey`, the
public key the browser subscribed under, as `vapidKey`. Treat a stored subscription like a
credential, since it is all anyone needs to notify that browser.

## Send a notification

Build one `WebPush` per batch of sends: it caches one VAPID token per push service, so fifty
browsers on Chrome's push service cost one signature. Each send makes one attempt and answers a
`Result` whose error code says what to do with the row:

```typescript {% title="app/services/notifications/push.ts" %}
import type { WebPushError } from "@sdxc/web-push";
import type { Database } from "remix/data-table";

import { isFailure } from "@sdxc/result";
import { WebPush } from "@sdxc/web-push";
import { env } from "cloudflare:workers";

import type { PushSubscriptionRow } from "~/app/models/push-subscriptions";

import Subscriptions from "~/app/models/push-subscriptions";

const FAILURE_LIMIT = 10;

export async function pushToUser(db: Database, userId: string, payload: object) {
	let push = new WebPush({
		vapid: {
			publicKey: env.VAPID_PUBLIC_KEY,
			privateKey: env.VAPID_PRIVATE_KEY,
			subject: "mailto:ops@example.com",
		},
	});

	let rows = await Subscriptions.forUser(db, userId);
	await Promise.all(
		rows.map(async (row) => {
			let sent = await push.send(
				{
					endpoint: row.endpoint,
					keys: { p256dh: row.p256dh, auth: row.auth },
					applicationServerKey: row.vapidKey ?? undefined,
				},
				JSON.stringify(payload),
				{ topic: "sync", urgency: "high" },
			);
			if (isFailure(sent)) await applyFailure(db, row, sent.error);
			else await Subscriptions.markDelivered(db, row.id);
		}),
	);
}

async function applyFailure(
	db: Database,
	row: PushSubscriptionRow,
	error: WebPushError,
) {
	if (error.code === "gone") return await Subscriptions.remove(db, row.id);
	if (!error.retryable) return;
	if (row.failures + 1 >= FAILURE_LIMIT)
		return await Subscriptions.remove(db, row.id);
	await Subscriptions.countFailure(db, row.id);
}
```

`gone` is a `404` or `410`, meaning the browser unsubscribed, so the row goes now. A run of
`retryable` failures retires the row too, counted in its `failures`. `unauthorized` is your
VAPID key being refused, so keep the row and fix the key.

> [!NOTE]
> A payload holds at most 3,993 bytes once encrypted into the 4,096-byte body every push service
> accepts.

`topic` replaces an undelivered message with the same topic, so a laptop that was asleep all
night wakes to one notification, not twenty.

## Send through messaging

An app that already routes alerts through [`@sdxc/messaging`](/api/messaging), as
[Send alerts to chat and paging services](/docs/data-and-background-work/messaging) shows, adds
browser push as one more destination:

```typescript {% title="app/services/notifications/destinations.ts" %}
import type { Destination } from "@sdxc/messaging";
import type { Subscription, WebPush } from "@sdxc/web-push";

import { BrowserPush } from "@sdxc/messaging/web-push";

export function browserDestination(
	push: WebPush,
	subscription: Subscription,
): Destination {
	return new BrowserPush({ push, subscription, ttl: "1 day" });
}
```

It sends the JSON the service worker above draws, with the message's first link as `url` and
its `key` as `tag`, and answers `gone` when the browser unsubscribed.

## Rotate the keys

Rotating needs both keys for a while. Generate a new pair, deploy it as `vapid`, and keep the
old one in `previous`; a send picks the pair matching each row's stored `applicationServerKey`:

```typescript
let push = new WebPush({ vapid: current, previous: [old] });
```

Pages hand the new public key to `subscribe`, which replaces a subscription made under the old
key the next time it runs. Once no stored row names the old key, drop it from `previous`.

## Test without a push service

[MSW](https://mswjs.io) stands in for the push service, so the status branches run without a
network. Any `p256dh` on the P-256 curve works; RFC 8291's example key is a convenient one:

```typescript {% title="app/services/notifications/push.test.ts" %}
import { isFailure } from "@sdxc/result";
import { WebPush } from "@sdxc/web-push";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/device-1";

const SUBSCRIPTION = {
	endpoint: ENDPOINT,
	keys: {
		p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
		auth: "BTBZMqHH6r4Tts7J_aSIgg",
	},
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test("an unsubscribed browser answers gone", async () => {
	server.use(http.post(ENDPOINT, () => new HttpResponse(null, { status: 410 })));
	let keys = await WebPush.generateKeys();
	let push = new WebPush({ vapid: { ...keys, subject: "mailto:ops@example.com" } });

	let sent = await push.send(
		SUBSCRIPTION,
		JSON.stringify({ title: "Sync failed" }),
	);

	expect(isFailure(sent) && sent.error.code).toBe("gone");
});
```

## Where to go next

- [Send alerts to chat and paging services](/docs/data-and-background-work/messaging) — the
  delivery job, retries and fan-out that `BrowserPush` plugs into.
- [Fetch URLs a stranger chose](/docs/identity-and-security/fetch-untrusted-urls) — the public
  host rule a subscription's endpoint passes.
- [`@sdxc/web-push`](/api/web-push) — every option and error code.
