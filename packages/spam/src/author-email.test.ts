/**
 * Tests the author-email rule against the bundled disposable-domain list, including the
 * subdomain match and the addresses it leaves to the form's own validation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import type { Signal } from "./check.js";

import { authorEmail } from "./author-email.js";

/** The signals the rule answers for an author email. */
function signalsFor(email: string | undefined): Signal[] {
	let answer = authorEmail().check(
		{ content: "hi", author: { email } },
		{ signal: new AbortController().signal, score: 0, signals: [] },
	);
	return answer as Signal[];
}

test("scores a disposable domain and its subdomains", () => {
	expect(signalsFor("bot@mailinator.com")).toEqual([
		{
			check: "author-email.disposable",
			score: 3,
			detail: "mailinator.com is a disposable email domain",
		},
	]);
	expect(signalsFor("bot@x.mailinator.com")[0]?.check).toBe("author-email.disposable");
});

test("leaves an ordinary domain alone", () => {
	expect(signalsFor("dana@example.com")).toEqual([]);
});

test("leaves a missing or unparseable address to the form", () => {
	expect(signalsFor(undefined)).toEqual([]);
	expect(signalsFor("not an address")).toEqual([]);
});
