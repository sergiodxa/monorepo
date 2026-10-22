/**
 * Tests `GET /tags/:tag`: the paid-plan gate on it, a label the reader does not have, and
 * the posts kept under one they do. Labels are sold on a paid plan, so a free reader is
 * sent to their kept posts with the note that says so.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { Viewer } from "~/app/http/middleware/auth";
import type { UserStore } from "~/app/models/user-store";
import type { AppRouter } from "~/app/test/controller";

import { createTestRouter, fetchRoute, VIEWER } from "~/app/test/controller";
import { createUserStoreDouble } from "~/app/test/store";
import routes from "~/routes/web";

let store = createUserStoreDouble();
vi.doMock("~/app/models/user-store", () => ({ userStore: () => store }));

let { default: show } = await import("./show");

/** The label under test, as `getTag()` answers it. */
const TAG: UserStore.Tag = { id: "01J0TAG000000000000000000A1", name: "Rust", slug: "rust" };

/** Dispatches a real `GET` to `path` as `viewer`, through the label controller alone. */
function get(path: string, viewer: Viewer | null = VIEWER): Promise<Response> {
	let router: AppRouter = createTestRouter(viewer);
	router.map(routes.tag, show);
	return fetchRoute(router, path);
}

/** The copy a reader sees, with the markup carrying it stripped out. */
function readsAs(html: string): string {
	return html.replace(/<[^>]*>/g, "");
}

beforeEach(() => {
	store = createUserStoreDouble();
	store.getTag.mockResolvedValue(TAG);
});

describe("GET /tags/:tag", () => {
	test("sends an anonymous visitor home", async () => {
		let response = await get(routes.tag.href({ tag: TAG.id }), null);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(routes.home.href());
	});

	test("shows a paid reader the posts kept under the label", async () => {
		let response = await get(routes.tag.href({ tag: TAG.id }));

		expect(response.status).toBe(200);
		expect(readsAs(await response.text())).toContain("Rust");
		expect(store.taggedQueue).toHaveBeenCalledWith(TAG.id, { cursor: null, limit: 25 });
	});

	/**
	 * A free reader's plan does not carry labels, so the list is refused before any label is
	 * read, and they land on their kept posts with the note a refused label action shows.
	 */
	test("sends a free reader to their kept posts with the paid-plan note", async () => {
		store.labelling.mockResolvedValue({ ok: false, reason: "not-entitled" });

		let response = await get(routes.tag.href({ tag: TAG.id }));

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(`${routes.saved.href()}?tag=not-entitled`);
		expect(store.getTag).not.toHaveBeenCalled();
		expect(store.taggedQueue).not.toHaveBeenCalled();
	});

	test("sends a reader to their kept posts plainly while labels are turned off", async () => {
		store.labelling.mockResolvedValue({ ok: false, reason: "switched-off" });

		let response = await get(routes.tag.href({ tag: TAG.id }));

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(routes.saved.href());
	});

	test("answers 404 for a label the reader does not have", async () => {
		store.getTag.mockResolvedValue(null);

		let response = await get(routes.tag.href({ tag: "missing" }));

		expect(response.status).toBe(404);
	});
});
