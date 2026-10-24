/**
 * Router-level tests of the check-session iframe endpoint. The headers are the
 * contract: the page has to be cacheable, has to be `text/html`, has to leave framing
 * open to any origin — which HTTP expresses through the absence of any framing header
 * at all — and has to admit its own script under the CSP.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Base64, sha256 } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import type { TestApp } from "~/app/test/http";

import { createTestApp } from "~/app/test/http";
import { ORIGIN } from "~/app/test/seed";
import routes from "~/routes/web";

let app: TestApp;

beforeEach(async () => {
	app = await createTestApp();
});

async function fetchCheckSession(): Promise<Response> {
	return await app.fetch(new Request(`${ORIGIN}${routes.oidc.checkSession.href()}`));
}

describe("GET /oidc/check-session", () => {
	test("serves an HTML page a relying party can cache", async () => {
		let response = await fetchCheckSession();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
		expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
	});

	test("sends no framing restriction of any kind", async () => {
		let response = await fetchCheckSession();

		expect(response.headers.has("x-frame-options")).toBe(false);
		expect(response.headers.get("content-security-policy") ?? "").not.toContain("frame-ancestors");
		expect(response.headers.get("content-security-policy-report-only") ?? "").not.toContain(
			"frame-ancestors",
		);
	});

	test("admits its inline script under the Report-Only CSP by hash", async () => {
		let response = await fetchCheckSession();
		let script = /<script>([\s\S]*)<\/script>/.exec(await response.text())?.[1];
		expect(script).toBeDefined();

		let hash = Base64.encode(unwrap(await sha256(script ?? "")));
		expect(response.headers.get("content-security-policy-report-only")).toContain(
			`'sha256-${hash}'`,
		);
	});

	test("answers the postMessage protocol from the op_browser_state cookie", async () => {
		let body = await (await fetchCheckSession()).text();

		expect(body).toContain("op_browser_state=");
		expect(body).toContain("addEventListener('message'");
		expect(body).toContain("postMessage('unchanged'");
		expect(body).toContain("postMessage('changed'");
	});
});
