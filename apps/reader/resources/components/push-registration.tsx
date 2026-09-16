/**
 * The one piece of this app that has to run in the browser for a notification to arrive:
 * it registers the service worker, reports the zone quiet hours are computed in, and hands
 * the endpoint a push service gave this browser back to the reader's own object.
 *
 * It draws nothing. Everything it does is a capability the server cannot reach for, and a
 * browser that runs no script simply never registers a device.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { clientEntry, ref } from "remix/ui";

/**
 * Declared as a `type` to satisfy the serializable-props constraint a client entry's props
 * are checked against.
 */
type PushRegistrationProps = {
	/** Where the service worker is served from, which has to be at the app's own scope. */
	worker: string;
	/** Where a browser hands over the endpoint it was given. */
	devices: string;
	/** Where the resolved zone is reported. */
	timeZone: string;
	/**
	 * The application server's public key, base64url, which a browser needs to subscribe at
	 * all. Empty on a deployment that has none, which keeps this to the zone alone.
	 */
	vapidPublicKey: string;
	/** The zone already stored, so a report is sent only when it differs. */
	storedTimeZone: string;
	/** Whether the reader turned the push channel on, which is what earns a prompt. */
	enabled: boolean;
};

/** The bytes an `applicationServerKey` is given as, decoded from the page's base64url. */
function decodeKey(value: string): ArrayBuffer {
	let padded = value.replace(/-/g, "+").replace(/_/g, "/");
	let binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));

	let bytes = new Uint8Array(new ArrayBuffer(binary.length));
	for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);

	return bytes.buffer;
}

/** One of a subscription's keys as base64url, which is the form the server stores it in. */
function encodeKey(buffer: ArrayBuffer | null): string {
	if (buffer === null) return "";

	let binary = String.fromCharCode(...new Uint8Array(buffer));

	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const PushRegistration = clientEntry(
	"/resources/components/push-registration.tsx#PushRegistration",
	function PushRegistration(handle: Handle<PushRegistrationProps>) {
		/**
		 * Reports the resolved zone when it differs from what is stored. It is the one thing
		 * here that runs for every reader, because quiet hours are computed from it whether or
		 * not this browser is ever a device.
		 */
		async function reportTimeZone(signal: AbortSignal) {
			let resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
			if (!resolved || resolved === handle.props.storedTimeZone) return;

			await fetch(handle.props.timeZone, {
				method: "POST",
				credentials: "same-origin",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ timeZone: resolved }),
				signal,
			});
		}

		/**
		 * Subscribes this browser and hands the endpoint over.
		 *
		 * Re-subscribing answers with the endpoint the browser already had, which is why the
		 * server takes registration as an upsert: a reader signing in twice on one device ends
		 * with one row rather than two notifications.
		 */
		async function registerDevice(signal: AbortSignal) {
			let registration = await navigator.serviceWorker.register(handle.props.worker, {
				scope: "/",
			});

			let ready = await navigator.serviceWorker.ready.then(() => registration);

			let subscription =
				(await ready.pushManager.getSubscription()) ??
				(await ready.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: decodeKey(handle.props.vapidPublicKey),
				}));

			await fetch(handle.props.devices, {
				method: "POST",
				credentials: "same-origin",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					endpoint: subscription.endpoint,
					p256dh: encodeKey(subscription.getKey("p256dh")),
					auth: encodeKey(subscription.getKey("auth")),
					locale: document.documentElement.lang,
				}),
				signal,
			});
		}

		/**
		 * A browser that refuses any of this leaves the page exactly as the server drew it,
		 * which is the same page somebody running no script at all is reading.
		 */
		let start = ref((_node, signal) => {
			void (async () => {
				try {
					await reportTimeZone(signal);

					if (!handle.props.enabled || handle.props.vapidPublicKey === "") return;
					if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
					if ((await Notification.requestPermission()) !== "granted") return;

					await registerDevice(signal);
				} catch (error) {
					console.error("This browser could not be registered for notifications", error);
				}
			})();
		});

		return () => <span mix={[start]} hidden />;
	},
);

export default PushRegistration;
