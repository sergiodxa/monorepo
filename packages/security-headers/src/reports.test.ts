/**
 * Tests for reading CSP violation reports in both formats browsers send: the Reporting API's
 * `application/reports+json` batches and the legacy `application/csp-report` document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { CSPReportParseError, parseReports } from "./reports.js";

/**
 * @param body - The JSON payload
 * @param contentType - The media type the browser labels it with
 * @returns A report POST as a browser sends one
 */
function reportRequest(body: unknown, contentType: string): Request {
	return new Request("https://example.com/reports/csp", {
		method: "POST",
		headers: { "content-type": contentType },
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

describe("parseReports", () => {
	test("reads a Reporting API batch, skipping reports of other types", async () => {
		let result = await parseReports(
			reportRequest(
				[
					{
						type: "csp-violation",
						age: 10,
						url: "https://example.com/page",
						user_agent: "Mozilla/5.0",
						body: {
							documentURL: "https://example.com/page",
							referrer: "",
							blockedURL: "https://evil.example/x.js",
							effectiveDirective: "script-src-elem",
							originalPolicy: "script-src 'self'",
							sourceFile: "https://example.com/page",
							sample: "",
							disposition: "enforce",
							statusCode: 200,
							lineNumber: 12,
							columnNumber: 4,
						},
					},
					{ type: "deprecation", age: 1, url: "https://example.com/", body: { id: "x" } },
				],
				"application/reports+json",
			),
		);

		expect(result).toEqual({
			status: "success",
			data: [
				{
					documentURL: "https://example.com/page",
					blockedURL: "https://evil.example/x.js",
					effectiveDirective: "script-src-elem",
					disposition: "enforce",
					sample: null,
					sourceFile: "https://example.com/page",
					lineNumber: 12,
				},
			],
		});
	});

	test("reads a legacy report, wire names mapped to the shared shape", async () => {
		let result = await parseReports(
			reportRequest(
				{
					"csp-report": {
						"document-uri": "https://example.com/page",
						referrer: "",
						"violated-directive": "script-src-elem",
						"effective-directive": "script-src-elem",
						"original-policy": "script-src 'self'; report-uri /reports/csp",
						disposition: "report",
						"blocked-uri": "inline",
						"line-number": 3,
						"source-file": "https://example.com/page",
						"status-code": 200,
						"script-sample": "alert(1)",
					},
				},
				"application/csp-report",
			),
		);

		expect(result).toEqual({
			status: "success",
			data: [
				{
					documentURL: "https://example.com/page",
					blockedURL: "inline",
					effectiveDirective: "script-src-elem",
					disposition: "report",
					sample: "alert(1)",
					sourceFile: "https://example.com/page",
					lineNumber: 3,
				},
			],
		});
	});

	test("falls back to the violated directive and enforce for an older legacy report", async () => {
		let result = await parseReports(
			reportRequest(
				{
					"csp-report": {
						"document-uri": "https://example.com/",
						"violated-directive": "img-src 'self'",
						"blocked-uri": "",
					},
				},
				"application/csp-report",
			),
		);

		expect(result).toEqual({
			status: "success",
			data: [
				{
					documentURL: "https://example.com/",
					blockedURL: null,
					effectiveDirective: "img-src",
					disposition: "enforce",
					sample: null,
					sourceFile: null,
					lineNumber: null,
				},
			],
		});
	});

	test("accepts either format sent as application/json", async () => {
		let legacy = await parseReports(
			reportRequest(
				{
					"csp-report": { "document-uri": "https://a.example/", "effective-directive": "img-src" },
				},
				"application/json; charset=utf-8",
			),
		);
		let batch = await parseReports(
			reportRequest(
				[
					{
						type: "csp-violation",
						body: { documentURL: "https://b.example/", effectiveDirective: "img-src" },
					},
				],
				"application/json",
			),
		);

		expect(isSuccess(legacy) && legacy.data[0]?.documentURL).toBe("https://a.example/");
		expect(isSuccess(batch) && batch.data[0]?.documentURL).toBe("https://b.example/");
	});

	test("skips a malformed report inside a batch", async () => {
		let result = await parseReports(
			reportRequest(
				[
					{ type: "csp-violation", body: { documentURL: 42 } },
					{
						type: "csp-violation",
						body: { documentURL: "https://example.com/", effectiveDirective: "font-src" },
					},
				],
				"application/reports+json",
			),
		);

		expect(isSuccess(result) && result.data.map((report) => report.effectiveDirective)).toEqual([
			"font-src",
		]);
	});

	test("fails on an unsupported media type", async () => {
		let result = await parseReports(reportRequest("{}", "text/plain"));

		expect(isFailure(result)).toBe(true);
		if (isSuccess(result)) return;
		expect(result.error).toBeInstanceOf(CSPReportParseError);
	});

	test("fails on a body that is not JSON", async () => {
		expect(isFailure(await parseReports(reportRequest("{", "application/csp-report")))).toBe(true);
	});

	test("fails on JSON in neither format", async () => {
		let result = await parseReports(reportRequest({ hello: "world" }, "application/csp-report"));

		expect(isFailure(result)).toBe(true);
	});
});
