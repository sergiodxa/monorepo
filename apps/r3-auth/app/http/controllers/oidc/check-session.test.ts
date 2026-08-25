/**
 * Router-level tests of the check-session iframe endpoint. The headers are the
 * contract: the page has to be cacheable, has to be `text/html`, and has to leave
 * framing open to any origin — which HTTP expresses through the absence of any
 * framing header at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "vitest";

import type { TestApp } from "~/app/lib/test/http";

import { createTestApp } from "~/app/lib/test/http";
import { ORIGIN } from "~/app/lib/test/seed";
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
	});

	test("answers the postMessage protocol from the op_browser_state cookie", async () => {
		let body = await (await fetchCheckSession()).text();

		expect(body).toContain("op_browser_state=");
		expect(body).toContain("addEventListener('message'");
		expect(body).toContain("postMessage('unchanged'");
		expect(body).toContain("postMessage('changed'");
	});
});
