/**
 * Runs the registry middleware inside a real fetch-router: names it serves, suffix
 * paths for inserted formats, falling through for unknown names and `null`
 * documents, CORS preflights, and 405 for other methods.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { WellKnownEntry } from "./middleware.js";
import type { SecurityTxt } from "./security-txt.js";

import { redirect } from "./change-password.js";
import { serve, wellKnown } from "./middleware.js";
import { define, protectedResourceMetadata } from "./oauth-protected-resource.js";
import { securityTxt } from "./security-txt.js";
import { webFinger } from "./webfinger.js";

/** The security.txt the test app serves. */
const SECURITY_TXT: SecurityTxt = {
	contact: [new URL("mailto:security@example.com")],
	expires: new Date("2027-01-01T00:00:00Z"),
	encryption: [],
	acknowledgments: [],
	preferredLanguages: [],
	canonical: [],
	policy: [],
	hiring: [],
	extensions: {},
};

/**
 * A router with the middleware in front of a catch-all route answering 404 with a
 * marker, so a test can tell a fall-through from an answer.
 *
 * @param entries - The names the middleware serves.
 */
function app(entries: Record<string, WellKnownEntry>) {
	let router = createRouter({ middleware: [wellKnown(entries)] });
	router.route("ANY", "*rest", () => new Response("fallthrough", { status: 404 }));
	return (path: string, init?: RequestInit) =>
		router.fetch(new Request(`https://example.com${path}`, init));
}

describe(wellKnown, () => {
	let fetch = app({
		"security.txt": serve(securityTxt, () => SECURITY_TXT),
		webfinger: serve(webFinger, (ctx) =>
			ctx.url.searchParams.get("resource") === "acct:a@example.com"
				? { subject: "acct:a@example.com", aliases: [], properties: {}, links: [] }
				: null,
		),
		"oauth-protected-resource": serve(protectedResourceMetadata, (ctx) =>
			define({
				resource: new URL(
					ctx.url.pathname.replace("/.well-known/oauth-protected-resource", ""),
					ctx.url,
				),
			}),
		),
		"change-password": () => redirect("/password/forgot"),
	});

	test("serves a listed name with its media type", async () => {
		let response = await fetch("/.well-known/security.txt");
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
		expect(await response.text()).toContain("Contact: mailto:security@example.com");
	});

	test("serves a path after an inserted name", async () => {
		let response = await fetch("/.well-known/oauth-protected-resource/v1");
		expect(await response.json()).toMatchObject({ resource: "https://example.com/v1" });
	});

	test("matches a plain entry only on its exact name", async () => {
		expect((await fetch("/.well-known/change-password", { redirect: "manual" })).status).toBe(302);
		expect(await (await fetch("/.well-known/change-password/extra")).text()).toBe("fallthrough");
	});

	test("passes unlisted names and other paths to the next handler", async () => {
		expect(await (await fetch("/.well-known/avatar")).text()).toBe("fallthrough");
		expect(await (await fetch("/security.txt")).text()).toBe("fallthrough");
		expect(await (await fetch("/.well-known/security.txtx")).text()).toBe("fallthrough");
	});

	test("falls through when the entry produces no document", async () => {
		expect(await (await fetch("/.well-known/webfinger?resource=acct:b@example.com")).text()).toBe(
			"fallthrough",
		);
		let found = await fetch("/.well-known/webfinger?resource=acct:a@example.com");
		expect(found.headers.get("Access-Control-Allow-Origin")).toBe("*");
	});

	test("answers HEAD without a body", async () => {
		let response = await fetch("/.well-known/security.txt", { method: "HEAD" });
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("");
	});

	test("answers a CORS preflight for a CORS format only", async () => {
		let preflight = await fetch("/.well-known/webfinger", { method: "OPTIONS" });
		expect(preflight.status).toBe(204);
		expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe("*");

		let other = await fetch("/.well-known/security.txt", { method: "OPTIONS" });
		expect(other.status).toBe(405);
		expect(other.headers.get("Allow")).toBe("GET, HEAD");
	});

	test("answers 405 with Allow for any other method", async () => {
		let response = await fetch("/.well-known/webfinger", { method: "POST" });
		expect(response.status).toBe(405);
		expect(response.headers.get("Allow")).toBe("GET, HEAD, OPTIONS");
	});
});
