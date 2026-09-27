/**
 * Holds the platform's security.txt to its annual review: the expiry test starts failing
 * 30 days before `Expires`, and the served file parses back with the requesting host as
 * its `Canonical`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { wellKnown } from "@sdxc/well-known/middleware";
import { parse } from "@sdxc/well-known/security-txt";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { SECURITY_TXT, securityTxtEntry } from "./security-txt";

/** How far ahead of `Expires` the file must be renewed. */
const RENEWAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

describe("SECURITY_TXT", () => {
	test("expires more than 30 days from now, so the contact is reviewed before it goes stale", () => {
		expect(SECURITY_TXT.expires.getTime() - Date.now()).toBeGreaterThan(RENEWAL_WINDOW_MS);
	});

	test("names the security inbox as the contact", () => {
		expect(SECURITY_TXT.contact.map(String)).toEqual(["mailto:hello+security@sergiodxa.com"]);
	});
});

describe("GET /.well-known/security.txt", () => {
	test("serves the file with the requesting host as its Canonical", async () => {
		let router = createRouter({ middleware: [wellKnown({ "security.txt": securityTxtEntry })] });

		let response = await router.fetch("https://tenant.example.com/.well-known/security.txt");

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");

		let parsed = parse(await response.text());
		if (isFailure(parsed)) throw parsed.error;
		expect(parsed.data.contact.map(String)).toEqual(SECURITY_TXT.contact.map(String));
		expect(parsed.data.canonical.map(String)).toEqual([
			"https://tenant.example.com/.well-known/security.txt",
		]);
	});
});
