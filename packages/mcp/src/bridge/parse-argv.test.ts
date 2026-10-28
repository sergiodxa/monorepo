/**
 * Unit tests for `mcp-bridge` argv parsing: URL, headers, token shorthand, and --allow-http.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { isBridgeArgvError, parseBridgeArgv } from "./parse-argv.js";

describe("parseBridgeArgv", () => {
	test("reads a https URL and repeated headers", () => {
		let parsed = parseBridgeArgv([
			"https://uptime.example.com/mcp",
			"--header",
			"Authorization:Bearer secret",
			"--header",
			"X-Tenant: acme",
		]);

		expect(isBridgeArgvError(parsed)).toBe(false);
		if (isBridgeArgvError(parsed)) return;
		expect(parsed).toEqual({
			url: "https://uptime.example.com/mcp",
			headers: {
				Authorization: "Bearer secret",
				"X-Tenant": "acme",
			},
			allowHttp: false,
		});
	});

	test("maps --token to an Authorization Bearer header", () => {
		let parsed = parseBridgeArgv(["https://example.com/mcp", "--token", "abc"]);
		expect(isBridgeArgvError(parsed)).toBe(false);
		if (isBridgeArgvError(parsed)) return;
		expect(parsed.headers.Authorization).toBe("Bearer abc");
	});

	test("rejects cleartext http without --allow-http", () => {
		let parsed = parseBridgeArgv(["http://127.0.0.1:8787/mcp"]);
		expect(isBridgeArgvError(parsed)).toBe(true);
		if (!isBridgeArgvError(parsed)) return;
		expect(parsed.message).toContain("--allow-http");
	});

	test("allows cleartext http with --allow-http", () => {
		let parsed = parseBridgeArgv(["http://127.0.0.1:8787/mcp", "--allow-http"]);
		expect(isBridgeArgvError(parsed)).toBe(false);
		if (isBridgeArgvError(parsed)) return;
		expect(parsed.allowHttp).toBe(true);
	});
});
