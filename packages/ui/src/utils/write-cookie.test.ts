/**
 * Unit tests for {@link "./write-cookie"}: every assertion checks the exact
 * cookie string {@link writeCookie} writes. Bun's test runtime carries no
 * `document`, so each test stands a plain object with a `cookie`
 * getter/setter in its place, matching the single property {@link
 * writeCookie} ever touches, and clears it once the test finishes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "bun:test";

import { ONE_YEAR_SECONDS, writeCookie } from "./write-cookie";

/**
 * Stands a minimal `document` in for the test's duration, exposing a
 * `cookie` property that records the last string assigned to it, and
 * returns a reader for that string.
 */
function stubDocumentCookie(): () => string {
	let written = "";

	Object.defineProperty(globalThis, "document", {
		configurable: true,
		value: {
			get cookie() {
				return written;
			},
			set cookie(next: string) {
				written = next;
			},
		},
	});

	return () => written;
}

describe(writeCookie.name, () => {
	afterEach(() => {
		delete (globalThis as { document?: unknown }).document;
	});

	test("writes name=value with path=/, max-age, and samesite=lax", () => {
		let readCookie = stubDocumentCookie();

		writeCookie("ui:theme", "dark");

		expect(readCookie()).toBe(`ui:theme=dark; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`);
	});

	test("interpolates a boolean value the same way a template literal would", () => {
		let readCookie = stubDocumentCookie();

		writeCookie("app-sidebar:collapsed", true);

		expect(readCookie()).toBe(
			`app-sidebar:collapsed=true; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`,
		);
	});

	test("defaults max-age to ONE_YEAR_SECONDS when the call omits it", () => {
		let readCookie = stubDocumentCookie();

		writeCookie("ui:announcement-dismissed", false);

		expect(readCookie()).toContain(`max-age=${ONE_YEAR_SECONDS}`);
	});

	test("honors a maxAgeSeconds override in place of the default", () => {
		let readCookie = stubDocumentCookie();

		writeCookie("ui:announcement-dismissed", true, 60 * 60 * 24 * 7);

		expect(readCookie()).toBe(
			`ui:announcement-dismissed=true; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`,
		);
	});
});
