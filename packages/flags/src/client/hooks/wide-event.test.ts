/**
 * What the wide-event hook writes, and what it does where there is no record to
 * write to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/types";

import { createLogger } from "@sdxc/logger";
import { describe, expect, test } from "vitest";

import { failed, resolved } from "../../provider/details.js";
import { createFlags } from "../registry.js";

import { wideEventHook } from "./wide-event.js";

/** Answers from a flag set, and fails for anything else, so both halves of the record show. */
class Fake {
	readonly metadata = { name: "launch-darkly" };

	values: Record<string, JSONValue>;

	constructor(values: Record<string, JSONValue> = {}) {
		this.values = values;
	}

	answer<T extends JSONValue>(key: string, defaultValue: T) {
		if (!(key in this.values))
			return failed(defaultValue, "FLAG_NOT_FOUND", `No flag named ${key}`);
		return resolved(this.values[key] as T, { variant: "treatment", reason: "TARGETING_MATCH" });
	}

	resolveBoolean(key: string, defaultValue: boolean) {
		return this.answer(key, defaultValue);
	}
	resolveString(key: string, defaultValue: string) {
		return this.answer(key, defaultValue);
	}
	resolveNumber(key: string, defaultValue: number) {
		return this.answer(key, defaultValue);
	}
	resolveObject(key: string, defaultValue: JSONValue) {
		return this.answer(key, defaultValue);
	}
}

/** Captures what an invocation's record ended up holding. */
function collect() {
	let records: Record<string, unknown>[] = [];
	let logger = createLogger({
		service: "flags",
		sink: (record) => void records.push({ ...record }),
	});
	return { logger, records };
}

describe("the wide event hook", () => {
	test("puts the key, reason, variant and provider on the invocation's record", async () => {
		let { logger, records } = collect();
		let flags = createFlags({ hooks: [wideEventHook()] });
		await flags.setProvider(new Fake({ "new-checkout": true }));

		await logger.open("request").run(() => flags.getClient().boolean("new-checkout", false));

		expect(records.at(0)).toMatchObject({
			"feature_flag.key": "new-checkout",
			"feature_flag.result.reason": "targeting_match",
			"feature_flag.result.variant": "treatment",
			"feature_flag.provider.name": "launch-darkly",
		});
	});

	test("adds the error type and message when the evaluation failed", async () => {
		let { logger, records } = collect();
		let flags = createFlags({ hooks: [wideEventHook()] });
		await flags.setProvider(new Fake());

		await logger.open("request").run(() => flags.getClient().boolean("new-checkout", false));

		expect(records.at(0)).toMatchObject({
			"feature_flag.result.reason": "error",
			"error.type": "flag_not_found",
			"error.message": "No flag named new-checkout",
		});
	});

	test("passes a reason the record's enumeration does not know through unchanged", async () => {
		let { logger, records } = collect();
		let flags = createFlags({ hooks: [wideEventHook()] });
		await flags.setProvider({
			metadata: { name: "custom" },
			resolveBoolean: (_key: string, value: boolean) =>
				resolved(value, { reason: "ROLLOUT_HOLDBACK" }),
			resolveString: (_key: string, value: string) => resolved(value),
			resolveNumber: (_key: string, value: number) => resolved(value),
			resolveObject: (_key: string, value: JSONValue) => resolved(value),
		});

		await logger.open("request").run(() => flags.getClient().boolean("flag", false));

		expect(records.at(0)).toMatchObject({ "feature_flag.result.reason": "ROLLOUT_HOLDBACK" });
	});

	test("does nothing outside an invocation", async () => {
		let flags = createFlags({ hooks: [wideEventHook()] });
		await flags.setProvider(new Fake({ "new-checkout": true }));

		expect(await flags.getClient().boolean("new-checkout", false)).toBe(true);
	});
});
