/**
 * Tests for the Location class covering construction, getters and setters,
 * string and JSON serialization, and the `from`/`canParse` statics.
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { Location } from "./index.js";

describe("Location", () => {
	describe("constructor", () => {
		test("creates location with pathname only", () => {
			let location = new Location({ pathname: "/users" });

			expect(location.pathname).toBe("/users");
			expect(location.search).toBe("");
			expect(location.searchParams.toString()).toBe("");
			expect(location.hash).toBe("");
			expect(location.toString()).toBe("/users");
		});

		test("creates location with search string", () => {
			let location = new Location({
				pathname: "/search",
				search: "q=test&page=1",
			});

			expect(location.pathname).toBe("/search");
			expect(location.searchParams.get("q")).toBe("test");
			expect(location.searchParams.get("page")).toBe("1");
			expect(location.search).toBe("?q=test&page=1");
			expect(location.toString()).toBe("/search?q=test&page=1");
		});

		test("creates location with URLSearchParams", () => {
			let params = new URLSearchParams({ q: "test", page: "1" });
			let location = new Location({
				pathname: "/search",
				search: params,
			});

			expect(location.searchParams.get("q")).toBe("test");
			expect(location.searchParams.get("page")).toBe("1");
		});

		test("creates location with hash", () => {
			let location = new Location({
				pathname: "/docs",
				hash: "section-1",
			});

			expect(location.hash).toBe("section-1");
			expect(location.toString()).toBe("/docs#section-1");
		});

		test("creates complete location", () => {
			let location = new Location({
				pathname: "/users/123",
				search: "tab=profile",
				hash: "details",
			});

			expect(location.toString()).toBe("/users/123?tab=profile#details");
		});

		test("clones existing Location", () => {
			let original = new Location({
				pathname: "/users",
				search: "page=1",
				hash: "top",
			});
			let clone = new Location(original);

			expect(clone.toString()).toBe(original.toString());
			expect(clone).not.toBe(original);
			expect(clone.searchParams).not.toBe(original.searchParams);
		});

		test("creates from URL object", () => {
			let url = new URL("https://example.com/users?page=1#top");
			let location = new Location(url);

			expect(location.pathname).toBe("/users");
			expect(location.searchParams.get("page")).toBe("1");
			expect(location.search).toBe("?page=1");
			expect(location.hash).toBe("top");
			expect(location.toString()).toBe("/users?page=1#top");
		});
	});

	describe("getters and setters", () => {
		test("updates pathname", () => {
			let location = new Location({ pathname: "/old" });
			location.pathname = "/new";

			expect(location.pathname).toBe("/new");
			expect(location.toString()).toBe("/new");
		});

		test("updates search params", () => {
			let location = new Location({ pathname: "/search" });
			location.searchParams.set("q", "test");
			location.searchParams.set("page", "2");

			expect(location.toString()).toBe("/search?q=test&page=2");
		});

		test("replaces search entirely", () => {
			let location = new Location({
				pathname: "/search",
				search: "old=value",
			});
			location.search = "new=value";

			expect(location.toString()).toBe("/search?new=value");
		});

		test("updates hash", () => {
			let location = new Location({ pathname: "/docs" });
			location.hash = "section-2";

			expect(location.hash).toBe("section-2");
			expect(location.toString()).toBe("/docs#section-2");
		});

		test("strips a leading # from an assigned hash", () => {
			let prefixed = new Location({ pathname: "/docs" });
			let bare = new Location({ pathname: "/docs" });
			prefixed.hash = "#x";
			bare.hash = "x";

			expect(prefixed.hash).toBe("x");
			expect(prefixed.toString()).toBe("/docs#x");
			expect(bare.hash).toBe("x");
			expect(bare.toString()).toBe(prefixed.toString());
		});

		test("clears hash when set to empty string", () => {
			let location = new Location({
				pathname: "/docs",
				hash: "section-1",
			});
			location.hash = "";

			expect(location.hash).toBe("");
			expect(location.toString()).toBe("/docs");
		});
	});

	describe("toString", () => {
		test("returns pathname only when no search or hash", () => {
			let location = new Location({ pathname: "/users" });
			expect(location.toString()).toBe("/users");
		});

		test("includes search params when present", () => {
			let location = new Location({
				pathname: "/search",
				search: "q=test",
			});
			expect(location.toString()).toBe("/search?q=test");
		});

		test("includes hash when present", () => {
			let location = new Location({
				pathname: "/docs",
				hash: "intro",
			});
			expect(location.toString()).toBe("/docs#intro");
		});

		test("includes both search and hash", () => {
			let location = new Location({
				pathname: "/users",
				search: "page=1",
				hash: "user-42",
			});
			expect(location.toString()).toBe("/users?page=1#user-42");
		});

		test("handles empty search params correctly", () => {
			let location = new Location({ pathname: "/users" });
			location.searchParams.set("key", "");

			expect(location.toString()).toBe("/users?key=");
		});
	});

	describe("toJSON", () => {
		test("returns same as toString", () => {
			let location = new Location({
				pathname: "/users",
				search: "page=1",
				hash: "top",
			});

			expect(location.toJSON()).toBe(location.toString());
			expect(location.toJSON()).toBe("/users?page=1#top");
		});

		test("serializes correctly in JSON.stringify", () => {
			let location = new Location({
				pathname: "/api/users",
				search: "limit=10",
			});

			expect(JSON.stringify({ location })).toBe('{"location":"/api/users?limit=10"}');
		});
	});

	describe("Location.from", () => {
		test("creates from full URL string", () => {
			let location = Location.from("https://example.com/users?page=1#top");

			expect(location?.pathname).toBe("/users");
			expect(location?.searchParams.get("page")).toBe("1");
			expect(location?.search).toBe("?page=1");
			expect(location?.hash).toBe("top");
			expect(location?.toString()).toBe("/users?page=1#top");
		});

		test("creates from path string", () => {
			let location = Location.from("/users?page=1#top");

			expect(location?.pathname).toBe("/users");
			expect(location?.searchParams.get("page")).toBe("1");
			expect(location?.search).toBe("?page=1");
			expect(location?.hash).toBe("top");
			expect(location?.toString()).toBe("/users?page=1#top");
		});

		test("creates from URL object", () => {
			let url = new URL("https://example.com/users?page=1#top");
			let location = Location.from(url);

			expect(location?.pathname).toBe("/users");
			expect(location?.searchParams.get("page")).toBe("1");
			expect(location?.search).toBe("?page=1");
			expect(location?.hash).toBe("top");
			expect(location?.toString()).toBe("/users?page=1#top");
		});

		test("clones existing Location", () => {
			let original = new Location({
				pathname: "/users",
				search: "page=1",
				hash: "top",
			});
			let clone = Location.from(original);

			expect(clone?.toString()).toBe(original.toString());
			expect(clone).not.toBe(original);
		});

		test("throws TypeError for invalid input", () => {
			// @ts-expect-error Testing runtime behavior with invalid input
			expect(() => Location.from(123)).toThrow(TypeError);
			// @ts-expect-error Testing runtime behavior with invalid input
			expect(() => Location.from(null)).toThrow(TypeError);
			// @ts-expect-error Testing runtime behavior with invalid input
			expect(() => Location.from({})).toThrow(TypeError);
		});
	});

	describe("Location.safe", () => {
		let fallback = "/home";

		test.each([
			["//evil.com"],
			["/\\/evil.com"],
			["/\\evil.com"],
			["\\\\evil.com"],
			["\\/evil.com"],
			["https://evil.com/x"],
			["HtTpS://evil.com"],
			["javascript:alert(1)"],
			["data:text/html,<script>1</script>"],
			["ok"],
			[""],
			[" //evil.com"],
			["/\tevil"],
			["/\nevil"],
			["\t//evil.com"],
			["/..//evil.com"],
			["/a/../..//evil.com"],
			["//app.example.com/foo"],
		])("replaces unsafe target %j with the fallback", (input) => {
			expect(Location.safe(input, { fallback }).toString()).toBe("/home");
			expect(Location.isSafe(input)).toBe(false);
		});

		test.each([[null], [undefined]])("replaces %j with the fallback", (input) => {
			expect(Location.safe(input, { fallback }).toString()).toBe("/home");
			expect(Location.isSafe(input)).toBe(false);
		});

		test.each([
			["/ok", "/ok"],
			["/ok?a=1", "/ok?a=1"],
			["/ok?a=1#h", "/ok?a=1#h"],
			["/a/b/c", "/a/b/c"],
			["/", "/"],
			["/ok/../other", "/other"],
			["/%2F%2Fevil.com", "/%2F%2Fevil.com"],
		])("preserves safe target %j as %j", (input, expected) => {
			expect(Location.safe(input, { fallback }).toString()).toBe(expected);
			expect(Location.isSafe(input)).toBe(true);
		});

		test("keeps percent-encoded slashes encoded", () => {
			let location = Location.safe("/%2F%2Fevil.com", { fallback });

			expect(location.pathname).toBe("/%2F%2Fevil.com");
			expect(new URL(location.toString(), "https://example.com").origin).toBe(
				"https://example.com",
			);
		});

		test("returns a Location for every input", () => {
			expect(Location.safe("//evil.com", { fallback })).toBeInstanceOf(Location);
			expect(Location.safe("/ok", { fallback })).toBeInstanceOf(Location);
		});

		test("rejects an absolute URL when no origin is configured", () => {
			expect(Location.safe("https://app.example.com/foo", { fallback }).toString()).toBe("/home");
		});

		test("reduces an absolute URL on the configured origin to a path", () => {
			let options = { fallback, origin: "https://app.example.com" };

			expect(Location.safe("https://app.example.com/foo", options).toString()).toBe("/foo");
			expect(Location.safe("https://app.example.com/foo?a=1#h", options).toString()).toBe(
				"/foo?a=1#h",
			);
			expect(Location.isSafe("https://app.example.com/foo", options)).toBe(true);
		});

		test("rejects an absolute URL on another origin than the configured one", () => {
			let options = { fallback, origin: "https://app.example.com" };

			expect(Location.safe("https://evil.com/foo", options).toString()).toBe("/home");
			expect(Location.safe("//evil.com", options).toString()).toBe("/home");
			expect(Location.safe("https://app.example.com.evil.com/foo", options).toString()).toBe(
				"/home",
			);
			expect(Location.safe("http://app.example.com/foo", options).toString()).toBe("/home");
		});

		test("accepts the configured origin as a URL", () => {
			let options = { fallback, origin: new URL("https://app.example.com/ignored") };

			expect(Location.safe("https://app.example.com/foo", options).toString()).toBe("/foo");
		});

		test("stays strict when the configured origin cannot be parsed", () => {
			let options = { fallback, origin: "app.example.com" };

			expect(Location.safe("https://app.example.com/foo", options).toString()).toBe("/home");
		});

		test("rejects a same-origin URL whose path is protocol-relative", () => {
			let options = { fallback, origin: "https://app.example.com" };

			expect(Location.safe("https://app.example.com//evil.com", options).toString()).toBe("/home");
			expect(Location.safe("https://app.example.com/\\evil.com", options).toString()).toBe("/home");
		});

		test("validates a URL input against the configured origin", () => {
			let target = new URL("https://app.example.com/foo?a=1");

			expect(Location.safe(target, { fallback }).toString()).toBe("/home");
			expect(
				Location.safe(target, { fallback, origin: "https://app.example.com" }).toString(),
			).toBe("/foo?a=1");
		});

		test("validates a Location input, which carries no origin", () => {
			expect(Location.safe(new Location({ pathname: "/ok" }), { fallback }).toString()).toBe("/ok");
			expect(Location.safe(new Location({ pathname: "//evil.com" }), { fallback }).toString()).toBe(
				"/home",
			);
		});

		test("accepts a URL or Location as the fallback", () => {
			expect(
				Location.safe("//evil.com", { fallback: new URL("https://x.com/a?b=1") }).toString(),
			).toBe("/a?b=1");
			expect(
				Location.safe("//evil.com", { fallback: new Location({ pathname: "/a" }) }).toString(),
			).toBe("/a");
		});

		test("degrades an off-origin fallback to the root", () => {
			expect(Location.safe("//evil.com", { fallback: "//evil.com" }).toString()).toBe("/");
		});

		test("never yields a target that resolves off our origin", () => {
			let inputs = [
				"//evil.com",
				"/\\evil.com",
				"/..//evil.com",
				"https://evil.com/x",
				"javascript:alert(1)",
				" //evil.com",
				"/ok",
				"/%2F%2Fevil.com",
			];

			for (let input of inputs) {
				let target = Location.safe(input, { fallback }).toString();
				expect(new URL(target, "https://example.com").origin).toBe("https://example.com");
			}
		});
	});

	describe("Location.isSafe", () => {
		test("returns false for values that are not URL-like", () => {
			expect(Location.isSafe(123)).toBe(false);
			expect(Location.isSafe({})).toBe(false);
			expect(Location.isSafe([])).toBe(false);
			expect(Location.isSafe(null)).toBe(false);
		});
	});

	describe("Location.canParse", () => {
		test("returns true for URL object", () => {
			let url = new URL("https://example.com");
			expect(Location.canParse(url)).toBe(true);
		});

		test("returns true for Location object", () => {
			let location = new Location({ pathname: "/users" });
			expect(Location.canParse(location)).toBe(true);
		});

		test("returns true for valid URL string", () => {
			expect(Location.canParse("https://example.com/users")).toBe(true);
		});

		test("returns true for path string", () => {
			expect(Location.canParse("/users")).toBe(true);
			expect(Location.canParse("/users?page=1")).toBe(true);
			expect(Location.canParse("/users#top")).toBe(true);
		});

		test("returns false for invalid input", () => {
			expect(Location.canParse(null)).toBe(false);
			expect(Location.canParse(undefined)).toBe(false);
			expect(Location.canParse({})).toBe(false);
			expect(Location.canParse(123)).toBe(false);
			expect(Location.canParse([])).toBe(false);
		});
	});
});
