/**
 * The one piece of this app that has to run in the browser for a notification to arrive:
 * it registers the service worker, reports the zone quiet hours are computed in, and hands
 * the endpoint a push service gave this browser back to the reader's own object.
 *
 * It draws one button, shown only while the browser has not been asked: Safari and Firefox
 * show a notification prompt only from a user gesture. A browser that runs no script never
 * sees it and never registers a device.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { isFailure } from "@sdxc/result";
import { Button } from "@sdxc/ui";
import { isSupported, subscribe } from "@sdxc/web-push/browser";
import { clientEntry, on, ref } from "remix/component";

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
	/** The button's label, which is what the reader presses for the browser to ask. */
	allow: string;
};

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
		 * Subscribes this browser and hands the subscription over, asking for permission first
		 * when it has not been granted. A browser subscribed under a previous key is moved to
		 * the page's current one.
		 *
		 * Re-subscribing answers with the endpoint the browser already had, which is why the
		 * server takes registration as an upsert: a reader signing in twice on one device ends
		 * with one row rather than two notifications.
		 */
		async function registerDevice(signal: AbortSignal) {
			let subscribed = await subscribe({
				worker: handle.props.worker,
				scope: "/",
				applicationServerKey: handle.props.vapidPublicKey,
			});
			if (isFailure(subscribed)) return;

			await fetch(handle.props.devices, {
				method: "POST",
				credentials: "same-origin",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					subscription: subscribed.data,
					locale: document.documentElement.lang,
				}),
				signal,
			});
		}

		/** Whether the button is offered: push is on and this browser has not been asked. */
		let asking = false;

		/**
		 * Subscribes from the press itself, the one moment every browser shows the prompt.
		 * Either answer retires the button.
		 */
		async function allow() {
			asking = false;
			void handle.update();

			try {
				await registerDevice(handle.signal);
			} catch (error) {
				console.error("This browser could not be registered for notifications", error);
			}
		}

		/**
		 * A browser that already granted permission registers without a prompt, and one that
		 * has not been asked is offered the button. A browser that refuses any of this leaves
		 * the page exactly as the server drew it.
		 */
		let start = ref((_node, signal) => {
			void (async () => {
				try {
					await reportTimeZone(signal);

					if (!handle.props.enabled || handle.props.vapidPublicKey === "") return;
					if (!isSupported()) return;

					if (Notification.permission === "granted") {
						await registerDevice(signal);
					} else if (Notification.permission === "default") {
						asking = true;
						void handle.update();
					}
				} catch (error) {
					console.error("This browser could not be registered for notifications", error);
				}
			})();
		});

		/**
		 * The button is drawn on the server inside a hidden wrapper, so a page without script
		 * shows nothing and the island only has to reveal it.
		 */
		return () => (
			<span mix={[start]} hidden={!asking}>
				<Button
					type="button"
					color="neutral"
					variant="outline"
					mix={[on("click", () => void allow())]}
				>
					{handle.props.allow}
				</Button>
			</span>
		);
	},
);

export default PushRegistration;
