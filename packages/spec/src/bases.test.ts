/**
 * Tests for the run's address book: how a relative target resolves against a
 * named base, how `on "…"` selects among several, and what a failure tells a
 * spec that guessed wrong.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { createBaseSet, createConnectionSet } from "./bases.js";

/** The URL a resolution produced, or the failure message that explains why not. */
function resolved(set: ReturnType<typeof createBaseSet>, target: string, name?: string): string {
	let result = set.resolve(target, name);
	return isFailure(result) ? result.error.message : result.data.href;
}

describe(createBaseSet, () => {
	test("resolves a relative target against the only configured base", () => {
		let set = createBaseSet([{ name: "web", url: "http://localhost:4000" }]);

		expect(resolved(set, "/portfolios")).toBe("http://localhost:4000/portfolios");
	});

	test("keeps the base's own path prefix ahead of the target", () => {
		let set = createBaseSet([{ name: "web", url: "http://localhost:4000/app/" }]);

		expect(resolved(set, "/charities")).toBe("http://localhost:4000/app/charities");
	});

	test("takes a target with a scheme as written, ignoring every base", () => {
		let set = createBaseSet([{ name: "web", url: "http://localhost:4000" }]);

		expect(resolved(set, "https://example.com/health")).toBe("https://example.com/health");
	});

	test("selects among several bases by name", () => {
		let set = createBaseSet([
			{ name: "web", url: "http://localhost:4000" },
			{ name: "work", url: "http://localhost:4020" },
		]);

		expect(resolved(set, "/dashboard", "work")).toBe("http://localhost:4020/dashboard");
	});

	test("refuses an unqualified target when several bases are configured", () => {
		let set = createBaseSet([
			{ name: "web", url: "http://localhost:4000" },
			{ name: "work", url: "http://localhost:4020" },
		]);

		let message = resolved(set, "/dashboard");

		expect(message).toContain('on "web"');
		expect(message).toContain('"work"');
	});

	test("names the configured bases when the selected one does not exist", () => {
		let set = createBaseSet([{ name: "web", url: "http://localhost:4000" }]);

		expect(resolved(set, "/dashboard", "work")).toContain('"web"');
	});

	test("a target that is neither absolute nor rooted suggests the leading slash", () => {
		let set = createBaseSet([{ name: "web", url: "http://localhost:4000" }]);

		expect(resolved(set, "portfolios")).toContain('"/portfolios"');
	});

	test("a relative target with no base configured says so", () => {
		let set = createBaseSet([]);

		expect(resolved(set, "/portfolios")).toContain("spec/config.jsonc");
	});

	test("lists every configured base in config order, for the run header", () => {
		let set = createBaseSet([
			{ name: "web", url: "http://localhost:4000" },
			{ name: "work", url: "http://localhost:4020" },
		]);

		expect(set.list().map((base) => base.name)).toEqual(["web", "work"]);
	});
});

describe(createConnectionSet, () => {
	test("selects the only configured connection when a query names none", () => {
		let set = createConnectionSet([{ name: "web", url: "postgres://localhost/web" }]);
		let result = set.resolve();

		expect(isFailure(result)).toBe(false);
		if (isFailure(result)) throw new Error("narrowing");
		expect(result.data.url).toBe("postgres://localhost/web");
	});

	test("refuses to guess between several, naming them", () => {
		let set = createConnectionSet([
			{ name: "web", url: "postgres://localhost/web" },
			{ name: "backend", url: "postgres://localhost/backend" },
		]);
		let result = set.resolve();

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) throw new Error("narrowing");
		expect(result.error.message).toContain('"backend"');
	});
});
