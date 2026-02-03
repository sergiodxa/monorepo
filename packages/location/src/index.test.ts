import { describe, expect, test } from "bun:test";
import { Location } from "./index";

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
			expect(location?.hash).toBe("#top");
		});

		test("creates from path string", () => {
			let location = Location.from("/users?page=1#top");

			expect(location?.pathname).toBe("/users");
			expect(location?.searchParams.get("page")).toBe("1");
			expect(location?.search).toBe("?page=1");
			expect(location?.hash).toBe("#top");
		});

		test("creates from URL object", () => {
			let url = new URL("https://example.com/users?page=1#top");
			let location = Location.from(url);

			expect(location?.pathname).toBe("/users");
			expect(location?.searchParams.get("page")).toBe("1");
			expect(location?.search).toBe("?page=1");
			expect(location?.hash).toBe("#top");
		});

		test("clones existing Location", () => {
			let original = new Location({
				pathname: "/users",
				search: "page=1",
				hash: "top",
			});
			let clone = Location.from(original);

			expect(clone?.toString()).toBe(original.toString());
			expect(clone).not.toBe(original); // Different instances
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
