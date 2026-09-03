/**
 * Tests the HTTP grammar on both halves of an exchange, and on the boundary
 * between the headers and the body.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { scan } from "../lexer.js";

import { http } from "./http.js";

describe("http", () => {
	test("paints a request line's method, target and version", () => {
		expect(scan("POST /api/v1/monitors HTTP/1.1\n", http)).toEqual([
			{ type: "keyword", value: "POST" },
			{ type: "plain", value: " " },
			{ type: "attr-value", value: "/api/v1/monitors" },
			{ type: "plain", value: " " },
			{ type: "constant", value: "HTTP/1.1" },
			{ type: "plain", value: "\n" },
		]);
	});

	test("paints a status line's code and reason", () => {
		expect(scan("HTTP/1.1 204 No Content\n", http)).toEqual([
			{ type: "constant", value: "HTTP/1.1" },
			{ type: "plain", value: " " },
			{ type: "number", value: "204" },
			{ type: "plain", value: " " },
			{ type: "keyword", value: "No Content" },
			{ type: "plain", value: "\n" },
		]);
	});

	test("splits a header into its name and its value", () => {
		expect(scan("Content-Type: application/json\n", http)).toEqual([
			{ type: "property", value: "Content-Type" },
			{ type: "punctuation", value: ":" },
			{ type: "plain", value: " " },
			{ type: "string", value: "application/json" },
			{ type: "plain", value: "\n" },
		]);
	});

	test("keeps a `:` inside a header value part of the value", () => {
		expect(scan("Host: uptime.sergiodxa.com:8787\n", http)).toEqual([
			{ type: "property", value: "Host" },
			{ type: "punctuation", value: ":" },
			{ type: "plain", value: " " },
			{ type: "string", value: "uptime.sergiodxa.com:8787" },
			{ type: "plain", value: "\n" },
		]);
	});

	test("leaves the body plain, headers and all behind it", () => {
		let tokens = scan("Accept: */*\n\nContent-Type: text/plain\n", http);

		expect(tokens).toEqual([
			{ type: "property", value: "Accept" },
			{ type: "punctuation", value: ":" },
			{ type: "plain", value: " " },
			{ type: "string", value: "*/*" },
			{ type: "plain", value: "\n\nContent-Type: text/plain\n" },
		]);
	});

	test("reads the blank line the same way with carriage returns", () => {
		let tokens = scan("Accept: */*\r\n\r\n{}\r\n", http);

		expect(tokens.at(-1)).toEqual({ type: "plain", value: "\r\n\r\n{}\r\n" });
	});

	/**
	 * From `packages/rate-limit/README.md`, which is why this grammar exists: a
	 * rate-limited response, its headers, and a JSON body after the blank line.
	 */
	test("scans a real response, covering it exactly", () => {
		let code = [
			"HTTP/1.1 429 Too Many Requests",
			"Content-Type: application/json",
			"RateLimit: limit=20, reset=37",
			"RateLimit-Policy: 20;w=60",
			"Retry-After: 37",
			"",
			'{"error":"too_many_requests"}',
			"",
		].join("\n");

		let tokens = scan(code, http);

		expect(tokens.map((token) => token.value).join("")).toBe(code);
		expect(tokens.slice(0, 5)).toEqual([
			{ type: "constant", value: "HTTP/1.1" },
			{ type: "plain", value: " " },
			{ type: "number", value: "429" },
			{ type: "plain", value: " " },
			{ type: "keyword", value: "Too Many Requests" },
		]);
		expect(tokens.filter((token) => token.type === "property")).toEqual([
			{ type: "property", value: "Content-Type" },
			{ type: "property", value: "RateLimit" },
			{ type: "property", value: "RateLimit-Policy" },
			{ type: "property", value: "Retry-After" },
		]);
		expect(tokens.at(-1)).toEqual({ type: "plain", value: '\n\n{"error":"too_many_requests"}\n' });
	});
});
