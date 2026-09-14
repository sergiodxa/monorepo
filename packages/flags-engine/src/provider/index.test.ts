/**
 * The provider wrapper: what it announces as it starts, reloads and ages, that
 * every answer it gives is the engine's own, and the specification suite every
 * provider passes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ProviderEventDetails } from "@sdxc/flags";
import type { FlagSet } from "@sdxc/flags/provider/memory";
import type { Result } from "@sdxc/result";

import { conformance } from "@sdxc/flags/conformance";
import { ProviderError } from "@sdxc/flags/provider";
import { failure, isFailure, success } from "@sdxc/result";
import { afterEach, expect, test, vi } from "vitest";

import type { FlagStore, FlagStoreErrorCode, StoredFlagSet } from "../store/index.js";

import { createEngine } from "../engine.js";
import { FlagStoreError } from "../store/index.js";
import { InMemoryFlagStore } from "../store/memory.js";

import { EngineProvider } from "./index.js";

/** One flag per type, so every resolver has a flag to answer for and three to refuse. */
const FLAGS: FlagSet = {
	"boolean-flag": { variants: { on: true, off: false }, defaultVariant: "on" },
	"string-flag": { variants: { greeting: "hi", parting: "bye" }, defaultVariant: "greeting" },
	"number-flag": { variants: { one: 1, ten: 10 }, defaultVariant: "ten" },
	"object-flag": {
		variants: { empty: {}, template: { title: "Check out these pics!" } },
		defaultVariant: "template",
	},
};

/**
 * The same flags as the engine reads them, so what the suite expects a key to
 * serve and what the engine resolves it to are written down once.
 */
function definitions(flags: FlagSet): StoredFlagSet {
	return {
		flags: Object.fromEntries(
			Object.entries(flags).map(([key, flag]) => [
				key,
				{ variants: flag.variants, defaultVariant: flag.defaultVariant },
			]),
		),
	};
}

/** A store standing in for storage that answers until it stops answering. */
class FlakyFlagStore implements FlagStore {
	/** Whether a read hands the set over, which is how a test decides a reload fails. */
	reachable = true;

	#set: StoredFlagSet;
	#code: FlagStoreErrorCode;

	/**
	 * @param set What a reachable read answers with.
	 * @param code What an unreachable read reports, so both store failures reach the provider.
	 */
	constructor(set: StoredFlagSet, code: FlagStoreErrorCode = "unavailable") {
		this.#set = set;
		this.#code = code;
	}

	/** @returns The held set, or the failure a store reports about its storage. */
	read(): Result<StoredFlagSet, FlagStoreError> {
		if (this.reachable) return success(structuredClone(this.#set));

		return failure(new FlagStoreError("The namespace refused the get", { code: this.#code }));
	}
}

/** The provider under test, over a store holding the fixture set. */
function provider(store: FlagStore = new InMemoryFlagStore(definitions(FLAGS))): EngineProvider {
	return new EngineProvider(createEngine({ store }));
}

afterEach(() => {
	vi.useRealTimers();
});

test("identifies the implementation by name", () => {
	expect(provider().metadata.name).toBe("flags-engine");
});

test("emits PROVIDER_READY once the definitions are loaded, and resolves from them", async () => {
	let instance = provider();
	let ready = vi.fn();

	instance.events.on("PROVIDER_READY", ready);
	await instance.initialize();

	expect(ready).toHaveBeenCalledTimes(1);
	expect(instance.resolveBoolean("boolean-flag", false, {})).toStrictEqual({
		value: true,
		variant: "on",
		reason: "STATIC",
	});
	expect(instance.resolveString("string-flag", "none", {}).value).toBe("hi");
	expect(instance.resolveNumber("number-flag", -1, {}).value).toBe(10);
	expect(instance.resolveObject("object-flag", {}, {}).value).toStrictEqual({
		title: "Check out these pics!",
	});
});

test("answers a resolution without allocating a promise", async () => {
	let instance = provider();

	await instance.initialize();

	expect(instance.resolveBoolean("boolean-flag", false, {})).not.toBeInstanceOf(Promise);
});

test("answers PROVIDER_NOT_READY with the caller's default until initialize has run", () => {
	let instance = provider();

	expect(instance.resolveBoolean("boolean-flag", false, {})).toStrictEqual({
		value: false,
		reason: "ERROR",
		errorCode: "PROVIDER_NOT_READY",
		errorMessage: expect.any(String),
	});
});

test("answers TYPE_MISMATCH when the variant holds another type", async () => {
	let instance = provider();

	await instance.initialize();

	expect(instance.resolveNumber("boolean-flag", -1, {})).toMatchObject({
		value: -1,
		reason: "ERROR",
		errorCode: "TYPE_MISMATCH",
	});
});

test("emits PROVIDER_ERROR and rejects when the store could not be read", async () => {
	let store = new FlakyFlagStore(definitions(FLAGS));
	let instance = provider(store);
	let error = vi.fn();

	store.reachable = false;
	instance.events.on("PROVIDER_ERROR", error);

	await expect(instance.initialize()).rejects.toThrow(ProviderError);
	expect(error).toHaveBeenCalledWith({ errorCode: "GENERAL", message: expect.any(String) });
	expect(instance.resolveBoolean("boolean-flag", false, {})).toMatchObject({
		errorCode: "PROVIDER_NOT_READY",
	});
});

test("names a set the store could not read back a PARSE_ERROR", async () => {
	let store = new FlakyFlagStore(definitions(FLAGS), "invalid_value");
	let instance = provider(store);

	store.reachable = false;

	await expect(instance.initialize()).rejects.toMatchObject({ code: "PARSE_ERROR" });
});

test("emits PROVIDER_CONFIGURATION_CHANGED naming every key either set answers for", async () => {
	let store = new InMemoryFlagStore(definitions(FLAGS));
	let instance = provider(store);
	let changed = vi.fn();

	await instance.initialize();
	instance.events.on("PROVIDER_CONFIGURATION_CHANGED", changed);
	store.write({
		flags: {
			"boolean-flag": { variants: { on: true, off: false }, defaultVariant: "off" },
			"broken-flag": { variants: { on: true }, defaultVariant: "nobody" },
		},
	});

	let result = await instance.refresh();
	let details: ProviderEventDetails = changed.mock.calls[0]?.[0];

	expect(isFailure(result)).toBe(false);
	expect([...(details.flagsChanged ?? [])].sort()).toStrictEqual([
		"boolean-flag",
		"broken-flag",
		"number-flag",
		"object-flag",
		"string-flag",
	]);
	expect(instance.resolveBoolean("boolean-flag", true, {}).value).toBe(false);
	expect(instance.resolveBoolean("number-flag", true, {})).toMatchObject({
		errorCode: "FLAG_NOT_FOUND",
	});
});

test("answers with the store's failure when a reload could not replace the set", async () => {
	let store = new FlakyFlagStore(definitions(FLAGS));
	let instance = provider(store);

	await instance.initialize();
	store.reachable = false;

	let result = await instance.refresh();

	expect(isFailure(result) && result.error.code).toBe("unavailable");
	expect(instance.resolveBoolean("boolean-flag", false, {}).value).toBe(true);
});

test("emits PROVIDER_STALE once a reload leaves definitions older than maxAge in place", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-09-14T00:00:00.000Z"));

	let store = new FlakyFlagStore(definitions(FLAGS));
	let instance = new EngineProvider(createEngine({ store, maxAge: "5 minutes" }));
	let stale = vi.fn();

	await instance.initialize();
	instance.events.on("PROVIDER_STALE", stale);
	store.reachable = false;

	vi.setSystemTime(new Date("2026-09-14T00:01:00.000Z"));
	await instance.refresh();

	expect(
		stale,
		"definitions within maxAge are current, however the reload went",
	).not.toHaveBeenCalled();

	vi.setSystemTime(new Date("2026-09-14T00:06:00.000Z"));
	await instance.refresh();
	await instance.refresh();

	expect(stale).toHaveBeenCalledTimes(1);
	expect(instance.resolveBoolean("boolean-flag", false, {}).value).toBe(true);
});

test("says it is ready again when a reload replaces definitions it announced as aged", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-09-14T00:00:00.000Z"));

	let store = new FlakyFlagStore(definitions(FLAGS));
	let instance = new EngineProvider(createEngine({ store, maxAge: "5 minutes" }));
	let ready = vi.fn();
	let stale = vi.fn();

	await instance.initialize();
	instance.events.on("PROVIDER_READY", ready);
	instance.events.on("PROVIDER_STALE", stale);

	store.reachable = false;
	vi.setSystemTime(new Date("2026-09-14T00:06:00.000Z"));
	await instance.refresh();

	store.reachable = true;
	await instance.refresh();
	await instance.refresh();

	expect(stale).toHaveBeenCalledTimes(1);
	expect(ready).toHaveBeenCalledTimes(1);
});

conformance("engine", () => provider(), { flags: FLAGS });
