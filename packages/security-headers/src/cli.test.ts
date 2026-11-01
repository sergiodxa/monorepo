/**
 * Tests for the `sdxc-security-headers` command line: what `audit` and `csp parse` print on
 * each stream and the exit code they answer, driven through `invoke()` with the audited pages
 * served by MSW.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { invoke } from "@sdxc/cli/test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { cli } from "./cli.js";

const STRONG_HEADERS: Record<string, string> = {
	"content-security-policy": "default-src 'self'; object-src 'none'; frame-ancestors 'none'",
	"strict-transport-security": "max-age=63072000; includeSubDomains",
	"x-content-type-options": "nosniff",
	"referrer-policy": "no-referrer",
	"permissions-policy": "camera=()",
	"cross-origin-opener-policy": "same-origin",
};

const server = setupServer(
	http.get("https://strong.sdxc.dev/", () => new HttpResponse("ok", { headers: STRONG_HEADERS })),
	http.get(
		"https://weak.sdxc.dev/",
		() =>
			new HttpResponse("ok", {
				headers: {
					...STRONG_HEADERS,
					"referrer-policy": "unsafe-url",
					"x-content-type-options": "",
				},
			}),
	),
	http.get("https://bare.sdxc.dev/", () => new HttpResponse("ok")),
	http.get("https://down.sdxc.dev/", () => HttpResponse.error()),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => server.resetHandlers());

afterAll(() => server.close());

/** Runs `sdxc-security-headers` with no terminal attached. */
function run(argv: string[], stdin?: string) {
	return invoke(cli, argv, { env: {}, stdin, interactive: false });
}

describe("sdxc-security-headers audit", () => {
	test("prints every header ok and exits 0 for a strong page", async () => {
		let { code, stdout, stderr } = await run(["audit", "https://strong.sdxc.dev/"]);

		expect(code).toBe(0);
		expect(stdout).toContain("https://strong.sdxc.dev/ (200)\n");
		expect(stdout).toContain("ok       content-security-policy\n");
		expect(stdout).not.toMatch(/missing|weak/);
		expect(stderr).toBe("");
	});

	test("prints the weaknesses and exits 1 naming the count", async () => {
		let { code, stdout, stderr } = await run(["audit", "https://weak.sdxc.dev/"]);

		expect(code).toBe(1);
		expect(stdout).toContain(
			"weak     referrer-policy\n         unsafe-url sends the full URL, path and query included, to other origins\n",
		);
		expect(stderr).toContain("2 weak");
	});

	test("reports the missing headers as JSON", async () => {
		let { code, stdout } = await run(["audit", "https://bare.sdxc.dev/", "--json"]);
		let report = JSON.parse(stdout) as { findings: unknown[] };

		expect(code).toBe(1);
		expect(report).toMatchObject({ url: "https://bare.sdxc.dev/", status: 200, passed: false });
		expect(report.findings[0]).toEqual({
			header: "content-security-policy",
			status: "missing",
			value: null,
			notes: [],
		});
	});

	test("exits 2 for a page it cannot reach", async () => {
		let { code, stdout, stderr } = await run(["audit", "https://down.sdxc.dev/"]);

		expect(code).toBe(2);
		expect(stdout).toBe("");
		expect(stderr).toContain("Cannot fetch https://down.sdxc.dev/");
	});

	test("exits 2 for an argument that is not a URL", async () => {
		let { code, stderr } = await run(["audit", "sdxc.dev"]);

		expect(code).toBe(2);
		expect(stderr).toContain("Not a URL: sdxc.dev");
	});
});

describe("sdxc-security-headers csp parse", () => {
	test("prints one directive per line under its typed name", async () => {
		let { code, stdout } = await run([
			"csp",
			"parse",
			"default-src 'self'; upgrade-insecure-requests; prefetch-src 'self'",
		]);

		expect(code).toBe(0);
		expect(stdout).toBe(
			"defaultSrc self\nupgradeInsecureRequests true\nprefetch-src 'self' (not modelled)\n",
		);
	});

	test("reads stdin and numbers several policies", async () => {
		let { code, stdout } = await run(["csp", "parse"], "script-src 'self', img-src *\n");

		expect(code).toBe(0);
		expect(stdout).toBe("Policy 1\nscriptSrc self\n\nPolicy 2\nimgSrc *\n");
	});

	test("prints the parsed policies as JSON", async () => {
		let { stdout } = await run(["csp", "parse", "script-src 'nonce-abc'", "--json"]);

		expect(JSON.parse(stdout)).toEqual([{ directives: { scriptSrc: ["nonce-abc"] }, unknown: {} }]);
	});

	test("exits 2 with the position of a value outside the grammar", async () => {
		let { code, stderr } = await run(["csp", "parse", "script_src 'self'"]);

		expect(code).toBe(2);
		expect(stderr).toContain("Invalid directive name at position 0");
	});
});
