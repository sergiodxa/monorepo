/**
 * Test suite for the locale-resource API route. Pins the exact `Cache-Control`
 * value the route ships in production, since CDN and browser copies of the
 * translation catalogs are keyed on it, and covers the language/namespace
 * validation that decides between a catalog and a 400.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "bun:test";

import { RouterContextProvider } from "react-router";

import type { Route } from "./+types/route";

import { loader } from "./route";

/**
 * The serialized policy this route emitted before it moved to `@pkg/http/cache`.
 * Copies of it are already stored in CDN and browser caches, so the migration is
 * only safe while the bytes stay exactly these.
 */
const EXPECTED_CACHE_CONTROL =
	"max-age=300, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=604800";

/** Node environment the suite runs under, restored after cases that force production. */
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

/**
 * Builds loader arguments for a language/namespace pair, with the request and
 * context the route never reads but the signature requires.
 */
function loaderArgs(lng: string, ns: string): Route.LoaderArgs {
	let url = new URL(`https://auth.sergiodxa.com/api/locales/${lng}/${ns}`);

	return {
		request: new Request(url),
		url,
		pattern: "/api/locales/:lng/:ns",
		params: { lng, ns },
		context: new RouterContextProvider(),
	};
}

afterEach(() => {
	process.env.NODE_ENV = ORIGINAL_NODE_ENV;
});

describe("loader", () => {
	test("emits the exact production Cache-Control value", async () => {
		process.env.NODE_ENV = "production";

		let result = await loader(loaderArgs("en", "translation"));
		let headers = new Headers(result.init?.headers);

		expect(headers.get("Cache-Control")).toBe(EXPECTED_CACHE_CONTROL);
	});

	test("omits Cache-Control outside production", async () => {
		process.env.NODE_ENV = "development";

		let result = await loader(loaderArgs("en", "translation"));
		let headers = new Headers(result.init?.headers);

		expect(headers.get("Cache-Control")).toBeNull();
	});

	test("returns the requested namespace resources", async () => {
		let result = await loader(loaderArgs("en", "translation"));

		expect(result.data).toBeDefined();
	});

	test("rejects an unknown language with a 400", async () => {
		let result = await loader(loaderArgs("xx", "translation"));

		expect(result.init?.status).toBe(400);
	});

	test("rejects an unknown namespace with a 400", async () => {
		let result = await loader(loaderArgs("en", "unknown"));

		expect(result.init?.status).toBe(400);
	});
});
