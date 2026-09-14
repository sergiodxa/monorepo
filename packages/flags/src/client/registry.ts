/**
 * The API instance: one per application, holding the providers, the global
 * context, the hooks, the handlers and the propagator that every client it
 * hands out evaluates through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Client } from "../core/client.js";
import type { EvaluationContext } from "../core/context.js";
import type { Hook } from "../core/hook.js";
import type { ProviderMetadata } from "../core/metadata.js";
import type {
	EventDetails,
	EventHandler,
	ProviderEvent,
	ProviderEventDetails,
} from "../core/status.js";
import type { Provider } from "../provider/provider.js";

import { ProviderError } from "../provider/error.js";
import { NoopProvider } from "../provider/noop.js";

import type { ClientHost, Scope } from "./client.js";
import type { TransactionContextPropagator } from "./propagator.js";

import { Binding } from "./binding.js";
import { createClient } from "./client.js";
import { Handlers, statusFor } from "./events.js";

/**
 * What an application settles once at startup. Every option seeds state the
 * specification requires a mutator for anyway, so configuring an instance and
 * reconfiguring one later are the same two pieces of state.
 */
export interface FlagsOptions {
	/** Called the first time an evaluation needs it, so startup builds nothing it may not use. */
	provider?: () => Provider;
	context?: EvaluationContext;
	hooks?: Hook[];
	handlers?: Partial<Record<ProviderEvent, EventHandler | EventHandler[]>>;
	propagator?: TransactionContextPropagator;
}

/**
 * One isolated API instance. Nothing here is global: two instances share no
 * providers, no context and no handlers, so a test that sets a provider cannot
 * reach the next one.
 */
export interface Flags {
	/** The metadata of the provider a client on `domain` would evaluate through. */
	providerMetadata(domain?: string): ProviderMetadata;

	/**
	 * A client for `domain`, optionally carrying the client-level context every
	 * evaluation through it merges — which is how a request publishes its subject.
	 */
	getClient(domain?: string, context?: EvaluationContext): Client;

	/** Sets the default provider and waits for its initialization to terminate. */
	setProvider(provider: Provider): Promise<Result<void, ProviderError>>;
	/** Binds `provider` to `domain`, waiting the same way, and releases whatever held it. */
	setProvider(domain: string, provider: Provider): Promise<Result<void, ProviderError>>;

	setContext(context: EvaluationContext): void;
	addHooks(...hooks: Hook[]): void;
	addHandler(event: ProviderEvent, handler: EventHandler): void;
	removeHandler(event: ProviderEvent, handler: EventHandler): void;
	setTransactionContextPropagator(propagator: TransactionContextPropagator): void;

	/** Runs `callback` with `context` as the transaction level of every evaluation inside it. */
	setTransactionContext<T>(context: EvaluationContext, callback: () => T): T;

	/** Initializes every registered provider, so the first request of an isolate can await it. */
	ready(): Promise<void>;

	/** Shuts every provider down and returns the instance to how it started. */
	shutdown(): Promise<Result<void, ProviderError>>;
}

/**
 * Builds an API instance. The result is the application's own value, handed to
 * whatever installs it, rather than a singleton anything can reach.
 *
 * @example
 * export const flags = createFlags({
 * 	provider: () => new MyProvider(),
 * 	context: { service: "uptime" },
 * 	hooks: [wideEventHook()],
 * });
 */
export function createFlags(options: FlagsOptions = {}): Flags {
	return new Registry(options);
}

class Registry implements Flags, ClientHost {
	apiHooks: Hook[] = [];

	#bindings = new Map<string | undefined, Binding>();
	#scopes = new Map<string | undefined, Scope>();
	#clients = new Map<string | undefined, Client>();
	#handlers = new Handlers();
	#context: EvaluationContext = {};
	#propagator: TransactionContextPropagator | undefined;

	constructor(options: FlagsOptions) {
		this.#install(options.provider);

		if (options.context) this.#context = { ...options.context };
		if (options.hooks) this.apiHooks.push(...options.hooks);
		this.#propagator = options.propagator;

		for (let [event, handler] of Object.entries(options.handlers ?? {})) {
			for (let one of Array.isArray(handler) ? handler : [handler]) {
				this.addHandler(event as ProviderEvent, one);
			}
		}
	}

	providerMetadata(domain?: string): ProviderMetadata {
		return this.binding(domain).provider.metadata;
	}

	getClient(domain?: string, context?: EvaluationContext): Client {
		let scope = this.#scope(domain);
		if (context) return createClient(this, scope, context);

		let client = this.#clients.get(domain);
		if (!client) {
			client = createClient(this, scope);
			this.#clients.set(domain, client);
		}

		return client;
	}

	async setProvider(
		first: Provider | string,
		second?: Provider,
	): Promise<Result<void, ProviderError>> {
		let domain = typeof first === "string" ? first : undefined;
		let provider = typeof first === "string" ? second : first;

		if (!provider) {
			return failure(new ProviderError("GENERAL", `No provider was supplied for "${domain}".`));
		}

		let existing = this.#bindingOf(provider);

		if (existing && !existing.domains.includes(domain) && provider.domainScoped) {
			return failure(
				new ProviderError(
					"GENERAL",
					`"${provider.metadata.name}" is domain-scoped and is already bound to another domain.`,
				),
			);
		}

		let previous = this.#bindings.get(domain);
		let binding =
			existing ??
			new Binding(
				() => provider,
				(...args) => this.#announce(...args),
			);

		if (!binding.domains.includes(domain)) binding.domains.push(domain);
		this.#bindings.set(domain, binding);

		// Registering is what makes a provider with no `initialize` ready, so realize it now.
		void binding.provider;

		if (previous && previous !== binding) await this.#release(previous, domain);

		return binding.initialize(this.#context);
	}

	setContext(context: EvaluationContext): void {
		this.#context = { ...context };
	}

	addHooks(...hooks: Hook[]): void {
		this.apiHooks.push(...hooks);
	}

	addHandler(event: ProviderEvent, handler: EventHandler): void {
		let binding = this.binding();
		this.#handlers.add(event, handler, binding.status, binding.provider.metadata.name);
	}

	removeHandler(event: ProviderEvent, handler: EventHandler): void {
		this.#handlers.remove(event, handler);
	}

	setTransactionContextPropagator(propagator: TransactionContextPropagator): void {
		this.#propagator = propagator;
	}

	setTransactionContext<T>(context: EvaluationContext, callback: () => T): T {
		if (!this.#propagator) return callback();
		return this.#propagator.setTransactionContext(context, callback);
	}

	async ready(): Promise<void> {
		await Promise.all(
			[...new Set(this.#bindings.values())].map((one) => one.initialize(this.#context)),
		);
	}

	async shutdown(): Promise<Result<void, ProviderError>> {
		let error: ProviderError | undefined;

		for (let binding of new Set(this.#bindings.values())) {
			let outcome = await binding.shutdown();
			if (isFailure(outcome)) error ??= outcome.error;
		}

		this.#reset();

		return error ? failure(error) : success(undefined);
	}

	binding(domain?: string): Binding {
		let binding = this.#bindings.get(domain) ?? this.#bindings.get(undefined);
		if (!binding) throw new ProviderError("GENERAL", "The API instance has no default binding.");
		return binding;
	}

	globalContext(): EvaluationContext {
		return this.#context;
	}

	transactionContext(): EvaluationContext | undefined {
		return this.#propagator?.getTransactionContext();
	}

	/**
	 * Status first, handlers second, so a handler woken by an event never reads a
	 * status that disagrees with it.
	 */
	#announce(binding: Binding, event: ProviderEvent, details: ProviderEventDetails): void {
		binding.status = statusFor(event, details, binding.status);

		let payload: EventDetails = { ...details, providerName: binding.provider.metadata.name };

		this.#handlers.run(event, payload);

		for (let scope of this.#scopes.values()) {
			if (this.binding(scope.domain) === binding) scope.handlers.run(event, payload);
		}
	}

	/** Drops `domain` from `binding`, shutting the provider down once nothing points at it. */
	async #release(binding: Binding, domain: string | undefined): Promise<void> {
		let at = binding.domains.indexOf(domain);
		if (at >= 0) binding.domains.splice(at, 1);
		if (binding.domains.length === 0) await binding.shutdown();
	}

	#scope(domain?: string): Scope {
		let scope = this.#scopes.get(domain);
		if (!scope) {
			scope = { domain, hooks: [], handlers: new Handlers() };
			this.#scopes.set(domain, scope);
		}
		return scope;
	}

	#bindingOf(provider: Provider): Binding | undefined {
		for (let binding of this.#bindings.values()) {
			if (binding.started && binding.provider === provider) return binding;
		}
		return undefined;
	}

	#install(factory?: () => Provider): void {
		let placeholder = factory === undefined;
		let binding = new Binding(
			factory ?? (() => new NoopProvider()),
			(...args) => this.#announce(...args),
			placeholder,
		);

		binding.domains.push(undefined);
		this.#bindings.set(undefined, binding);
	}

	/** Everything configured is gone, and evaluation answers defaults again. */
	#reset(): void {
		this.#bindings.clear();
		this.#scopes.clear();
		this.#clients.clear();
		this.#handlers.clear();
		this.apiHooks = [];
		this.#context = {};
		this.#propagator = undefined;
		this.#install();
	}
}
