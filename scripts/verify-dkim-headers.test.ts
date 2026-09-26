/**
 * Tests for the DKIM header-coverage checker against synthetic delivered messages: folded
 * signatures, several signers, over-signing, a missing header, and an unaligned signer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	addressDomain,
	analyzeMessage,
	formatReport,
	parseHeaders,
	parseTagList,
} from "./verify-dkim-headers.ts";

/** Builds a CRLF message from header lines and a body, as Gmail's download writes it. */
function eml(headers: string[], body = "Hello"): string {
	return `${headers.join("\r\n")}\r\n\r\n${body}\r\n`;
}

/** The one-click pair the trial emails send. */
const LIST_HEADERS = [
	"List-Unsubscribe: <https://uptime.example.com/unsubscribe/abc>",
	"List-Unsubscribe-Post: List-Unsubscribe=One-Click",
];

/** A Gmail-style verdict line naming the signature that passed. */
const AUTH_RESULTS =
	"Authentication-Results: mx.google.com; dkim=pass header.i=@example.com header.s=cf-bounce";

describe("parseHeaders", () => {
	test("unfolds continuation lines and stops at the body", () => {
		let fields = parseHeaders("Subject: one\r\n two\r\n\tthree\r\nX-A: b\r\n\r\nNot: a header\r\n");
		expect(fields).toEqual([
			{ name: "Subject", value: "one two three" },
			{ name: "X-A", value: "b" },
		]);
	});

	test("accepts LF line endings", () => {
		expect(parseHeaders("A: 1\nB: 2\n\nbody")).toHaveLength(2);
	});
});

describe("parseTagList", () => {
	test("strips folding whitespace from values and lowercases tag names", () => {
		let tags = parseTagList(" v=1; D=example.com; h=From : To:\r\n\tSubject; b=ab c");
		expect(tags.get("d")).toBe("example.com");
		expect(tags.get("h")).toBe("From:To:Subject");
		expect(tags.get("b")).toBe("abc");
	});
});

describe("addressDomain", () => {
	test("reads the angle address after a display name", () => {
		expect(addressDomain('"Uptime" <Hello@Mail.Example.com>')).toBe("mail.example.com");
	});

	test("reads a bare address and refuses one without a domain", () => {
		expect(addressDomain("a@example.com")).toBe("example.com");
		expect(addressDomain("nobody")).toBeNull();
	});
});

describe("analyzeMessage", () => {
	test("passes when a folded, aligned signature lists both headers case-insensitively", () => {
		let report = analyzeMessage(
			eml([
				AUTH_RESULTS,
				"DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=example.com;",
				" s=cf-bounce; h=From:To:Subject:Date:Message-ID:",
				"\tList-Unsubscribe:LIST-UNSUBSCRIBE-POST; bh=abc=; b=def=",
				"From: Uptime <uptime@example.com>",
				...LIST_HEADERS,
			]),
		);
		expect(report.ok).toBe(true);
		expect(report.signatures[0]).toMatchObject({
			domain: "example.com",
			selector: "cf-bounce",
			alignedWithFrom: true,
		});
		expect(report.signatures[0]?.coverage.every((header) => header.covered)).toBe(true);
		expect(report.authenticationResults[0]).toContain("dkim=pass");
	});

	test("fails when the signature leaves List-Unsubscribe-Post out", () => {
		let report = analyzeMessage(
			eml([
				"DKIM-Signature: v=1; a=rsa-sha256; d=example.com; s=cf-bounce; h=from:to:subject:list-unsubscribe; bh=x; b=y",
				"From: uptime@example.com",
				...LIST_HEADERS,
			]),
		);
		expect(report.ok).toBe(false);
		expect(report.signatures[0]?.coverage).toEqual([
			{ name: "list-unsubscribe", present: 1, listed: 1, covered: true, overSigned: false },
			{ name: "list-unsubscribe-post", present: 1, listed: 0, covered: false, overSigned: false },
		]);
	});

	test("flags over-signing, which still counts as covered", () => {
		let report = analyzeMessage(
			eml([
				"DKIM-Signature: d=example.com; s=s1; h=from:list-unsubscribe:list-unsubscribe:list-unsubscribe-post:list-unsubscribe-post; b=y",
				"From: uptime@example.com",
				...LIST_HEADERS,
			]),
		);
		expect(report.ok).toBe(true);
		expect(report.signatures[0]?.coverage.every((header) => header.overSigned)).toBe(true);
	});

	test("counts a header present twice but listed once as uncovered", () => {
		let report = analyzeMessage(
			eml([
				"DKIM-Signature: d=example.com; s=s1; h=from:list-unsubscribe:list-unsubscribe-post; b=y",
				"From: uptime@example.com",
				...LIST_HEADERS,
				"List-Unsubscribe: <https://attacker.example.net/>",
			]),
		);
		expect(report.ok).toBe(false);
		expect(report.signatures[0]?.coverage[0]).toMatchObject({
			present: 2,
			listed: 1,
			covered: false,
		});
	});

	test("fails when only an unaligned platform signature covers the headers", () => {
		let report = analyzeMessage(
			eml([
				"DKIM-Signature: d=example.com; s=cf-bounce; h=from:to:subject; b=y",
				"DKIM-Signature: d=platform.example.net; s=s1; h=from:list-unsubscribe:list-unsubscribe-post; b=y",
				"From: uptime@example.com",
				...LIST_HEADERS,
			]),
		);
		expect(report.ok).toBe(false);
		expect(report.signatures.map((signature) => signature.alignedWithFrom)).toEqual([true, false]);
	});

	test("accepts a signature from a parent of the From domain", () => {
		let report = analyzeMessage(
			eml([
				"DKIM-Signature: d=example.com; s=s1; h=from:list-unsubscribe:list-unsubscribe-post; b=y",
				"From: uptime@mail.example.com",
				...LIST_HEADERS,
			]),
		);
		expect(report.ok).toBe(true);
	});

	test("fails a message the headers are missing from, even if h= names them", () => {
		let report = analyzeMessage(
			eml([
				"DKIM-Signature: d=example.com; s=s1; h=from:list-unsubscribe:list-unsubscribe-post; b=y",
				"From: uptime@example.com",
			]),
		);
		expect(report.ok).toBe(false);
	});

	test("ignores a DKIM-Signature-looking line in the body", () => {
		let report = analyzeMessage(
			eml(
				["From: uptime@example.com", ...LIST_HEADERS],
				"DKIM-Signature: d=example.com; s=s1; h=list-unsubscribe:list-unsubscribe-post",
			),
		);
		expect(report.signatures).toHaveLength(0);
		expect(report.ok).toBe(false);
	});
});

describe("formatReport", () => {
	test("prints d=, s=, the h= list, per-header state and the verdict", () => {
		let lines = formatReport(
			analyzeMessage(
				eml([
					"DKIM-Signature: d=example.com; s=cf-bounce; a=rsa-sha256; h=from:list-unsubscribe; b=y",
					"From: uptime@example.com",
					...LIST_HEADERS,
				]),
			),
		);
		expect(lines).toContain(
			"DKIM-Signature #1: d=example.com s=cf-bounce a=rsa-sha256 (aligned with From)",
		);
		expect(lines).toContain("  h=from:list-unsubscribe");
		expect(lines).toContain("  list-unsubscribe-post: NOT signed (present 1, listed 0)");
		expect(lines.at(-1)).toMatch(/^FAIL/);
	});
});
