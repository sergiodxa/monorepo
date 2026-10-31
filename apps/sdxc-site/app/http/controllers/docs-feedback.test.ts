/**
 * Tests the docs feedback endpoint: a vote is logged as one `docs.feedback` event and sends
 * the reader back to the page it was about, and a vote that is malformed, about another
 * site, or carrying an oversized note is refused without being logged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Log } from "@sdxc/logger";
import type { Middleware, RequestHandler } from "remix/router";

import { createLogger } from "@sdxc/logger";
import { log } from "@sdxc/logger/middleware";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";
import routes from "~/routes/web";

import docsFeedback, { MAX_FEEDBACK_NOTE_LENGTH } from "./docs-feedback";

/** Posts `fields` as a form to the endpoint and returns the response with the notes it logged. */
async function post(fields: Record<string, string>) {
	let record: Record<string, unknown> = {};
	let router = createRouter({
		middleware: [
			log(
				createLogger({ service: "sdxc-site", sink: (emitted) => void (record = emitted) }),
			) as Middleware,
			formData() as Middleware,
		],
	});
	router.map(routes.docsFeedback, docsFeedback as RequestHandler<any>);

	let response = await router.fetch(
		new Request(new URL(routes.docsFeedback.href(), "https://sdxc.test"), {
			method: "POST",
			body: new URLSearchParams(fields),
		}),
	);
	let notes = (record.notes as Log.Note[] | undefined) ?? [];
	return { response, feedback: notes.find((note) => note.name === "docs.feedback") };
}

describe("POST /docs/feedback", () => {
	test("logs the vote and redirects back to the page with its thank-you", async () => {
		let { response, feedback } = await post({
			helpful: "no",
			page: "/docs/sdxc/deploy",
			note: "  Show the CI setup.  ",
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe("/docs/sdxc/deploy?feedback=sent#feedback");
		expect(feedback).toMatchObject({
			page: "/docs/sdxc/deploy",
			helpful: false,
			note: "Show the CI setup.",
		});
	});

	test("takes a vote without a note", async () => {
		let { response, feedback } = await post({ helpful: "yes", page: "/api/result", note: "" });

		expect(response.status).toBe(303);
		expect(feedback).toMatchObject({ page: "/api/result", helpful: true });
		expect(feedback?.note).toBeUndefined();
	});

	test("refuses a vote other than yes or no", async () => {
		let { response, feedback } = await post({ helpful: "maybe", page: "/docs/sdxc/deploy" });

		expect(response.status).toBe(400);
		expect(feedback).toBeUndefined();
	});

	test.each(["https://evil.example/phish", "//evil.example/phish", "/\\evil.example", "docs"])(
		"refuses %s as the page, so the redirect never leaves the site",
		async (page) => {
			let { response, feedback } = await post({ helpful: "yes", page });

			expect(response.status).toBe(400);
			expect(response.headers.get("location")).toBeNull();
			expect(feedback).toBeUndefined();
		},
	);

	test("refuses a note over the length cap", async () => {
		let { response, feedback } = await post({
			helpful: "yes",
			page: "/docs/sdxc/deploy",
			note: "x".repeat(MAX_FEEDBACK_NOTE_LENGTH + 1),
		});

		expect(response.status).toBe(400);
		expect(feedback).toBeUndefined();
	});

	test("accepts the site's own form through the full middleware chain", async () => {
		let response = await fetchApp(routes.docsFeedback.href(), {
			method: "POST",
			body: new URLSearchParams({ helpful: "yes", page: "/docs" }),
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe("/docs?feedback=sent#feedback");
	});

	test("refuses a cross-site post through the full middleware chain", async () => {
		let response = await fetchApp(routes.docsFeedback.href(), {
			method: "POST",
			headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
			body: new URLSearchParams({ helpful: "yes", page: "/docs" }),
		});

		expect(response.status).toBe(403);
	});
});
