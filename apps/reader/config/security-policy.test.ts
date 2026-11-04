/**
 * Checks the policy every response is read under, byte for byte as the app decided it, through
 * the middleware that applies it: each directive and header present, a response setting its own
 * policy keeping it, and the body the renderer produced reaching the reader unchanged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { securityHeaders } from "@sdxc/security-headers/middleware";
import { remixCsp } from "@sdxc/security-headers/remix";
import { csp } from "remix/middleware/csp";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { CONTENT_SECURITY_POLICY, SECURITY_POLICY } from "~/config/security-policy";

/** Answers `response` through a router carrying the CSP and non-CSP policy middleware. */
async function decorated(response: () => Response): Promise<Response> {
	let router = createRouter({
		middleware: [
			csp({
				policy: ({ nonce }) => remixCsp(CONTENT_SECURITY_POLICY, nonce),
			}),
			securityHeaders(SECURITY_POLICY),
		],
	});
	router.get("/", response);
	return router.fetch("https://reader.test/");
}

/** HTML fixture so Remix's default CSP filter (text/html only) selects the response. */
function html(body: string, init?: ResponseInit): Response {
	let headers = new Headers(init?.headers);
	if (!headers.has("content-type")) headers.set("content-type", "text/html");
	return new Response(body, { ...init, headers });
}

describe("the security policy", () => {
	test("writes the Content-Security-Policy the app decided on", async () => {
		let response = await decorated(() => html("<p>hi</p>"));
		let policy = response.headers.get("content-security-policy") ?? "";

		expect(policy).toMatch(
			/^default-src 'none'; script-src 'self' 'nonce-[A-Za-z0-9+/=]+'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; media-src 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'self' https:\/\/auth\.sergiodxa\.com https:\/\/polar\.sh https:\/\/buy\.polar\.sh; base-uri 'none'; object-src 'none'$/,
		);
	});

	test("names no publisher's host in any directive", async () => {
		let response = await decorated(() => html("<p>hi</p>"));
		let policy = response.headers.get("content-security-policy") ?? "";
		let fetching = policy.split("; ").filter((directive) => !directive.startsWith("form-action "));

		expect(fetching.join("; ")).not.toContain("https:");
		expect(policy).not.toContain("report-uri");
		expect(policy).not.toContain("'unsafe-eval'");
	});

	/**
	 * Sign-in and checkout are forms whose response redirects off-site, and a browser blocks
	 * that redirect unless `form-action` names where it leads.
	 */
	test("lets a form's redirect reach the identity provider and the payment platform", async () => {
		let response = await decorated(() => html("<p>hi</p>"));
		let policy = response.headers.get("content-security-policy") ?? "";
		let formAction = policy.split("; ").find((directive) => directive.startsWith("form-action "));

		expect(formAction?.split(" ")).toEqual(
			expect.arrayContaining([
				"https://auth.sergiodxa.com",
				"https://polar.sh",
				"https://buy.polar.sh",
			]),
		);
	});

	test("carries the rest of the header set on every response", async () => {
		let response = await decorated(() => html("<p>hi</p>"));

		expect(response.headers.get("referrer-policy")).toBe("no-referrer");
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(response.headers.get("strict-transport-security")).toBe(
			"max-age=63072000; includeSubDomains; preload",
		);
		expect(response.headers.get("cross-origin-opener-policy")).toBe("same-origin");
		expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
		expect(response.headers.get("x-frame-options")).toBe("DENY");
		expect(response.headers.get("permissions-policy")).toBe(
			"camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
		);
	});

	test("hands the body on exactly as the handler produced it", async () => {
		let response = await decorated(() => html("<p>hi</p>", { status: 404 }));

		expect(response.status).toBe(404);
		expect(await response.text()).toBe("<p>hi</p>");
	});

	test("preserves a response's own CSP as a separate policy Remix appends beside", async () => {
		let response = await decorated(() =>
			html("<p>hi</p>", { headers: { "content-security-policy": "sandbox" } }),
		);

		/** Remix appends; `Headers#get` joins multiple values with ", ". */
		expect(response.headers.get("content-security-policy")).toContain("sandbox");
		expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
		expect(response.headers.get("referrer-policy")).toBe("no-referrer");
	});

	test("sends a proxied image's nosniff and resource policy through the middleware", async () => {
		let response = await decorated(
			() => new Response("", { headers: { "content-type": "image/png" } }),
		);

		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
	});
});
