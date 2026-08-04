/**
 * Tests for the bulk monitor import parser and its form schema. Exercises the line rules on
 * their own — trimming, blank lines, bare hosts, duplicates, invalid lines, and the
 * per-submission cap — since they are the whole feature and none of them needs a request, a
 * team, or a database to be wrong.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { isFailure, isSuccess } from "@pkg/result";
import { validate } from "@pkg/validate";

import {
	ImportMonitorsSchema,
	MAX_IMPORT_LINE_LENGTH,
	MAX_IMPORT_LINES,
	monitorImportName,
	parseMonitorImportList,
} from "./monitor-import";

describe("parseMonitorImportList", () => {
	test("trims each line and ignores blank ones", () => {
		let plan = parseMonitorImportList(
			"  https://example.com  \n\n\t\n   \nhttps://other.example/health\n",
		);

		expect(plan.rejected).toEqual([]);
		expect(plan.overflow).toBe(0);
		expect(plan.accepted.map((candidate) => candidate.url)).toEqual([
			"https://example.com/",
			"https://other.example/health",
		]);
	});

	test("normalises a bare host to https", () => {
		let plan = parseMonitorImportList("example.com\nsub.example.org/status?deep=1");

		expect(plan.rejected).toEqual([]);
		expect(plan.accepted.map((candidate) => candidate.url)).toEqual([
			"https://example.com/",
			"https://sub.example.org/status?deep=1",
		]);
	});

	test("keeps an explicit http scheme rather than upgrading it", () => {
		let plan = parseMonitorImportList("http://example.com");

		expect(plan.accepted[0]?.url).toBe("http://example.com/");
	});

	test("names each monitor after its host, without www and without the path", () => {
		let plan = parseMonitorImportList("https://www.example.com/a/deep/path?x=1#top");

		expect(plan.accepted[0]?.name).toBe("example.com");
	});

	test("rejects the second spelling of one endpoint as a duplicate, keeping the first", () => {
		let plan = parseMonitorImportList(
			[
				"example.com",
				"https://example.com/",
				"https://example.com/#top",
				"https://example.com",
			].join("\n"),
		);

		expect(plan.accepted).toHaveLength(1);
		expect(plan.accepted[0]?.line).toBe(1);
		expect(plan.rejected.map((rejection) => rejection.line)).toEqual([2, 3, 4]);
		expect(plan.rejected.every((rejection) => rejection.reason === "duplicate")).toBe(true);
	});

	test("treats http and https spellings of one host as two endpoints", () => {
		let plan = parseMonitorImportList("http://example.com\nhttps://example.com");

		expect(plan.accepted).toHaveLength(2);
		expect(plan.rejected).toEqual([]);
	});

	test("reports each unusable line with its own line number and reason", () => {
		let plan = parseMonitorImportList(
			[
				"https://good.example.com",
				"not a url at all",
				"Homepage",
				"ftp://files.example.com",
				"example.",
				"https://user:pass@example.net",
			].join("\n"),
		);

		expect(plan.accepted).toHaveLength(1);
		expect(plan.rejected).toEqual([
			{ line: 2, input: "not a url at all", reason: "invalidUrl" },
			{ line: 3, input: "Homepage", reason: "invalidUrl" },
			{ line: 4, input: "ftp://files.example.com", reason: "invalidUrl" },
			{ line: 5, input: "example.", reason: "invalidUrl" },
			{ line: 6, input: "https://user:pass@example.net", reason: "invalidUrl" },
		]);
	});

	test("rejects an over-long line without echoing all of it back", () => {
		let line = `https://example.com/${"a".repeat(MAX_IMPORT_LINE_LENGTH)}`;

		let plan = parseMonitorImportList(line);

		expect(plan.accepted).toEqual([]);
		expect(plan.rejected[0]?.reason).toBe("tooLong");
		expect(plan.rejected[0]?.input.length).toBeLessThan(line.length);
	});

	test("examines only the first MAX_IMPORT_LINES non-blank lines and counts the rest", () => {
		let lines = Array.from({ length: MAX_IMPORT_LINES + 7 }, (_, index) => `site-${index}.example`);

		let plan = parseMonitorImportList(lines.join("\n\n"));

		expect(plan.accepted).toHaveLength(MAX_IMPORT_LINES);
		expect(plan.rejected).toEqual([]);
		expect(plan.overflow).toBe(7);
	});

	test("counts rejected lines against the cap too, so the report can never outgrow it", () => {
		let lines = Array.from({ length: MAX_IMPORT_LINES + 3 }, () => "nope");

		let plan = parseMonitorImportList(lines.join("\n"));

		expect(plan.accepted).toEqual([]);
		expect(plan.rejected).toHaveLength(MAX_IMPORT_LINES);
		expect(plan.overflow).toBe(3);
	});

	test("accepts CRLF pasted text", () => {
		let plan = parseMonitorImportList("example.com\r\nother.example\r\n");

		expect(plan.accepted).toHaveLength(2);
		expect(plan.rejected).toEqual([]);
	});

	test("returns an empty plan for text with nothing in it", () => {
		expect(parseMonitorImportList("\n \n\t\n")).toEqual({
			accepted: [],
			rejected: [],
			overflow: 0,
		});
	});
});

describe("monitorImportName", () => {
	test("drops a leading www and the path", () => {
		expect(monitorImportName("https://www.example.com/health?x=1")).toBe("example.com");
	});

	test("returns an unparseable string unchanged, so it is total", () => {
		expect(monitorImportName("not a url")).toBe("not a url");
	});
});

describe("ImportMonitorsSchema", () => {
	test("accepts a pasted list with an interval", async () => {
		let result = await validate(
			new URLSearchParams({ urls: "example.com", interval_seconds: "300" }),
			ImportMonitorsSchema,
		);

		expect(isSuccess(result)).toBe(true);
		if (!isSuccess(result)) return;
		expect(result.data.urls).toBe("example.com");
		expect(result.data.interval_seconds).toBe(300);
	});

	test("defaults the interval to ten minutes, like the single-monitor form", async () => {
		let result = await validate(new URLSearchParams({ urls: "example.com" }), ImportMonitorsSchema);

		expect(isSuccess(result)).toBe(true);
		if (!isSuccess(result)) return;
		expect(result.data.interval_seconds).toBe(600);
	});

	test("refuses an empty paste box", async () => {
		let result = await validate(new URLSearchParams({ urls: "" }), ImportMonitorsSchema);

		expect(isFailure(result)).toBe(true);
	});

	test("refuses an interval outside the bounds the form offers", async () => {
		let tooFast = await validate(
			new URLSearchParams({ urls: "example.com", interval_seconds: "30" }),
			ImportMonitorsSchema,
		);
		let tooSlow = await validate(
			new URLSearchParams({ urls: "example.com", interval_seconds: "7200" }),
			ImportMonitorsSchema,
		);

		expect(isFailure(tooFast)).toBe(true);
		expect(isFailure(tooSlow)).toBe(true);
	});
});
