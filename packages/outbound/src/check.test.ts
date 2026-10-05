/**
 * Exercises `checkUrl` on the URL alone: schemes, credentials, every port policy,
 * address literals classified as public or not, reserved names, and the `hosts` and
 * `literals` options that relax or tighten the host rules.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { CheckOptions } from "./check.js";

import { checkUrl } from "./check.js";

/** The code a refused URL failed with, or `null` for one that passed. */
function codeOf(input: string, options?: CheckOptions) {
	let result = checkUrl(input, options);
	return isFailure(result) ? result.error.code : null;
}

describe("checkUrl", () => {
	test("answers the parsed URL", () => {
		let result = checkUrl("https://Example.com/feed.xml");
		expect(isSuccess(result) && result.data.href).toBe("https://example.com/feed.xml");
	});

	test("accepts a URL already parsed", () => {
		expect(isSuccess(checkUrl(new URL("https://example.com/")))).toBe(true);
	});

	test("refuses text that is not a URL, keeping the text", () => {
		let result = checkUrl("not a url");
		expect(isFailure(result) && result.error.code).toBe("invalid-url");
		expect(isFailure(result) && result.error.url).toBe("not a url");
		expect(isFailure(result) && result.error.retryable).toBe(false);
	});

	test.each(["ftp://example.com/", "file:///etc/passwd", "javascript:alert(1)", "data:,x"])(
		"refuses the scheme of %s",
		(input) => {
			expect(codeOf(input)).toBe("refused-scheme");
		},
	);

	test.each([
		"https://user:pass@example.com/",
		"https://user@example.com/",
		"https://:p@example.com/",
	])("refuses the credentials in %s", (input) => {
		expect(codeOf(input)).toBe("refused-credentials");
	});

	test.each([
		"http://127.0.0.1/",
		"http://169.254.169.254/latest",
		"http://10.0.0.1/",
		"http://0x7f.1/",
		"http://2130706433/",
		"http://[::1]/",
		"http://[::ffff:10.0.0.1]/",
		"http://[fd00::1]/",
		"http://0.0.0.0/",
	])("refuses the non-public address in %s", (input) => {
		expect(codeOf(input)).toBe("refused-address");
	});

	test.each(["http://8.8.8.8/", "http://[2606:4700:4700::1111]/", "http://[::ffff:8.8.8.8]/"])(
		"accepts the public address in %s",
		(input) => {
			expect(codeOf(input)).toBeNull();
		},
	);

	test("refuses every literal under literals: refuse", () => {
		expect(codeOf("http://8.8.8.8/", { literals: "refuse" })).toBe("refused-address");
		expect(codeOf("https://example.com/", { literals: "refuse" })).toBeNull();
	});

	test.each([
		"http://localhost:8787/",
		"http://localhost./",
		"http://api.localhost/",
		"http://printer.local/",
		"http://db.internal/",
		"http://router.home.arpa/",
		"http://site.test/",
		"http://www.example/",
		"http://intranet/",
	])("refuses the reserved name in %s", (input) => {
		expect(codeOf(input)).toBe("refused-host");
	});

	test("judges a reserved suffix by whole labels", () => {
		expect(codeOf("https://example.com/")).toBeNull();
		expect(codeOf("https://mylocal.dev/")).toBeNull();
		expect(codeOf("https://example.com./")).toBeNull();
	});

	test("allows every port by default", () => {
		expect(codeOf("https://example.com:8443/")).toBeNull();
	});

	test("allows only the scheme's own port under ports: default", () => {
		expect(codeOf("https://example.com/", { ports: "default" })).toBeNull();
		expect(codeOf("https://example.com:443/", { ports: "default" })).toBeNull();
		expect(codeOf("https://example.com:80/", { ports: "default" })).toBe("refused-port");
		expect(codeOf("http://example.com:8080/", { ports: "default" })).toBe("refused-port");
	});

	test("allows the listed ports, an omitted port counting as the scheme's own", () => {
		let ports = [80, 443];
		expect(codeOf("https://example.com/", { ports })).toBeNull();
		expect(codeOf("http://example.com/", { ports })).toBeNull();
		expect(codeOf("https://example.com:80/", { ports })).toBeNull();
		expect(codeOf("https://example.com:22/", { ports })).toBe("refused-port");
	});

	test("keeps the scheme and credential rules under hosts: any", () => {
		expect(codeOf("http://127.0.0.1:8787/", { hosts: "any" })).toBeNull();
		expect(codeOf("http://localhost/", { hosts: "any" })).toBeNull();
		expect(codeOf("ftp://localhost/", { hosts: "any" })).toBe("refused-scheme");
		expect(codeOf("http://u:p@localhost/", { hosts: "any" })).toBe("refused-credentials");
	});
});
