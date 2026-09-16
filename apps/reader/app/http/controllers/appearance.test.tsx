/**
 * Tests the appearance controls: the form on the settings page, the `POST` that stores an
 * answer, and the reconciliation that puts a drifted cookie back to what is stored.
 *
 * One fact with two writers is the thing worth asserting on. A response that stores without
 * setting leaves the reader's next page painted in what they had before, and a settings page
 * that reads a stale cookie shows them a control set to something they did not pick.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Router } from "remix/router";

import { beforeEach, describe, expect, test, vi } from "vitest";

import type { UserStoreDouble } from "~/app/lib/test/store";

import { readPresentation, writePresentation } from "~/app/http/cookies";
import { createTestRouter, ORIGIN, VIEWER } from "~/app/lib/test/controller";
import { createUserStoreDouble, DEFAULT_SETTINGS } from "~/app/lib/test/store";
import routes from "~/routes/web";

let store: UserStoreDouble = createUserStoreDouble();

vi.doMock("~/database/user-do", () => ({ userStore: () => store }));

let { default: appearance, FACE_FIELD, THEME_FIELD } = await import("./appearance");
let { default: settings } = await import("./settings");

/** A router with both surfaces mapped, signed in as `viewer` or as nobody. */
function createRouter(viewer: typeof VIEWER | null): Router {
	let router = createTestRouter(viewer);
	router.map(routes.settings, settings);
	router.map(routes.appearance, appearance);
	return router;
}

/** The `Cookie` header a browser holding this answer would send. */
async function cookieFor(theme: "system" | "light" | "dark", face: "sans" | "serif") {
	return (await writePresentation({ theme, face })).split(";")[0] ?? "";
}

/** What a `Set-Cookie` on a response says the browser now holds, or `null` for none. */
function carried(response: Response) {
	let header = response.headers.get("set-cookie");
	if (header === null) return null;

	let value = header.split(";")[0]?.split("=").slice(1).join("=") ?? "";
	return readPresentation(decodeURIComponent(atob(decodeURIComponent(value))));
}

beforeEach(() => {
	store = createUserStoreDouble();
});

describe("POST /settings/appearance", () => {
	test("sends an anonymous visitor home", async () => {
		let response = await createRouter(null).fetch(
			new Request(new URL(routes.appearance.href(), ORIGIN), { method: "POST" }),
		);

		expect(response.status).toBe(303);
		expect(store.setPresentation).not.toHaveBeenCalled();
	});

	test("stores the answer and sets the cookie on the same response", async () => {
		store.setPresentation.mockResolvedValue({ theme: "dark", face: "serif" });

		let response = await createRouter(VIEWER).fetch(
			new Request(new URL(routes.appearance.href(), ORIGIN), {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({ [THEME_FIELD]: "dark", [FACE_FIELD]: "serif" }),
			}),
		);

		expect(store.setPresentation).toHaveBeenCalledWith({ theme: "dark", face: "serif" });
		expect(carried(response)).toEqual({ theme: "dark", face: "serif" });
		expect(response.headers.get("location")).toContain(routes.settings.href());
	});

	/**
	 * What the object decided rather than what the form said, so the cookie and the row
	 * cannot leave here disagreeing about an answer the object narrowed.
	 */
	test("carries what was stored rather than what was submitted", async () => {
		store.setPresentation.mockResolvedValue({ theme: "system", face: "sans" });

		let response = await createRouter(VIEWER).fetch(
			new Request(new URL(routes.appearance.href(), ORIGIN), {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({ [THEME_FIELD]: "sepia", [FACE_FIELD]: "comic" }),
			}),
		);

		/** Handed on as it arrived, because the set is the object's to hold a value to. */
		expect(store.setPresentation).toHaveBeenCalledWith({ theme: "sepia", face: "comic" });
		expect(carried(response)).toEqual({ theme: "system", face: "sans" });
	});
});

describe("GET /settings", () => {
	test("offers both controls, set to what is stored", async () => {
		store.getSettings.mockResolvedValue({
			...DEFAULT_SETTINGS,
			presentation: { theme: "dark", face: "serif" },
		});

		let response = await createRouter(VIEWER).fetch(
			new Request(new URL(routes.settings.href(), ORIGIN), {
				headers: { cookie: await cookieFor("dark", "serif") },
			}),
		);

		let html = await response.text();

		expect(html).toContain("How your pages look");
		expect(html).toContain("Follow my system");
		expect(html).toContain("Serif");
		expect(html).toMatch(new RegExp(`name="${THEME_FIELD}"`));
		expect(html).toMatch(new RegExp(`name="${FACE_FIELD}"`));
	});

	/** The row wins, and this is one of exactly two places both are read. */
	test("puts a cookie that disagrees with the row back to the row", async () => {
		store.getSettings.mockResolvedValue({
			...DEFAULT_SETTINGS,
			presentation: { theme: "dark", face: "serif" },
		});

		let response = await createRouter(VIEWER).fetch(
			new Request(new URL(routes.settings.href(), ORIGIN), {
				headers: { cookie: await cookieFor("light", "sans") },
			}),
		);

		expect(carried(response)).toEqual({ theme: "dark", face: "serif" });
	});

	test("sets nothing on a response whose cookie already agrees", async () => {
		store.getSettings.mockResolvedValue({
			...DEFAULT_SETTINGS,
			presentation: { theme: "dark", face: "serif" },
		});

		let response = await createRouter(VIEWER).fetch(
			new Request(new URL(routes.settings.href(), ORIGIN), {
				headers: { cookie: await cookieFor("dark", "serif") },
			}),
		);

		expect(response.headers.get("set-cookie")).toBeNull();
	});
});
