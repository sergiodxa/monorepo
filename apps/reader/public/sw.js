/**
 * The reader's service worker. It exists to receive notifications and to open the queue
 * when one is tapped, so it caches nothing and intercepts no request: a cached script's
 * update semantics are a cost this app takes on only for the thing that needs one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The tag every notification is drawn under, so a second one replaces the first on the
 * lock screen rather than stacking beside it. The payload is a summary of everything
 * since the last one, which makes the older of two always the smaller statement.
 */
const NOTIFICATION_TAG = "reader-summary";

/**
 * Takes over as soon as it installs rather than waiting for every tab to close, so a
 * reader who has just allowed notifications is reachable without reopening the app.
 */
self.addEventListener("install", () => {
	void self.skipWaiting();
});

/** Claims the pages already open, for the same reason the install skips waiting. */
self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
});

/**
 * Draws the summary the reader's own object sent. The payload carries a count, up to three
 * publishers by name and the path to open, and the two lines are written server-side in
 * the language this browser registered under.
 */
self.addEventListener("push", (event) => {
	let payload = readPayload(event);
	if (payload === null) return;

	event.waitUntil(
		self.registration.showNotification(payload.title, {
			body: payload.body,
			tag: NOTIFICATION_TAG,
			renotify: true,
			data: { url: payload.url },
		}),
	);
});

/**
 * Opens the reader's queue, reusing a tab that is already on this origin so tapping a
 * notification never leaves somebody with two copies of the app.
 */
self.addEventListener("notificationclick", (event) => {
	event.notification.close();

	let target = new URL(event.notification.data?.url ?? "/", self.location.origin).href;

	event.waitUntil(
		(async () => {
			let windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

			for (let client of windows) {
				if (new URL(client.url).origin !== self.location.origin) continue;

				await client.focus();
				if ("navigate" in client) await client.navigate(target);

				return;
			}

			await self.clients.openWindow(target);
		})(),
	);
});

/**
 * The summary a push event carries, or `null` for one carrying nothing this understands —
 * which is what a push service's own keep-alive looks like.
 *
 * @param event - The push event as it arrived.
 */
function readPayload(event) {
	try {
		let payload = event.data?.json();
		if (!payload || typeof payload.title !== "string") return null;

		return payload;
	} catch {
		return null;
	}
}
