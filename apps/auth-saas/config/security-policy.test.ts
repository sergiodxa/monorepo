/**
 * Checks each router's security policy as the middleware writes it: the tenant and
 * platform hosts report their Content Security Policy without enforcing it, name the
 * origins their pages load from, and the JSON-only management API enforces a closed one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CSP } from "@sdxc/security-headers";
import type { SecurityHeaders } from "@sdxc/security-headers";
import type { Middleware } from "remix/router";

import { isFailure } from "@sdxc/result";
import { parse } from "@sdxc/security-headers/csp";
import { securityHeaders } from "@sdxc/security-headers/middleware";
import { remixCsp } from "@sdxc/security-headers/remix";
import { csp } from "remix/middleware/csp";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import {
	MANAGEMENT_CONTENT_SECURITY_POLICY,
	MANAGEMENT_SECURITY_POLICY,
	PLATFORM_CONTENT_SECURITY_POLICY,
	PLATFORM_SECURITY_POLICY,
	TENANT_CONTENT_SECURITY_POLICY,
	TENANT_SECURITY_POLICY,
} from "~/config/security-policy";

/** Options Remix's `csp()` needs for one of the three routers. */
interface CspOptions {
	/** Unquoted directives `remixCsp` turns into the Remix policy factory. */
	directives: CSP.Directives;
	/** When set, Remix sends Report-Only and the Reporting-Endpoints header. */
	reportOnly?: boolean;
}

/** The headers Remix CSP and the non-CSP policy write on a plain HTML page over HTTPS. */
async function headersFor(
	policy: SecurityHeaders.Policy,
	cspOptions: CspOptions,
): Promise<Headers> {
	let remixPolicy = ({ nonce }: { nonce: string }) => remixCsp(cspOptions.directives, nonce);
	let router = createRouter({
		middleware: [
			(cspOptions.reportOnly
				? csp({
						reportOnlyPolicy: remixPolicy,
						reportingEndpoints: { csp: "/reports/csp" },
						filter: () => true,
					})
				: csp({
						policy: remixPolicy,
						filter: () => true,
					})) as Middleware,
			securityHeaders(policy),
		],
	});
	router.get(
		"/",
		() => new Response("<!doctype html>", { headers: { "content-type": "text/html" } }),
	);
	let response = await router.fetch("https://tenant.example.com/");
	return response.headers;
}

/** The directives of the one policy a CSP header carries. */
function directivesOf(value: string | null) {
	let parsed = parse(value ?? "");
	if (isFailure(parsed)) throw parsed.error;
	let [policy] = parsed.data;
	if (!policy) throw new Error("the header carried no policy");
	return policy.directives;
}

describe("TENANT_SECURITY_POLICY", () => {
	test("reports its CSP without enforcing it, naming Turnstile and the report endpoint", async () => {
		let headers = await headersFor(TENANT_SECURITY_POLICY, {
			directives: TENANT_CONTENT_SECURITY_POLICY,
			reportOnly: true,
		});

		expect(headers.get("Content-Security-Policy")).toBeNull();
		let directives = directivesOf(headers.get("Content-Security-Policy-Report-Only"));
		expect(directives.scriptSrc).toContain("https://challenges.cloudflare.com");
		expect(directives.frameSrc).toEqual(["https://challenges.cloudflare.com"]);
		expect(directives.frameAncestors).toEqual(["none"]);
		expect(directives.formAction).toBeUndefined();
		expect(directives.reportTo).toBe("csp");
		expect(headers.get("Reporting-Endpoints")).toBe('csp="/reports/csp"');
	});

	test("keeps tokens out of Referer and leaves the opener to popup-based relying parties", async () => {
		let headers = await headersFor(TENANT_SECURITY_POLICY, {
			directives: TENANT_CONTENT_SECURITY_POLICY,
			reportOnly: true,
		});

		expect(headers.get("Referrer-Policy")).toBe("no-referrer");
		expect(headers.get("Cross-Origin-Opener-Policy")).toBeNull();
		expect(headers.get("Strict-Transport-Security")).toBe("max-age=31536000");
		expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(headers.get("X-Frame-Options")).toBe("DENY");
	});
});

describe("PLATFORM_SECURITY_POLICY", () => {
	test("reports its CSP without enforcing it", async () => {
		let headers = await headersFor(PLATFORM_SECURITY_POLICY, {
			directives: PLATFORM_CONTENT_SECURITY_POLICY,
			reportOnly: true,
		});

		expect(headers.get("Content-Security-Policy")).toBeNull();
		expect(directivesOf(headers.get("Content-Security-Policy-Report-Only")).reportTo).toBe("csp");
		expect(headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
	});

	test("lets the sign-up form's Turnstile widget load its script and challenge frame", async () => {
		let headers = await headersFor(PLATFORM_SECURITY_POLICY, {
			directives: PLATFORM_CONTENT_SECURITY_POLICY,
			reportOnly: true,
		});

		let directives = directivesOf(headers.get("Content-Security-Policy-Report-Only"));
		expect(directives.scriptSrc).toContain("https://challenges.cloudflare.com");
		expect(directives.frameSrc).toEqual(["https://challenges.cloudflare.com"]);
	});
});

describe("MANAGEMENT_SECURITY_POLICY", () => {
	test("enforces a CSP that loads nothing and is framed nowhere", async () => {
		let headers = await headersFor(MANAGEMENT_SECURITY_POLICY, {
			directives: MANAGEMENT_CONTENT_SECURITY_POLICY,
		});

		expect(directivesOf(headers.get("Content-Security-Policy"))).toEqual({
			defaultSrc: ["none"],
			frameAncestors: ["none"],
		});
		expect(headers.get("X-Frame-Options")).toBe("DENY");
	});
});
