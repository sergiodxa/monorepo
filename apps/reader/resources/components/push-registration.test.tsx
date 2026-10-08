// @vitest-environment happy-dom

/**
 * The notification prompt, exercised against a real document with a stand-in for the
 * browser's permission and push APIs. Safari and Firefox show the prompt only from a user
 * gesture, so what is asserted is when it is asked for, and what a granted answer sends.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Mock } from "vitest";

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { run } from "remix/component";
import { renderToStream } from "remix/component/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import PushRegistration from "~/resources/components/push-registration";

/** Where the island posts a subscription. */
const DEVICES = "/settings/notifications/devices";

/** The button's label, which is how a test finds it. */
const ALLOW = "Allow notifications in this browser";

/** The endpoint the stand-in push service hands this browser. */
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/device-1";

let server = setupServer();

/** Every subscription the island posted. */
let registered: unknown[] = [];

let requestPermission: Mock<() => Promise<NotificationPermission>>;

beforeAll(() => {
	server.listen({ onUnhandledRequest: "error" });

	/**
	 * happy-dom parses no nested CSS, and the button's focus ring nests a rule per colour.
	 * Nothing asserted here reads a style, so the rules are accepted and dropped.
	 */
	vi.spyOn(CSSStyleSheet.prototype, "insertRule").mockImplementation(() => 0);
});
afterAll(() => server.close());

beforeEach(() => {
	registered = [];
	server.use(
		http.post(`*${DEVICES}`, async ({ request }) => {
			registered.push(await request.json());
			return HttpResponse.json({ devices: 1 });
		}),
	);

	let subscription = {
		endpoint: ENDPOINT,
		getKey: (name: string) => new Uint8Array(name === "auth" ? 16 : 65).buffer,
	};
	let registration = {
		pushManager: { getSubscription: async () => subscription, subscribe: async () => subscription },
	};

	Object.defineProperty(navigator, "serviceWorker", {
		configurable: true,
		value: { register: async () => registration, ready: Promise.resolve(registration) },
	});
	vi.stubGlobal("PushManager", class {});
});

afterEach(() => {
	server.resetHandlers();
	vi.unstubAllGlobals();
	document.body.innerHTML = "";
});

/** Stands in for the permission API, answering `answer` when asked. */
function stubPermission(permission: NotificationPermission, answer: NotificationPermission): void {
	requestPermission = vi.fn(async () => answer);
	vi.stubGlobal("Notification", { permission, requestPermission });
}

/** Draws the island as the settings page does and brings it up as a browser would. */
async function mount(): Promise<void> {
	let node = (
		<PushRegistration
			worker="/sw.js"
			devices={DEVICES}
			timeZone="/settings/notifications/time-zone"
			vapidPublicKey="BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4"
			storedTimeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
			enabled
			allow={ALLOW}
		/>
	);

	document.body.innerHTML = await new Response(renderToStream(node as never)).text();

	let runtime = run({
		async loadModule(_moduleUrl, exportName) {
			let module = await import("~/resources/components/push-registration");
			return Reflect.get(module, exportName) as never;
		},
	});

	await runtime.ready();
}

/** Waits for the island to offer its button, which it does only after its own checks. */
async function offered(): Promise<HTMLButtonElement> {
	await vi.waitFor(() => expect(allowButton()).toBeDefined());
	return allowButton()!;
}

/** The button the island offers, while its wrapper shows it. */
function allowButton(): HTMLButtonElement | undefined {
	return Array.from(document.querySelectorAll("button")).find(
		(button) => button.textContent?.includes(ALLOW) && button.closest("[hidden]") === null,
	);
}

describe("asking for notification permission", () => {
	test("a browser that has not been asked is offered a button, and no prompt", async () => {
		stubPermission("default", "granted");

		await mount();
		await offered();

		expect(requestPermission).not.toHaveBeenCalled();
		expect(registered).toHaveLength(0);
	});

	test("pressing the button asks, and a grant registers the browser", async () => {
		stubPermission("default", "granted");
		await mount();

		(await offered()).click();

		expect(requestPermission).toHaveBeenCalledOnce();
		await vi.waitFor(() => expect(registered).toHaveLength(1));
		expect(registered[0]).toMatchObject({ endpoint: ENDPOINT });
		await vi.waitFor(() => expect(allowButton()).toBeUndefined());
	});

	test("a refusal registers nothing and retires the button", async () => {
		stubPermission("default", "denied");
		await mount();

		(await offered()).click();

		await vi.waitFor(() => expect(allowButton()).toBeUndefined());
		expect(registered).toHaveLength(0);
	});

	test("a browser that already granted registers without a prompt or a button", async () => {
		stubPermission("granted", "granted");

		await mount();

		await vi.waitFor(() => expect(registered).toHaveLength(1));
		expect(requestPermission).not.toHaveBeenCalled();
		expect(allowButton()).toBeUndefined();
	});
});
