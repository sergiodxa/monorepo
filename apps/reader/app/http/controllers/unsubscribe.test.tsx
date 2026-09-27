/**
 * Tests `/notifications/unsubscribe/:token`: the confirmation a `GET` renders without changing
 * anything, the channel a `POST` turns off for the reader the link was signed for, the empty
 * answer a mailbox provider's one-click request gets, and a link this app did not sign.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Router } from "remix/router";

import { unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { UserStoreDouble } from "~/app/lib/test/store";

import { createTestRouter, fetchRoute } from "~/app/lib/test/controller";
import { createUserStoreDouble } from "~/app/lib/test/store";
import { unsubscribeUrl } from "~/app/push/unsubscribe";
import routes from "~/routes/web";

/** The reader a link is signed for. */
const SUBJECT = "01J0READER0000000000000000";

let store: UserStoreDouble = createUserStoreDouble();
let reached: string[] = [];

vi.doMock("~/database/user-do", () => ({
	userStore: (subject: string) => {
		reached.push(subject);
		return store;
	},
}));

let { default: unsubscribe } = await import("./unsubscribe");

/** A router with the endpoint mapped and nobody signed in, as a mail client arrives. */
function createRouter(): Router {
	let router = createTestRouter(null);
	router.map(routes.unsubscribe, unsubscribe);
	return router;
}

/** A token this app signed for {@link SUBJECT}. */
async function signedToken(): Promise<string> {
	let url = unwrap(await unsubscribeUrl(SUBJECT, "https://reader.test"));
	return new URL(url).pathname.split("/").at(-1) ?? "";
}

beforeEach(() => {
	store = createUserStoreDouble();
	reached = [];
});

describe("GET /notifications/unsubscribe/:token", () => {
	test("asks before acting, and changes nothing", async () => {
		let token = await signedToken();

		let response = await fetchRoute(createRouter(), routes.unsubscribe.index.href({ token }));
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain("Stop notification emails");
		expect(html).toContain(routes.unsubscribe.action.href({ token }));
		expect(store.stopEmail).not.toHaveBeenCalled();
	});

	test("answers a link this app did not sign with 404", async () => {
		let response = await fetchRoute(
			createRouter(),
			routes.unsubscribe.index.href({ token: "forged" }),
		);

		expect(response.status).toBe(404);
		expect(await response.text()).toContain("This link does not work");
	});
});

describe("POST /notifications/unsubscribe/:token", () => {
	test("turns the email channel off for the reader a person confirmed for", async () => {
		let token = await signedToken();

		let response = await fetchRoute(createRouter(), routes.unsubscribe.action.href({ token }), {});

		expect(response.status).toBe(200);
		expect(await response.text()).toContain("Emails stopped");
		expect(reached).toEqual([SUBJECT]);
		expect(store.stopEmail).toHaveBeenCalledOnce();
	});

	test("answers a mailbox provider's one-click request with an empty 200", async () => {
		let token = await signedToken();

		let response = await fetchRoute(createRouter(), routes.unsubscribe.action.href({ token }), {
			"List-Unsubscribe": "One-Click",
		});

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("");
		expect(store.stopEmail).toHaveBeenCalledOnce();
	});

	test("answers a forged one-click request the same way, and turns nothing off", async () => {
		let response = await fetchRoute(
			createRouter(),
			routes.unsubscribe.action.href({ token: "forged" }),
			{ "List-Unsubscribe": "One-Click" },
		);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("");
		expect(reached).toEqual([]);
	});
});
