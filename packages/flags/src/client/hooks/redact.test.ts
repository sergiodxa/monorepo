/**
 * That the named fields are gone by the time anything downstream of the
 * `before` stage can read them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/types";

import { describe, expect, test } from "vitest";

import type { EvaluationContext } from "../../core/context.js";

import { resolved } from "../../provider/details.js";
import { createFlags } from "../registry.js";

import { redactHook } from "./redact.js";

/** Keeps whatever context it was handed, which is the point of the assertion. */
class Recorder {
	readonly metadata = { name: "recorder" };

	seen: EvaluationContext = {};

	resolveBoolean(_key: string, value: boolean, context: EvaluationContext) {
		this.seen = context;
		return resolved(value);
	}
	resolveString(_key: string, value: string) {
		return resolved(value);
	}
	resolveNumber(_key: string, value: number) {
		return resolved(value);
	}
	resolveObject(_key: string, value: JSONValue) {
		return resolved(value);
	}
}

describe("the redact hook", () => {
	test("keeps the named fields from reaching the provider", async () => {
		let provider = new Recorder();
		let flags = createFlags({ hooks: [redactHook(["email", "ip"])] });
		await flags.setProvider(provider);

		await flags.getClient().boolean("flag", false, {
			targetingKey: "user-1",
			email: "someone@example.com",
			ip: "203.0.113.4",
			plan: "pro",
		});

		expect(provider.seen).toEqual({ targetingKey: "user-1", plan: "pro" });
	});

	test("keeps the named fields from reaching the hooks that run after it", async () => {
		let seen: EvaluationContext | undefined;
		let flags = createFlags({
			hooks: [redactHook(["email"]), { before: (context) => void (seen = context.context) }],
		});
		await flags.setProvider(new Recorder());

		await flags.getClient().boolean("flag", false, { email: "someone@example.com", plan: "pro" });

		expect(seen).toEqual({ plan: "pro" });
	});

	test("leaves a context that carries none of them alone", async () => {
		let provider = new Recorder();
		let flags = createFlags({ hooks: [redactHook(["email"])] });
		await flags.setProvider(provider);

		await flags.getClient().boolean("flag", false, { plan: "pro" });

		expect(provider.seen).toEqual({ plan: "pro" });
	});
});
