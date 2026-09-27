/**
 * Checks that the app's own router answers `/.well-known/security.txt`, under the security
 * headers every response carries, so the file a researcher finds is the one the app serves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:test";
import { describe, expect, test } from "vitest";

import application from "~/bootstrap/app";

describe("GET /.well-known/security.txt", () => {
	test("is answered by the app with the reader's contact", async () => {
		let router = application({ kv: env.KV, cookieSecret: "test-cookie-secret", secure: false });

		let response = await router.fetch(
			new Request("https://reader.sergiodxa.com/.well-known/security.txt"),
		);

		expect(response.status).toBe(200);
		expect(await response.text()).toContain("Contact: mailto:security@sergiodxa.com");
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
	});
});
