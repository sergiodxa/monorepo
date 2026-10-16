/**
 * Exercises fromRoutes against a route table holding every kind of route a sitemap meets:
 * static, with params, with optional groups, form pairs, nested maps and write-only routes,
 * plus the type checks that make an undecided route fail.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { form, get, post, route } from "remix/routes";
import { describe, expect, expectTypeOf, test } from "vitest";

import type { Decisions } from "./index.js";

import { fromRoutes } from "./index.js";

const ROUTES = route({
	home: get("/"),
	about: get("/about"),
	healthcheck: get("/healthcheck"),
	post: get("/:type/:slug(.:ext)"),
	contact: form("/contact"),
	webhook: post("/webhooks/github"),
	docs: route("/docs", {
		index: get("/"),
		page: get("/*path"),
	}),
	admin: route("/admin", {
		dashboard: get("/"),
		save: post("/save"),
	}),
	writes: route("/api", {
		create: post("/items"),
	}),
});

/** Every location the sitemap lists, in document order. */
function locations(sitemap: ReturnType<typeof fromRoutes>) {
	return [...sitemap.entries].map((entry) => entry.loc.href);
}

describe("fromRoutes", () => {
	test("lists the decided routes in table order against the origin", () => {
		let sitemap = fromRoutes(ROUTES, "https://example.com/sitemap.xml", {
			home: { priority: 1 },
			about: true,
			healthcheck: false,
			post: [
				{ params: { type: "articles", slug: "hello" } },
				{ params: { type: "tutorials", slug: "routing" } },
			],
			contact: { index: true },
			docs: { index: true, page: [{ params: { path: "guides/start" } }] },
			admin: false,
		});

		expect(locations(sitemap)).toEqual([
			"https://example.com/",
			"https://example.com/about",
			"https://example.com/articles/hello",
			"https://example.com/tutorials/routing",
			"https://example.com/contact",
			"https://example.com/docs",
			"https://example.com/docs/guides/start",
		]);
	});

	test("writes each page's crawler metadata", () => {
		let updatedAt = new Date("2026-10-16T00:00:00Z");
		let sitemap = fromRoutes(ROUTES, new URL("https://example.com"), {
			home: { priority: 1, frequency: "weekly" },
			about: false,
			healthcheck: false,
			post: [{ params: { type: "articles", slug: "hello" }, updatedAt }],
			contact: false,
			docs: false,
			admin: false,
		});

		expect([...sitemap.entries]).toEqual([
			{ loc: new URL("https://example.com/"), priority: 1, frequency: "weekly" },
			{ loc: new URL("https://example.com/articles/hello"), updatedAt },
		]);
	});

	test("leaves an optional group out unless its param is passed", () => {
		let sitemap = fromRoutes(ROUTES, "https://example.com", {
			home: false,
			about: false,
			healthcheck: false,
			post: [
				{ params: { type: "articles", slug: "hello" } },
				{ params: { type: "articles", slug: "hello", ext: "md" } },
			],
			contact: false,
			docs: false,
			admin: false,
		});

		expect(locations(sitemap)).toEqual([
			"https://example.com/articles/hello",
			"https://example.com/articles/hello.md",
		]);
	});

	test("lists a route with params as many times as it has pages, and none for an empty list", () => {
		let sitemap = fromRoutes(ROUTES, "https://example.com", {
			home: false,
			about: false,
			healthcheck: false,
			post: [],
			contact: false,
			docs: false,
			admin: false,
		});

		expect(sitemap.size).toBe(0);
	});

	test("requires a decision for every GET route and none for a write route", () => {
		expectTypeOf<keyof Decisions<typeof ROUTES>>().toEqualTypeOf<
			"home" | "about" | "healthcheck" | "post" | "contact" | "docs" | "admin"
		>();
		expectTypeOf<
			keyof Exclude<Decisions<typeof ROUTES>["admin"], false>
		>().toEqualTypeOf<"dashboard">();
		expectTypeOf<
			keyof Exclude<Decisions<typeof ROUTES>["contact"], false>
		>().toEqualTypeOf<"index">();
	});

	test("types a route's pages from its pattern", () => {
		/** Never called: the test is the typecheck of each call inside it. */
		function typecheck() {
			fromRoutes(ROUTES, "https://example.com", {
				home: true,
				about: true,
				healthcheck: false,
				post: [{ params: { type: "articles", slug: "hello" } }],
				contact: false,
				docs: false,
				admin: false,
			});

			// @ts-expect-error -- `about` is a GET route, so leaving it out fails
			fromRoutes(ROUTES, "https://example.com", {
				home: true,
				healthcheck: false,
				post: false,
				contact: false,
				docs: false,
				admin: false,
			});

			fromRoutes(ROUTES, "https://example.com", {
				home: true,
				about: true,
				healthcheck: false,
				// @ts-expect-error -- `slug` is a required param of `post`
				post: [{ params: { type: "articles" } }],
				contact: false,
				docs: false,
				admin: false,
			});

			fromRoutes(ROUTES, "https://example.com", {
				home: true,
				about: true,
				healthcheck: false,
				// @ts-expect-error -- a route with required params lists its pages, not one URL
				post: true,
				contact: false,
				docs: false,
				admin: false,
			});
		}

		expect(typecheck).toBeTypeOf("function");
	});
});
