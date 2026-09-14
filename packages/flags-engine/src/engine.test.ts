/**
 * Holds the engine to the three things it owns beyond the pure functions: that
 * a load either keeps a snapshot or reports why it could not, that evaluation
 * answers before one arrives, and that staleness tracks the snapshot's age.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, isSuccess, unwrap } from "@sdxc/result";
import { afterEach, expect, test, vi } from "vitest";

import type { FlagStore, StoredFlagSet } from "./store/index.js";

import { createEngine } from "./engine.js";
import { FlagStoreError } from "./store/index.js";
import { InMemoryFlagStore } from "./store/memory.js";

/** A set shaped the way a store hands one over, carrying a flag per outcome the tests read. */
const SET: StoredFlagSet = {
	flags: {
		banner: { variants: { on: true, off: false }, defaultVariant: "off" },
		regional: {
			variants: { on: true, off: false },
			defaultVariant: "off",
			targeting: [{ when: { op: "eq", field: "country", value: "AR" }, serve: "on" }],
		},
	},
	version: "1",
};

/** A store whose storage refuses the read, so `load` has a failure to report. */
class UnreachableFlagStore implements FlagStore {
	/** @returns The failure a store answers with when its storage cannot be reached. */
	read(): Result<StoredFlagSet, FlagStoreError> {
		return failure(new FlagStoreError("The namespace refused the get", { code: "unavailable" }));
	}
}

afterEach(() => {
	vi.useRealTimers();
});

test("keeps the snapshot a successful load parsed", async () => {
	let engine = createEngine({ store: new InMemoryFlagStore(SET) });

	let result = await engine.load();

	expect(isSuccess(result)).toBe(true);
	expect(unwrap(result)).toBe(engine.snapshot);
	expect(engine.snapshot?.version).toBe("1");
	expect([...(engine.snapshot?.flags.keys() ?? [])]).toStrictEqual(["banner", "regional"]);
});

test("loads without a promise from a store that reads without one", () => {
	let engine = createEngine({ store: new InMemoryFlagStore(SET) });

	expect(engine.load()).not.toBeInstanceOf(Promise);
	expect(engine.snapshot).toBeDefined();
});

test("reports a store that could not be reached, and holds no snapshot", async () => {
	let engine = createEngine({ store: new UnreachableFlagStore() });

	let result = await engine.load();

	expect(isFailure(result)).toBe(true);
	expect(isFailure(result) && result.error.code).toBe("unavailable");
	expect(engine.snapshot).toBeUndefined();
	expect(engine.failures).toStrictEqual([]);
});

test("answers PROVIDER_NOT_READY with the caller's default before any load", () => {
	let engine = createEngine({ store: new InMemoryFlagStore(SET) });

	expect(engine.evaluate("banner", true)).toStrictEqual({
		value: true,
		reason: "ERROR",
		errorCode: "PROVIDER_NOT_READY",
		errorMessage: expect.any(String),
	});
	expect(engine.evaluateAll()).toStrictEqual({});
});

test("resolves a flag against the held snapshot once loaded", async () => {
	let engine = createEngine({ store: new InMemoryFlagStore(SET) });

	await engine.load();

	expect(engine.evaluate("banner", true)).toStrictEqual({
		value: false,
		variant: "off",
		reason: "STATIC",
	});
	expect(engine.evaluate("regional", false, { country: "AR" })).toStrictEqual({
		value: true,
		variant: "on",
		reason: "TARGETING_MATCH",
	});
});

test("resolves the whole set once loaded", async () => {
	let engine = createEngine({ store: new InMemoryFlagStore(SET) });

	await engine.load();

	expect(engine.evaluateAll({ country: "AR" })).toStrictEqual({
		banner: { value: false, variant: "off", reason: "STATIC" },
		regional: { value: true, variant: "on", reason: "TARGETING_MATCH" },
	});
});

test("is stale before a load, current after one, and stale again past maxAge", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-09-14T00:00:00.000Z"));

	let engine = createEngine({ store: new InMemoryFlagStore(SET), maxAge: "5 minutes" });

	expect(engine.stale).toBe(true);

	await engine.load();

	expect(engine.stale).toBe(false);

	vi.setSystemTime(new Date("2026-09-14T00:04:59.999Z"));
	expect(engine.stale).toBe(false);

	vi.setSystemTime(new Date("2026-09-14T00:05:00.000Z"));
	expect(engine.stale).toBe(true);
});

test("stays current for as long as the caller holds it when no maxAge is set", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-09-14T00:00:00.000Z"));

	let engine = createEngine({ store: new InMemoryFlagStore(SET) });

	await engine.load();
	vi.setSystemTime(new Date("2027-09-14T00:00:00.000Z"));

	expect(engine.stale).toBe(false);
});

test("replaces the snapshot on a later load", async () => {
	let store = new InMemoryFlagStore(SET);
	let engine = createEngine({ store });

	await engine.load();
	store.write({
		flags: { banner: { variants: { on: true, off: false }, defaultVariant: "on" } },
		version: "2",
	});
	await engine.load();

	expect(engine.snapshot?.version).toBe("2");
	expect(engine.evaluate("banner", false)).toStrictEqual({
		value: true,
		variant: "on",
		reason: "STATIC",
	});
	expect(engine.evaluate("regional", false)).toMatchObject({ errorCode: "FLAG_NOT_FOUND" });
});

test("carries the definitions it refused while the rest of the set resolves", async () => {
	let engine = createEngine({
		store: new InMemoryFlagStore({
			flags: {
				banner: { variants: { on: true, off: false }, defaultVariant: "off" },
				broken: { variants: { on: true }, defaultVariant: "nobody" },
			},
		}),
	});

	await engine.load();

	expect(engine.failures).toStrictEqual([{ key: "broken", message: expect.any(String) }]);
	expect(engine.evaluate("banner", true).value).toBe(false);
	expect(engine.evaluate("broken", true)).toMatchObject({
		value: true,
		reason: "ERROR",
		errorCode: "PARSE_ERROR",
	});
});
