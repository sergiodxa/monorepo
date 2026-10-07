/**
 * Pins the rule every hop of a login's return path applies: a path on this site, query
 * included, survives each hop, while anything a browser would read as another host, a
 * scheme, or a control character falls back to the default destination.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import routes from "~/routes/web";

import { loginFor, parseReturnPath, requestedReturnPath } from "./return-path";

/** The origin the blog answers on. */
const APP_ORIGIN = "https://blog.test";

/** The page the share sheet opens, carrying the shared URL the way the query encodes it. */
const SHARED_PAGE = "/cms/bookmarks/new?url=https%3A%2F%2Fexample.com%2Fpost%3Fid%3D7";

/** Destinations a browser would follow off this site, or that hide what they name. */
const UNSAFE_DESTINATIONS = [
	"https://evil.com",
	"//evil.com",
	"/\\evil.com",
	"/\\/evil.com",
	"/..//evil.com",
	"javascript:alert(1)",
	"cms/articles",
	"",
	"/cms\nSet-Cookie: a=b",
	"/\t/evil.com",
	"/cms\u0085",
	"/cms articles",
];

/** A login URL whose query carries `next` exactly as given. */
function loginURL(next: string): URL {
	let url = new URL(routes.auth.login.index.href(), APP_ORIGIN);
	url.searchParams.set("next", next);
	return url;
}

describe("parseReturnPath", () => {
	test("keeps a path on this site with its query", () => {
		expect(parseReturnPath(SHARED_PAGE)).toBe(SHARED_PAGE);
		expect(parseReturnPath(routes.cms.dashboard.href())).toBe(routes.cms.dashboard.href());
	});

	test("reads a shared URL left unencoded in the query as the same query", () => {
		expect(parseReturnPath("/cms/bookmarks/new?url=https://example.com/post?id=7")).toBe(
			SHARED_PAGE,
		);
	});

	test("resolves dot segments, so the redirect names the path that was checked", () => {
		expect(parseReturnPath("/cms/articles/../bookmarks")).toBe("/cms/bookmarks");
	});

	test.each(UNSAFE_DESTINATIONS)("refuses %j", (destination) => {
		expect(parseReturnPath(destination)).toBeNull();
	});

	test("refuses a value that is no string", () => {
		expect(parseReturnPath(null)).toBeNull();
		expect(parseReturnPath(undefined)).toBeNull();
		expect(parseReturnPath(42)).toBeNull();
		expect(parseReturnPath(new URL("https://evil.com"))).toBeNull();
	});
});

describe("requestedReturnPath", () => {
	test("reads the page the login URL's `next` names", async () => {
		expect(await requestedReturnPath(loginURL(SHARED_PAGE))).toBe(SHARED_PAGE);
	});

	test("answers null for a login URL naming no page", async () => {
		expect(await requestedReturnPath(new URL(routes.auth.login.index.href(), APP_ORIGIN))).toBe(
			null,
		);
	});

	test.each(UNSAFE_DESTINATIONS)("answers null for `next` set to %j", async (destination) => {
		expect(await requestedReturnPath(loginURL(destination))).toBeNull();
	});

	test("answers null for a login URL naming two pages", async () => {
		let url = loginURL(SHARED_PAGE);
		url.searchParams.append("next", routes.cms.dashboard.href());

		expect(await requestedReturnPath(url)).toBeNull();
	});
});

describe("loginFor", () => {
	test("carries a page view's path and query as `next`", () => {
		let login = new URL(
			loginFor({
				method: "GET",
				url: new URL("/cms/bookmarks/new?url=https://example.com/post?id=7", APP_ORIGIN),
			}),
			APP_ORIGIN,
		);

		expect(login.pathname).toBe(routes.auth.login.index.href());
		expect(login.searchParams.get("next")).toBe(SHARED_PAGE);
	});

	test("sends a request for an action to the login page alone", () => {
		let login = loginFor({ method: "POST", url: new URL("/cms/cache/purge", APP_ORIGIN) });

		expect(login).toBe(routes.auth.login.index.href());
	});
});
