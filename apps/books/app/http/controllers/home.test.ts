/**
 * Tests for `GET /` — the landing page renders the pitch and a subscribe form that posts
 * to the subscribe endpoint, carrying the request's UTM parameters through as hidden
 * fields so attribution survives the redirect into the funnel.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/lib/test/router";

describe("GET /", () => {
	test("renders the pitch and the subscribe form", async () => {
		let response = await fetchApp("/");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/html");
		expect(body).toContain("React Router OAuth2 Handbook");
		expect(body).toContain("Get early access &amp; special pricing");
		expect(body).toContain('action="/api/subscribe"');
		expect(body).toContain('type="email"');
		expect(body).toContain("required");
	});

	test("starts the document with the doctype, so the page parses in standards mode", async () => {
		let body = await fetchApp("/").then((response) => response.text());

		expect(body.startsWith("<!DOCTYPE html>")).toBe(true);
		expect(body.indexOf("<html")).toBe("<!DOCTYPE html>".length);
	});

	test("advertises one canonical URL regardless of the host that served the request", async () => {
		let body = await fetchApp("/").then((response) => response.text());

		expect(body).toContain('href="https://books.sergiodxa.com/"');
		expect(body).toContain('content="https://books.sergiodxa.com/og.jpg"');
	});

	test("carries UTM parameters into the form as hidden fields", async () => {
		let body = await fetchApp("/?utm_source=newsletter&utm_campaign=launch").then((response) =>
			response.text(),
		);

		expect(body).toContain('name="source" value="newsletter"');
		expect(body).toContain('name="campaign" value="launch"');
	});

	test("loads no first-party JavaScript", async () => {
		let body = await fetchApp("/").then((response) => response.text());

		expect(body).not.toContain("clientEntry");
		expect(body).toContain("static.cloudflareinsights.com");
	});
});
