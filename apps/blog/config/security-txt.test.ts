/**
 * Holds the site's security.txt to its annual review: the expiry test starts failing 30
 * days before `Expires`, so the contact is looked at before the file goes stale. The
 * served file is checked through the router in `bootstrap/app.workers.test.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { SECURITY_TXT } from "./security-txt";

/** How far ahead of `Expires` the file must be renewed. */
const RENEWAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

describe("SECURITY_TXT", () => {
	test("expires more than 30 days from now, so the contact is reviewed before it goes stale", () => {
		expect(SECURITY_TXT.expires.getTime() - Date.now()).toBeGreaterThan(RENEWAL_WINDOW_MS);
	});

	test("names the security inbox as the contact", () => {
		expect(SECURITY_TXT.contact.map(String)).toEqual(["mailto:hello+security@sergiodxa.com"]);
	});

	test("names the apex domain's file as canonical", () => {
		expect(SECURITY_TXT.canonical.map(String)).toEqual([
			"https://sergiodxa.com/.well-known/security.txt",
		]);
	});
});
