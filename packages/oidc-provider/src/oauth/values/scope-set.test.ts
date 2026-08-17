import { describe, expect, test } from "vitest";

import ScopeSet from "./scope-set";

describe(ScopeSet.name, () => {
	describe("constructor", () => {
		test("creates empty set by default", () => {
			let set = new ScopeSet();
			expect(set.isEmpty()).toBe(true);
			expect(set.size).toBe(0);
		});

		test("creates set from array", () => {
			let set = new ScopeSet(["openid", "profile", "email"]);
			expect(set.size).toBe(3);
			expect(set.has("openid")).toBe(true);
			expect(set.has("profile")).toBe(true);
			expect(set.has("email")).toBe(true);
		});

		test("deduplicates scopes", () => {
			let set = new ScopeSet(["openid", "openid", "profile"]);
			expect(set.size).toBe(2);
		});
	});

	describe("fromString", () => {
		test("parses space-separated string", () => {
			let set = ScopeSet.fromString("openid profile email");
			expect(set.size).toBe(3);
			expect(set.has("openid")).toBe(true);
			expect(set.has("profile")).toBe(true);
			expect(set.has("email")).toBe(true);
		});

		test("handles empty string", () => {
			let set = ScopeSet.fromString("");
			expect(set.isEmpty()).toBe(true);
		});

		test("handles null", () => {
			let set = ScopeSet.fromString(null);
			expect(set.isEmpty()).toBe(true);
		});

		test("handles undefined", () => {
			let set = ScopeSet.fromString(undefined);
			expect(set.isEmpty()).toBe(true);
		});

		test("filters empty strings from multiple spaces", () => {
			let set = ScopeSet.fromString("openid  profile");
			expect(set.size).toBe(2);
		});
	});

	describe("fromJson", () => {
		test("parses JSON array", () => {
			let set = ScopeSet.fromJson('["openid", "profile"]');
			expect(set.size).toBe(2);
			expect(set.has("openid")).toBe(true);
			expect(set.has("profile")).toBe(true);
		});

		test("handles null", () => {
			let set = ScopeSet.fromJson(null);
			expect(set.isEmpty()).toBe(true);
		});

		test("handles undefined", () => {
			let set = ScopeSet.fromJson(undefined);
			expect(set.isEmpty()).toBe(true);
		});

		test("handles invalid JSON", () => {
			let set = ScopeSet.fromJson("not valid json");
			expect(set.isEmpty()).toBe(true);
		});

		test("handles non-array JSON", () => {
			let set = ScopeSet.fromJson('{"key": "value"}');
			expect(set.isEmpty()).toBe(true);
		});

		test("handles array with non-strings", () => {
			let set = ScopeSet.fromJson("[1, 2, 3]");
			expect(set.isEmpty()).toBe(true);
		});
	});

	describe("toString", () => {
		test("serializes to space-separated string", () => {
			let set = new ScopeSet(["openid", "profile", "email"]);
			let str = set.toString();
			expect(str.split(" ")).toContain("openid");
			expect(str.split(" ")).toContain("profile");
			expect(str.split(" ")).toContain("email");
		});

		test("returns empty string for empty set", () => {
			let set = new ScopeSet();
			expect(set.toString()).toBe("");
		});
	});

	describe("toJson", () => {
		test("serializes to JSON array", () => {
			let set = new ScopeSet(["openid", "profile"]);
			let json = set.toJson();
			let parsed = JSON.parse(json);
			expect(parsed).toContain("openid");
			expect(parsed).toContain("profile");
		});

		test("returns empty array for empty set", () => {
			let set = new ScopeSet();
			expect(set.toJson()).toBe("[]");
		});
	});

	describe("toArray", () => {
		test("returns array of scopes", () => {
			let set = new ScopeSet(["openid", "profile"]);
			let arr = set.toArray();
			expect(arr).toContain("openid");
			expect(arr).toContain("profile");
		});
	});

	describe("has", () => {
		test("returns true for existing scope", () => {
			let set = new ScopeSet(["openid"]);
			expect(set.has("openid")).toBe(true);
		});

		test("returns false for missing scope", () => {
			let set = new ScopeSet(["openid"]);
			expect(set.has("profile")).toBe(false);
		});
	});

	describe("isEmpty", () => {
		test("returns true for empty set", () => {
			let set = new ScopeSet();
			expect(set.isEmpty()).toBe(true);
		});

		test("returns false for non-empty set", () => {
			let set = new ScopeSet(["openid"]);
			expect(set.isEmpty()).toBe(false);
		});
	});

	describe("getInvalidScopes", () => {
		test("returns empty array when all scopes allowed", () => {
			let requested = new ScopeSet(["openid", "profile"]);
			let allowed = new ScopeSet(["openid", "profile", "email"]);
			expect(requested.getInvalidScopes(allowed)).toEqual([]);
		});

		test("returns invalid scopes", () => {
			let requested = new ScopeSet(["openid", "admin", "delete"]);
			let allowed = new ScopeSet(["openid", "profile", "email"]);
			let invalid = requested.getInvalidScopes(allowed);
			expect(invalid).toContain("admin");
			expect(invalid).toContain("delete");
			expect(invalid).not.toContain("openid");
		});
	});

	describe("isSubsetOf", () => {
		test("returns true when all scopes allowed", () => {
			let requested = new ScopeSet(["openid"]);
			let allowed = new ScopeSet(["openid", "profile"]);
			expect(requested.isSubsetOf(allowed)).toBe(true);
		});

		test("returns false when scopes not allowed", () => {
			let requested = new ScopeSet(["openid", "admin"]);
			let allowed = new ScopeSet(["openid", "profile"]);
			expect(requested.isSubsetOf(allowed)).toBe(false);
		});
	});

	describe("intersection", () => {
		test("returns scopes present in both sets", () => {
			let a = new ScopeSet(["openid", "profile", "admin"]);
			let b = new ScopeSet(["openid", "profile", "email"]);
			let intersection = a.intersection(b);
			expect(intersection.size).toBe(2);
			expect(intersection.has("openid")).toBe(true);
			expect(intersection.has("profile")).toBe(true);
			expect(intersection.has("admin")).toBe(false);
			expect(intersection.has("email")).toBe(false);
		});
	});

	describe("iterator", () => {
		test("allows iteration with for-of", () => {
			let set = new ScopeSet(["openid", "profile"]);
			let scopes: string[] = [];
			for (let scope of set) {
				scopes.push(scope);
			}
			expect(scopes).toContain("openid");
			expect(scopes).toContain("profile");
		});

		test("allows spread operator", () => {
			let set = new ScopeSet(["openid", "profile"]);
			let arr = [...set];
			expect(arr).toContain("openid");
			expect(arr).toContain("profile");
		});
	});
});
