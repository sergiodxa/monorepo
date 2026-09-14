/**
 * The client an application evaluates through: eight conformant methods, the
 * two catalog ones, and the hook, handler and tracking surface beside them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/types";

import type { Client, Flag, FlagOptions } from "../core/client.js";
import type { EvaluationContext } from "../core/context.js";
import type { EvaluationDetails } from "../core/details.js";
import type { Hook } from "../core/hook.js";
import type { ClientMetadata } from "../core/metadata.js";
import type { EvaluationOptions, ObjectEvaluationOptions } from "../core/options.js";
import type { EventHandler, ProviderEvent, ProviderStatus } from "../core/status.js";
import type { TrackingEventDetails } from "../core/tracking.js";
import type { FlagValue, FlagValueType } from "../core/value.js";

import type { Binding } from "./binding.js";
import type { Evaluation } from "./evaluate.js";
import type { Handlers } from "./events.js";

import { merge } from "./context.js";
import { evaluate } from "./evaluate.js";

/**
 * What every client for one domain shares. Hooks and handlers live here rather
 * than on the client object, so a per-request client carrying its own context
 * still sees what was registered at startup and adds no subscription to clean up.
 */
export interface Scope {
	readonly domain?: string;
	readonly hooks: Hook[];
	readonly handlers: Handlers;
}

/** What a client reads off the API instance it belongs to, as it stands right now. */
export interface ClientHost {
	readonly apiHooks: Hook[];
	binding(domain?: string): Binding;
	globalContext(): EvaluationContext;
	transactionContext(): EvaluationContext | undefined;
}

/**
 * Builds a client for `scope`. The optional context becomes the client merge
 * level, which is how a middleware hands every evaluation in one request the
 * subject it already worked out.
 */
export function createClient(host: ClientHost, scope: Scope, context?: EvaluationContext): Client {
	return new FlagClient(host, scope, context);
}

class FlagClient implements Client {
	readonly metadata: ClientMetadata;

	#host: ClientHost;
	#scope: Scope;
	#context: EvaluationContext | undefined;

	constructor(host: ClientHost, scope: Scope, context?: EvaluationContext) {
		this.#host = host;
		this.#scope = scope;
		this.#context = context;
		this.metadata = Object.freeze({ domain: scope.domain });
	}

	get providerStatus(): ProviderStatus {
		return this.#host.binding(this.#scope.domain).status;
	}

	async boolean(
		key: string,
		defaultValue: boolean,
		context?: EvaluationContext,
		options?: EvaluationOptions,
	): Promise<boolean> {
		return (await this.booleanDetails(key, defaultValue, context, options)).value;
	}

	async string(
		key: string,
		defaultValue: string,
		context?: EvaluationContext,
		options?: EvaluationOptions,
	): Promise<string> {
		return (await this.stringDetails(key, defaultValue, context, options)).value;
	}

	async number(
		key: string,
		defaultValue: number,
		context?: EvaluationContext,
		options?: EvaluationOptions,
	): Promise<number> {
		return (await this.numberDetails(key, defaultValue, context, options)).value;
	}

	async object<T extends JSONValue>(
		key: string,
		defaultValue: T,
		options: ObjectEvaluationOptions<T>,
		context?: EvaluationContext,
	): Promise<T> {
		return (await this.objectDetails(key, defaultValue, options, context)).value;
	}

	booleanDetails(
		key: string,
		defaultValue: boolean,
		context?: EvaluationContext,
		options?: EvaluationOptions,
	): Promise<EvaluationDetails<boolean>> {
		return this.#evaluate("boolean", key, defaultValue, context, options);
	}

	stringDetails(
		key: string,
		defaultValue: string,
		context?: EvaluationContext,
		options?: EvaluationOptions,
	): Promise<EvaluationDetails<string>> {
		return this.#evaluate("string", key, defaultValue, context, options);
	}

	numberDetails(
		key: string,
		defaultValue: number,
		context?: EvaluationContext,
		options?: EvaluationOptions,
	): Promise<EvaluationDetails<number>> {
		return this.#evaluate("number", key, defaultValue, context, options);
	}

	objectDetails<T extends JSONValue>(
		key: string,
		defaultValue: T,
		options: ObjectEvaluationOptions<T>,
		context?: EvaluationContext,
	): Promise<EvaluationDetails<T>> {
		return this.#evaluate("object", key, defaultValue, context, options, options.schema);
	}

	async get<T extends FlagValue>(flag: Flag<T>, options?: FlagOptions<T>): Promise<T> {
		return (await this.details(flag, options)).value;
	}

	details<T extends FlagValue>(
		flag: Flag<T>,
		options?: FlagOptions<T>,
	): Promise<EvaluationDetails<T>> {
		return this.#evaluate(
			flag.type,
			flag.key,
			options?.defaultValue ?? flag.defaultValue,
			options?.context,
			options,
			flag.schema,
		);
	}

	addHooks(...hooks: Hook[]): void {
		this.#scope.hooks.push(...hooks);
	}

	addHandler(event: ProviderEvent, handler: EventHandler): void {
		let binding = this.#host.binding(this.#scope.domain);
		this.#scope.handlers.add(event, handler, binding.status, binding.provider.metadata.name);
	}

	removeHandler(event: ProviderEvent, handler: EventHandler): void {
		this.#scope.handlers.remove(event, handler);
	}

	track(name: string, context?: EvaluationContext, details?: TrackingEventDetails): void {
		try {
			let provider = this.#host.binding(this.#scope.domain).provider;
			provider.track?.(name, this.#merged(context), details);
		} catch {
			return;
		}
	}

	#evaluate<T extends FlagValue>(
		type: FlagValueType,
		key: string,
		defaultValue: T,
		context?: EvaluationContext,
		options?: EvaluationOptions,
		schema?: Evaluation<T>["schema"],
	): Promise<EvaluationDetails<T>> {
		return evaluate<T>({
			key,
			type,
			defaultValue,
			schema,
			binding: this.#host.binding(this.#scope.domain),
			clientMetadata: this.metadata,
			globalContext: this.#host.globalContext(),
			transactionContext: this.#host.transactionContext(),
			clientContext: this.#context,
			invocationContext: context,
			apiHooks: this.#host.apiHooks,
			clientHooks: this.#scope.hooks,
			invocationHooks: options?.hooks,
			hints: options?.hints,
		});
	}

	/** The tracking merge, which stops at the invocation level: no hook runs here. */
	#merged(context?: EvaluationContext): EvaluationContext {
		return merge(
			this.#host.globalContext(),
			this.#host.transactionContext(),
			this.#context,
			context,
		);
	}
}
