/**
 * Checks the policy every response is read under: that each directive and each header is
 * present with the value the app decided on, that a response setting its own policy keeps
 * it, and that the body the renderer produced reaches the reader unchanged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import securityHeaders, { applySecurityHeaders } from "~/app/http/middleware/security-headers";

/** The policy as one map, so a directive is asserted by name rather than by substring. */
function directives(policy: string): Map<string, string> {
	return new Map(
		policy.split(";").map((directive) => {
			let [name = "", ...rest] = directive.trim().split(/\s+/u);
			return [name, rest.join(" ")];
		}),
	);
}

/** Runs the middleware over a response a handler produced. */
async function decorated(response: Response): Promise<Response> {
	let middleware = securityHeaders as unknown as (
		ctx: unknown,
		next: () => Promise<Response>,
	) => Promise<Response>;

	return await middleware({}, async () => response);
}

describe("securityHeaders", () => {
	test("starts the policy from nothing and permits this origin alone", async () => {
		let response = await decorated(new Response("<p>hi</p>"));
		let policy = directives(response.headers.get("content-security-policy") ?? "");

		expect(policy.get("default-src")).toBe("'none'");
		expect(policy.get("script-src")).toBe("'self'");
		expect(policy.get("img-src")).toBe("'self'");
		expect(policy.get("connect-src")).toBe("'self'");
		expect(policy.get("font-src")).toBe("'self'");
		expect(policy.get("form-action")).toBe("'self'");
		expect(policy.get("manifest-src")).toBe("'self'");
	});

	test("refuses a frame, an object, a plugin document and a rewritten base", async () => {
		let response = await decorated(new Response("<p>hi</p>"));
		let policy = directives(response.headers.get("content-security-policy") ?? "");

		expect(policy.get("frame-src")).toBe("'none'");
		expect(policy.get("frame-ancestors")).toBe("'none'");
		expect(policy.get("object-src")).toBe("'none'");
		expect(policy.get("media-src")).toBe("'none'");
		expect(policy.get("base-uri")).toBe("'none'");
	});

	test("names no publisher's host in any directive", async () => {
		let response = await decorated(new Response("<p>hi</p>"));
		let policy = response.headers.get("content-security-policy") ?? "";

		expect(policy).not.toContain("https:");
		expect(policy).not.toContain("youtube");
		expect(policy).not.toContain("report-uri");
		expect(policy).not.toContain("'unsafe-eval'");
	});

	test("carries the rest of the header set on every response", async () => {
		let response = await decorated(new Response("<p>hi</p>"));

		expect(response.headers.get("referrer-policy")).toBe("no-referrer");
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(response.headers.get("strict-transport-security")).toBe(
			"max-age=63072000; includeSubDomains; preload",
		);
		expect(response.headers.get("cross-origin-opener-policy")).toBe("same-origin");
		expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
		expect(response.headers.get("permissions-policy")).toContain("browsing-topics=()");
	});

	test("hands the body on exactly as the handler produced it", async () => {
		let response = await decorated(new Response("<p>hi</p>", { status: 404 }));

		expect(response.status).toBe(404);
		expect(await response.text()).toBe("<p>hi</p>");
	});

	test("leaves a response that declared its own policy alone", () => {
		let headers = new Headers({ "content-security-policy": "default-src 'none'" });
		applySecurityHeaders(headers);

		expect(headers.get("content-security-policy")).toBe("default-src 'none'");
		expect(headers.get("referrer-policy")).toBe("no-referrer");
	});
});
