/**
 * Tests `POST /docs/feedback`: an answer sends the reader back to the page they answered
 * on, where the form becomes a thank-you, and nothing a form says can redirect off docs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { log } from "@sdxc/logger/middleware";
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import docsFeedback from "~/app/http/controllers/docs-feedback";
import routes from "~/routes/web";

/** Posts the feedback form with `fields` through the form-data middleware the app runs. */
async function submit(fields: Record<string, string>) {
	let router = createRouter({ middleware: [asyncContext(), log() as Middleware, formData()] });
	router.map(routes.docs.feedback, docsFeedback);

	let body = new FormData();
	for (let [name, value] of Object.entries(fields)) body.set(name, value);
	return router.fetch(
		new Request(`https://uptime.test${routes.docs.feedback.href()}`, { method: "POST", body }),
	);
}

describe("POST /docs/feedback", () => {
	test("sends the reader back to the page, which thanks them", async () => {
		let response = await submit({ helpful: "yes", page: "/docs/quickstart", note: "" });

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe("/docs/quickstart?feedback=sent#docs-feedback");
	});

	test("sends a page outside the docs to the hub", async () => {
		let response = await submit({ helpful: "no", page: "//evil.example.com" });

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe("/docs");
	});

	test("sends an invalid answer to the hub", async () => {
		let response = await submit({ helpful: "maybe", page: "/docs/quickstart" });

		expect(response.headers.get("Location")).toBe("/docs");
	});
});
