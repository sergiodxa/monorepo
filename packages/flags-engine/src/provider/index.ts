/**
 * The adapter that makes an engine answer as a flag provider: a lifecycle over
 * `load`, four resolvers over `evaluate`, and the status an application already
 * subscribes to. It is the one module here that knows OpenFeature.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	ErrorCode,
	EvaluationContext,
	ProviderMetadata,
	ResolutionDetails,
} from "@sdxc/flags";
import type { Provider } from "@sdxc/flags/provider";
import type { Result } from "@sdxc/result";
import type { JSONValue } from "@sdxc/types";

import { ProviderError, ProviderEvents } from "@sdxc/flags/provider";
import { isFailure } from "@sdxc/result";

import type { Engine } from "../engine.js";
import type { FlagSnapshot } from "../snapshot.js";
import type { FlagStoreError, FlagStoreErrorCode } from "../store/index.js";

/** What a store's own failure is called once it reaches the evaluation surface. */
const STORE_ERROR_CODES: Record<FlagStoreErrorCode, ErrorCode> = {
	unavailable: "GENERAL",
	invalid_value: "PARSE_ERROR",
};

/**
 * Resolves flags through an engine the caller builds and reloads, so one
 * snapshot serves this provider and whatever else evaluates against the same
 * engine, and an application registers a whole rule set as one provider.
 *
 * @example
 * let provider = new EngineProvider(createEngine({ store: new WorkerKVFlagStore(env.FLAGS) }));
 */
export class EngineProvider implements Provider {
	readonly metadata: ProviderMetadata = { name: "flags-engine" };
	readonly events = new ProviderEvents();

	#engine: Engine;

	/**
	 * Whether the status channel has been told the definitions aged, so one aging
	 * is one announcement and the reload that ends it says so once.
	 */
	#announced = false;

	/**
	 * @param engine The engine every resolution reads, loaded by `initialize` and
	 * reloaded by `refresh`.
	 */
	constructor(engine: Engine) {
		this.#engine = engine;
	}

	/**
	 * Reads the definitions once, so every resolution that follows walks memory,
	 * and announces readiness before it returns.
	 *
	 * @throws ProviderError When the store could not hand its set over, which is a
	 * configuration failure announced on the status channel first.
	 */
	async initialize(_context: EvaluationContext = {}, _domain?: string): Promise<void> {
		let result = await this.#engine.load();

		if (isFailure(result)) {
			let errorCode = STORE_ERROR_CODES[result.error.code];
			let message = result.error.message;

			this.events.emit("PROVIDER_ERROR", { errorCode, message });
			throw new ProviderError(errorCode, message, { cause: result.error });
		}

		this.#announced = false;
		this.events.emit("PROVIDER_READY");
	}

	/**
	 * Reads the definitions again, on whatever schedule the caller keeps, and
	 * names every key either the outgoing set or the incoming one answers for, so
	 * a listener caching per key drops both sides of a whole-set replacement.
	 *
	 * @returns The snapshot now held, or why the store could not hand its set over.
	 */
	async refresh(): Promise<Result<FlagSnapshot, FlagStoreError>> {
		let previous = this.#engine.snapshot;
		let result = await this.#engine.load();

		if (isFailure(result)) {
			this.#announceStale();
			return result;
		}

		if (this.#announced) {
			this.#announced = false;
			this.events.emit("PROVIDER_READY");
		}

		this.events.emit("PROVIDER_CONFIGURATION_CHANGED", {
			flagsChanged: [...new Set([...answeredBy(previous), ...answeredBy(result.data)])],
		});

		return result;
	}

	resolveBoolean(
		key: string,
		defaultValue: boolean,
		context: EvaluationContext = {},
	): ResolutionDetails<boolean> {
		return this.#engine.evaluate(key, defaultValue, context);
	}

	resolveString(
		key: string,
		defaultValue: string,
		context: EvaluationContext = {},
	): ResolutionDetails<string> {
		return this.#engine.evaluate(key, defaultValue, context);
	}

	resolveNumber(
		key: string,
		defaultValue: number,
		context: EvaluationContext = {},
	): ResolutionDetails<number> {
		return this.#engine.evaluate(key, defaultValue, context);
	}

	resolveObject(
		key: string,
		defaultValue: JSONValue,
		context: EvaluationContext = {},
	): ResolutionDetails<JSONValue> {
		return this.#engine.evaluate(key, defaultValue, context);
	}

	/**
	 * Says the definitions are aging at the one moment the provider reads the
	 * engine away from the evaluation path: a reload that kept a snapshot already
	 * past `maxAge`, which is where an age a caller can act on becomes visible.
	 */
	#announceStale(): void {
		if (this.#announced) return;
		if (this.#engine.snapshot === undefined || !this.#engine.stale) return;

		this.#announced = true;
		this.events.emit("PROVIDER_STALE", {
			message: "Serving definitions older than maxAge until a reload replaces them",
		});
	}
}

/**
 * Every key a snapshot has an answer for, the definitions it refused included,
 * since a flag that failed to parse resolves as `PARSE_ERROR` under its own key.
 */
function answeredBy(snapshot: FlagSnapshot | undefined): string[] {
	if (snapshot === undefined) return [];

	return [...snapshot.flags.keys(), ...snapshot.failures.keys()];
}
