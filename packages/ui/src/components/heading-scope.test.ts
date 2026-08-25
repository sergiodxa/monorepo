/**
 * Unit tests for {@link resolveHeadingLevel} and {@link readAmbientLevel}:
 * pure logic exercised against a minimal `Handle` fixture, with no DOM and
 * no rendered component.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { HeadingLevel } from "./heading-scope";

import { readAmbientLevel, resolveHeadingLevel } from "./heading-scope";

/**
 * Minimal `Handle` fixture exposing only `context.get`, matching how this
 * package already unit-tests pure logic without a DOM or a rendered
 * component tree (see `src/behaviors/*.test.ts`).
 */
function stubHandle(get: () => unknown): Handle<unknown> {
	return { context: { set: () => {}, get } } as unknown as Handle<unknown>;
}

function ambientHandle(level: HeadingLevel): Handle<unknown> {
	return stubHandle(() => ({ level }));
}

function unscopedHandle(): Handle<unknown> {
	return stubHandle(() => undefined);
}

/** Fixture whose `context.get` always throws, simulating a broken lookup. */
function throwingHandle(): Handle<unknown> {
	return stubHandle(() => {
		throw new Error("lookup failed");
	});
}

describe(resolveHeadingLevel.name, () => {
	test("an explicit level always wins, regardless of the ambient value", () => {
		let handle = ambientHandle(5);

		expect(resolveHeadingLevel(handle, 2)).toBe(2);
	});

	test("resolves to 1 when there is no explicit level and no ambient scope", () => {
		let handle = unscopedHandle();

		expect(resolveHeadingLevel(handle, undefined)).toBe(1);
	});

	test("falls back to the ambient level when there is no explicit level", () => {
		let handle = ambientHandle(4);

		expect(resolveHeadingLevel(handle, undefined)).toBe(4);
	});

	test("clamps a resolution past 6 down to 6", () => {
		let handle = ambientHandle(6);

		expect(resolveHeadingLevel(handle, 9 as unknown as HeadingLevel)).toBe(6);
	});

	describe("dev-only warning", () => {
		let originalDev: string | undefined;
		let warnSpy: ReturnType<typeof vi.spyOn>;

		beforeEach(() => {
			originalDev = process.env.DEV;
			warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		});

		afterEach(() => {
			warnSpy.mockRestore();
			if (originalDev === undefined) delete process.env.DEV;
			else process.env.DEV = originalDev;
		});

		test("logs once when a resolution clamps past 6 in dev mode", () => {
			process.env.DEV = "1";
			let handle = unscopedHandle();

			resolveHeadingLevel(handle, 7 as unknown as HeadingLevel);

			expect(warnSpy).toHaveBeenCalledTimes(1);
			expect(String(warnSpy.mock.calls[0]?.[0])).toContain("h1");
		});

		test("stays silent when a resolution clamps past 6 outside dev mode", () => {
			delete process.env.DEV;
			let handle = unscopedHandle();

			resolveHeadingLevel(handle, 7 as unknown as HeadingLevel);

			expect(warnSpy).not.toHaveBeenCalled();
		});

		test("stays silent when a resolution never exceeds 6", () => {
			process.env.DEV = "1";
			let handle = ambientHandle(3);

			resolveHeadingLevel(handle, undefined);

			expect(warnSpy).not.toHaveBeenCalled();
		});
	});
});

describe(readAmbientLevel.name, () => {
	test("returns the ambient level when context.get resolves to a scope value", () => {
		let handle = ambientHandle(3);

		expect(readAmbientLevel(handle)).toBe(3);
	});

	test("returns undefined when context.get resolves to undefined", () => {
		let handle = unscopedHandle();

		expect(readAmbientLevel(handle)).toBeUndefined();
	});

	test("returns undefined, instead of throwing, when context.get throws", () => {
		let handle = throwingHandle();

		expect(() => readAmbientLevel(handle)).not.toThrow();
		expect(readAmbientLevel(handle)).toBeUndefined();
	});
});
