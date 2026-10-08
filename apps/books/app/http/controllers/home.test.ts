/**
 * Tests for `GET /` — the landing page renders the pitch and a subscribe form that posts
 * to the subscribe endpoint, and remembers the campaign a visitor landed from in a signed
 * cookie so the form's action can credit it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { CLIENT_ENTRY_HREF, STYLESHEET_HREF } from "~/app/lib/test/assets-manifest";
import { BROWSER } from "~/app/lib/test/attribution";
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

	test("remembers the campaign in a cookie and renders the same form for every visitor", async () => {
		let response = await fetchApp("/?utm_source=newsletter&utm_campaign=launch", {
			headers: { accept: "text/html", "user-agent": BROWSER },
		});
		let body = await response.text();

		expect(
			response.headers.getSetCookie().some((header) => header.startsWith("attribution=")),
		).toBe(true);
		expect(response.headers.get("cache-control")).toContain("private");
		expect(body).not.toContain('name="source"');
		expect(body).not.toContain('name="campaign"');
	});

	test("loads no first-party JavaScript", async () => {
		let body = await fetchApp("/").then((response) => response.text());

		expect(body).not.toContain(CLIENT_ENTRY_HREF);
		expect(body).not.toContain('type="importmap"');
		expect(body).not.toContain('rel="modulepreload"');
		expect(body).toContain("static.cloudflareinsights.com");
	});

	test("links the stylesheet the asset manifest names", async () => {
		let body = await fetchApp("/").then((response) => response.text());

		expect(body).toContain(`<link rel="stylesheet" href="${STYLESHEET_HREF}"`);
	});
});
