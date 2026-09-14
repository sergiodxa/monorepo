/**
 * The provider a test pins a flag on with: a flag set of variants, a default
 * variant and an optional targeting function, resolved from memory.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/types";

import type { EvaluationContext } from "../core/context.js";
import type { ResolutionDetails } from "../core/details.js";
import type { FlagMetadata, ProviderMetadata } from "../core/metadata.js";
import type { FlagValue } from "../core/value.js";

import type { ResolvedDetails } from "./details.js";
import type { Provider } from "./provider.js";

import { failed, resolved } from "./details.js";
import { ProviderError } from "./error.js";
import { ProviderEvents } from "./events.js";

/**
 * One flag written down: every value it can take, which of them it serves, and
 * the rule that overrides that choice for a given context. Targeting is a
 * function rather than an expression language, so a test states the rule in
 * TypeScript and the type checker reads it.
 */
export interface FlagConfiguration<T extends FlagValue = FlagValue> {
	variants: Record<string, T>;
	/** The variant served whenever targeting names none. */
	defaultVariant: string;
	/** Serves the default value with `reason: "DISABLED"` instead of evaluating. */
	disabled?: boolean;
	/** Names the variant this context targets, or nothing to fall through to the default. */
	contextEvaluator?: (context: EvaluationContext) => string | undefined;
	flagMetadata?: FlagMetadata;
}

/** Every flag the provider can answer for, by key. */
export type FlagSet = Record<string, FlagConfiguration>;

function isBoolean(value: FlagValue): value is boolean {
	return typeof value === "boolean";
}

function isString(value: FlagValue): value is string {
	return typeof value === "string";
}

function isNumber(value: FlagValue): value is number {
	return typeof value === "number";
}

function isStructure(value: FlagValue): value is JSONValue {
	return typeof value === "object" && value !== null;
}

/**
 * A provider that answers from a flag set held in memory, so a test pins a flag
 * on the way production pins one and reads back the same variant, reason and
 * metadata a flag management system would have sent.
 *
 * It runs the whole lifecycle — `initialize` announces readiness,
 * `putConfiguration` announces a changed flag set, `shutdown` returns it to
 * uninitialized — because a testing provider that skipped it would let a test
 * pass against something production never behaves like.
 *
 * @example
 * let provider = new InMemoryProvider({
 * 	"new-checkout": { variants: { on: true, off: false }, defaultVariant: "off" },
 * });
 * await provider.initialize();
 */
export class InMemoryProvider implements Provider {
	readonly metadata: ProviderMetadata = { name: "in-memory" };
	readonly events = new ProviderEvents();

	#flags: Map<string, FlagConfiguration>;
	#ready = false;

	constructor(flags: FlagSet = {}) {
		this.#flags = new Map(Object.entries(flags));
	}

	/**
	 * Makes the provider ready to resolve and says so, emitting `PROVIDER_READY`
	 * before it returns. A flag declaring no variants can never serve a value, so
	 * that flag set is refused with `PROVIDER_FATAL`, emitted before the rejection.
	 */
	async initialize(_context: EvaluationContext = {}, _domain?: string): Promise<void> {
		let empty = [...this.#flags].filter(([, flag]) => Object.keys(flag.variants).length === 0);

		if (empty.length > 0) {
			let keys = empty.map(([key]) => key).join(", ");
			let message = `The flag set declares no variants for ${keys}.`;

			this.events.emit("PROVIDER_ERROR", { errorCode: "PROVIDER_FATAL", message });
			throw new ProviderError("PROVIDER_FATAL", message);
		}

		this.#ready = true;
		this.events.emit("PROVIDER_READY");
	}

	/** Returns the provider to its uninitialized state, as many times as it is called. */
	async shutdown(): Promise<void> {
		this.#ready = false;
	}

	/**
	 * Swaps the flag set for another one and announces it, naming every key that
	 * was in the old set or is in the new one, so a listener caching per key knows
	 * exactly which entries it has to drop.
	 */
	putConfiguration(flags: FlagSet): void {
		let changed = new Set([...this.#flags.keys(), ...Object.keys(flags)]);

		this.#flags = new Map(Object.entries(flags));
		this.events.emit("PROVIDER_CONFIGURATION_CHANGED", { flagsChanged: [...changed] });
	}

	resolveBoolean(
		key: string,
		defaultValue: boolean,
		context: EvaluationContext = {},
	): ResolutionDetails<boolean> {
		return this.#resolve(key, defaultValue, context, isBoolean);
	}

	resolveString(
		key: string,
		defaultValue: string,
		context: EvaluationContext = {},
	): ResolutionDetails<string> {
		return this.#resolve(key, defaultValue, context, isString);
	}

	resolveNumber(
		key: string,
		defaultValue: number,
		context: EvaluationContext = {},
	): ResolutionDetails<number> {
		return this.#resolve(key, defaultValue, context, isNumber);
	}

	resolveObject(
		key: string,
		defaultValue: JSONValue,
		context: EvaluationContext = {},
	): ResolutionDetails<JSONValue> {
		return this.#resolve(key, defaultValue, context, isStructure);
	}

	/**
	 * The one resolution path the four typed resolvers share, differing only in
	 * the guard that decides whether the variant they found holds the type they
	 * were asked for.
	 */
	#resolve<T extends FlagValue>(
		key: string,
		defaultValue: T,
		context: EvaluationContext,
		matches: (value: FlagValue) => value is T,
	): ResolutionDetails<T> {
		if (!this.#ready) {
			return failed(defaultValue, "PROVIDER_NOT_READY", "The provider is not initialized.");
		}

		let flag = this.#flags.get(key);
		if (!flag) return failed(defaultValue, "FLAG_NOT_FOUND", `No flag named "${key}".`);

		let details: ResolvedDetails<T> = {};
		if (flag.flagMetadata) details.flagMetadata = flag.flagMetadata;

		if (flag.disabled) return resolved(defaultValue, { ...details, reason: "DISABLED" });

		let targeted: string | undefined;
		try {
			targeted = flag.contextEvaluator?.(context) || undefined;
		} catch (error) {
			let message = error instanceof Error ? error.message : String(error);
			return failed(defaultValue, "GENERAL", `Targeting "${key}" failed: ${message}`);
		}

		let variant = targeted ?? flag.defaultVariant;
		let value = flag.variants[variant];

		if (value === undefined) {
			return failed(defaultValue, "GENERAL", `The flag "${key}" has no variant "${variant}".`);
		}

		if (!matches(value)) {
			return failed(
				defaultValue,
				"TYPE_MISMATCH",
				`The variant "${variant}" of "${key}" holds a ${typeof value}.`,
			);
		}

		// A flag with targeting that named no variant fell back, which the specification calls
		// DEFAULT — "dynamic evaluation yielded no result". STATIC is for a flag that never
		// evaluated anything, so the two say different things about why this variant was served.
		return resolved(value, {
			...details,
			variant,
			reason: targeted ? "TARGETING_MATCH" : flag.contextEvaluator ? "DEFAULT" : "STATIC",
		});
	}
}
