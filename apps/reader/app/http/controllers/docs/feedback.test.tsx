/**
 * Tests `POST /docs/feedback`: a vote on a help page sends the reader back to that page to
 * be thanked, and a vote naming no help page lands on the hub.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { createLogger } from "@sdxc/logger";
import { log } from "@sdxc/logger/middleware";
import { describe, expect, test } from "vitest";

import type { AppRouter } from "~/app/test/controller";

import feedback from "~/app/http/controllers/docs/feedback";
import { createTestRouter, fetchRoute } from "~/app/test/controller";
import { docHref } from "~/resources/docs/registry";
import routes from "~/routes/web";

/** Every record the vote's log event wrote, read back by the assertions. */
let records: Record<string, unknown>[] = [];

/**
 * A router with the vote mapped behind the app's log middleware and nobody signed in, since
 * help is public; the vote lands on the request's log event.
 */
function createRouter(): AppRouter {
	records = [];
	let logger = createLogger({ service: "test", sink: (record) => void records.push(record) });
	if (typeof feedback !== "function") throw new Error("The vote is mapped as a plain handler");
	let router = createTestRouter(null);
	router.map(routes.docs.feedback, {
		middleware: [log(logger) as Middleware],
		handler: feedback,
	});
	return router;
}

describe("POST /docs/feedback", () => {
	test("sends the reader back to the page they voted on, thanked", async () => {
		let response = await fetchRoute(createRouter(), routes.docs.feedback.href(), {
			helpful: "no",
			page: docHref("search"),
			note: "I wanted regular expressions",
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(
			`${docHref("search")}?feedback=sent#docs-feedback`,
		);
		expect(records).toContainEqual(
			expect.objectContaining({
				"feedback.page": "search",
				"feedback.helpful": false,
				"feedback.note": "I wanted regular expressions",
			}),
		);
	});

	test("lands a vote naming no help page on the hub", async () => {
		let response = await fetchRoute(createRouter(), routes.docs.feedback.href(), {
			helpful: "yes",
			page: "https://elsewhere.example/phish",
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.docs.index.href());
	});
});
