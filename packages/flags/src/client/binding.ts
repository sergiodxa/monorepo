/**
 * One provider and everything an API instance knows about it: the domains it
 * answers for, the status it announced, and the single initialization every one
 * of those domains shares.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { EvaluationContext } from "../core/context.js";
import type { ProviderEvent, ProviderEventDetails, ProviderStatus } from "../core/status.js";
import type { Provider } from "../provider/provider.js";

import { ProviderError } from "../provider/error.js";

import { PROVIDER_EVENTS } from "./events.js";

/** What a binding tells the API instance when the provider behind it announces something. */
export type Announce = (
	binding: Binding,
	event: ProviderEvent,
	details: ProviderEventDetails,
) => void;

/**
 * A provider as registered: constructed on first use, initialized once however
 * many domains point at it, and shut down only when the last of them lets go.
 *
 * A binding created as a placeholder stands in for a provider nobody registered
 * — it answers defaults while reporting `NOT_READY`, since there is no provider
 * for readiness to be about.
 */
export class Binding {
	status: ProviderStatus = "NOT_READY";

	/** Every domain pointing here; the first one is what initialization is told about. */
	readonly domains: (string | undefined)[] = [];

	readonly placeholder: boolean;

	#factory: () => Provider;
	#announce: Announce;
	#instance: Provider | undefined;
	#initialization: Promise<Result<void, ProviderError>> | undefined;

	constructor(factory: () => Provider, announce: Announce, placeholder = false) {
		this.#factory = factory;
		this.#announce = announce;
		this.placeholder = placeholder;
	}

	/**
	 * The provider itself, built the first time something asks, so an instance
	 * configured at module scope costs nothing until an evaluation reaches it.
	 */
	get provider(): Provider {
		if (this.#instance) return this.#instance;

		this.#instance = this.#factory();

		for (let event of PROVIDER_EVENTS) {
			this.#instance.events?.on(event, (details) => this.#announce(this, event, details));
		}

		// A provider with no `initialize` has nothing to become ready for.
		if (!this.placeholder && !this.#instance.initialize) {
			this.#announce(this, "PROVIDER_READY", {});
		}

		return this.#instance;
	}

	/** Whether the provider was built, so shutdown skips one nobody ever reached. */
	get started(): boolean {
		return this.#instance !== undefined;
	}

	/**
	 * Runs `initialize` once and hands every later caller the same answer, which
	 * is what makes a provider bound to several domains initialize a single time.
	 */
	initialize(context: EvaluationContext): Promise<Result<void, ProviderError>> {
		this.#initialization ??= this.#start(context);
		return this.#initialization;
	}

	/** Releases the provider and returns the binding to where it started. */
	async shutdown(): Promise<Result<void, ProviderError>> {
		this.status = "NOT_READY";
		this.#initialization = undefined;

		if (!this.started) return success(undefined);

		try {
			await this.#instance?.shutdown?.();
			return success(undefined);
		} catch (error) {
			return failure(asProviderError(error));
		}
	}

	async #start(context: EvaluationContext): Promise<Result<void, ProviderError>> {
		let provider = this.provider;
		if (!provider.initialize) return success(undefined);

		try {
			await provider.initialize(context, this.domains.at(0));
			return success(undefined);
		} catch (error) {
			return failure(asProviderError(error));
		}
	}
}

/** Keeps whatever code a provider put on its error, and names the rest `GENERAL`. */
export function asProviderError(error: unknown): ProviderError {
	if (error instanceof ProviderError) return error;
	let message = error instanceof Error ? error.message : String(error);
	return new ProviderError("GENERAL", message, { cause: error });
}
