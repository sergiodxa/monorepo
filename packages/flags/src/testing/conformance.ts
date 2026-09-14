/**
 * The suite every provider runs, whether it ships here or in an application:
 * resolver behavior, lifecycle emission, idempotent shutdown and the
 * domain-scoped binding rejection.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test, vi } from "vitest";

import type { EvaluationContext } from "../core/context.js";
import type { ResolutionDetails } from "../core/details.js";
import type { FlagValue, FlagValueType, MaybePromise } from "../core/value.js";
import type { FlagConfiguration, FlagSet } from "../provider/memory.js";
import type { Provider } from "../provider/provider.js";

import { createFlags } from "../client/index.js";

/** What the suite needs to exercise a provider beyond constructing it. */
export interface ConformanceOptions {
	/**
	 * The flags the provider serves, which is what lets the suite ask for a value
	 * it can check and for a type the flag does not hold. A provider backed by no
	 * flag set answers every key with the default it was handed, so it leaves this
	 * out and the resolution assertions go to the providers that can meet them.
	 */
	flags?: FlagSet;

	/**
	 * The provider prepares itself in `initialize` and releases it in `shutdown`.
	 * Declaring it registers the lifecycle group, which is where the readiness
	 * emission a provider is likeliest to leave out gets checked.
	 */
	lifecycle?: boolean;

	/**
	 * Builds the provider in a state its `initialize` rejects from — a flag set it
	 * cannot serve, an endpoint it cannot reach. A provider whose preparation is
	 * local and total cannot be made to fail, and leaves this out.
	 */
	failing?: () => Provider | Promise<Provider>;

	/** The provider implements `track`, so the suite drives it the way a client does. */
	tracking?: boolean;
}

/** One of the four typed resolvers, as the suite drives it. */
interface Resolver {
	type: FlagValueType;
	/** The default value every call hands over, and therefore what a failure answers with. */
	fallback: FlagValue;
	resolve(
		provider: Provider,
		key: string,
		context: EvaluationContext,
	): MaybePromise<ResolutionDetails<FlagValue>>;
	holds(value: FlagValue): boolean;
}

const RESOLVERS: Resolver[] = [
	{
		type: "boolean",
		fallback: false,
		resolve: (provider, key, context) => provider.resolveBoolean(key, false, context),
		holds: (value) => typeof value === "boolean",
	},
	{
		type: "string",
		fallback: "conformance-default",
		resolve: (provider, key, context) =>
			provider.resolveString(key, "conformance-default", context),
		holds: (value) => typeof value === "string",
	},
	{
		type: "number",
		fallback: -1,
		resolve: (provider, key, context) => provider.resolveNumber(key, -1, context),
		holds: (value) => typeof value === "number",
	},
	{
		type: "object",
		fallback: { conformance: "default" },
		resolve: (provider, key, context) =>
			provider.resolveObject(key, { conformance: "default" }, context),
		holds: (value) => typeof value === "object" && value !== null,
	},
];

/** A flag of a known type, and the value asking for it is supposed to produce. */
interface Fixture {
	key: string;
	value: FlagValue;
}

/** What a flag serves when nothing targets it, which is what a resolution answers with. */
function serves(flag: FlagConfiguration): FlagValue | undefined {
	if (flag.disabled) return undefined;
	return flag.variants[flag.defaultVariant];
}

/**
 * One flag per type, so every resolver has a flag it can answer for and the
 * other three have a flag they have to refuse.
 */
function fixtures(flags: FlagSet): Map<FlagValueType, Fixture> {
	let found = new Map<FlagValueType, Fixture>();

	for (let [key, flag] of Object.entries(flags)) {
		let value = serves(flag);
		if (value === undefined) continue;

		let resolver = RESOLVERS.find((one) => one.holds(value));
		if (resolver && !found.has(resolver.type)) found.set(resolver.type, { key, value });
	}

	return found;
}

/** A key nothing has a flag for, fresh every call so a shared backend cannot collide. */
function absent(): string {
	return `conformance-absent-${crypto.randomUUID()}`;
}

/**
 * A context a provider has no business trusting: a targeting key that is empty,
 * a field that throws when it is read, a name that looks like a prototype and a
 * cycle that defeats serializing it.
 */
function hostile(): EvaluationContext {
	let context: EvaluationContext = {
		targetingKey: "",
		when: new Date(0),
		["__proto__"]: "a field, not a prototype",
		nested: { deeply: { untyped: null } },
	};

	Object.defineProperty(context, "unreadable", {
		enumerable: true,
		get() {
			throw new Error("This context field refuses to be read.");
		},
	});

	Object.defineProperty(context, "cyclic", { enumerable: true, value: context });

	return context;
}

/**
 * The provider under test declaring the scope that makes a second binding
 * illegal. Declaring it on a delegate rather than asking providers to declare it
 * themselves is what lets every one of them be held to the rejection.
 */
function scoped(provider: Provider): Provider {
	return {
		metadata: provider.metadata,
		hooks: provider.hooks,
		events: provider.events,
		domainScoped: true,
		resolveBoolean: provider.resolveBoolean.bind(provider),
		resolveString: provider.resolveString.bind(provider),
		resolveNumber: provider.resolveNumber.bind(provider),
		resolveObject: provider.resolveObject.bind(provider),
		initialize: provider.initialize?.bind(provider),
		shutdown: provider.shutdown?.bind(provider),
		track: provider.track?.bind(provider),
	};
}

/**
 * Registers the suite every provider has to pass: it never throws from a
 * resolver, it names a failure with the code the specification gives it, and it
 * survives its lifecycle being run twice.
 *
 * @param name The provider's name, which labels the registered suite.
 * @param create Builds the provider under test, called once per test so state starts clean.
 * @param options What the provider serves, and which parts of the contract it implements.
 *
 * @example conformance("my-provider", () => new MyProvider(FLAGS), { flags: FLAGS });
 */
export function conformance(
	name: string,
	create: () => Provider | Promise<Provider>,
	options: ConformanceOptions,
): void {
	let served = fixtures(options.flags ?? {});

	/** The provider, prepared the way registering it with an API instance prepares it. */
	let start = async (): Promise<Provider> => {
		let provider = await create();
		await provider.initialize?.({});
		return provider;
	};

	describe(`${name} conformance`, () => {
		describe("metadata", () => {
			test("Requirement 2.1.1 — identifies the implementation by a non-empty name", async () => {
				let provider = await create();

				expect(typeof provider.metadata.name).toBe("string");
				expect(provider.metadata.name.length).toBeGreaterThan(0);
			});
		});

		if (served.size > 0) {
			describe("resolution", () => {
				for (let resolver of RESOLVERS) {
					let fixture = served.get(resolver.type);
					if (!fixture) continue;

					let { key, value } = fixture;

					test(`answers the ${resolver.type} flag with the value it serves`, async () => {
						let provider = await start();
						let details = await resolver.resolve(provider, key, {});

						expect(details.value).toStrictEqual(value);
						expect(details.errorCode).toBeUndefined();
					});
				}
			});
		}

		describe("abnormal execution", () => {
			for (let resolver of RESOLVERS) {
				test(`the ${resolver.type} resolver answers instead of throwing`, async () => {
					let provider = await start();
					let mismatched = [...served.values()].find((one) => !resolver.holds(one.value));
					let known = served.get(resolver.type);

					let answers = [
						await resolver.resolve(provider, absent(), {}),
						await resolver.resolve(provider, mismatched?.key ?? absent(), {}),
						await resolver.resolve(provider, known?.key ?? absent(), hostile()),
					];

					for (let answer of answers) expect(answer).toHaveProperty("value");
				});
			}

			if (options.flags) {
				test("answers FLAG_NOT_FOUND for a key it has no flag for", async () => {
					let provider = await start();

					for (let resolver of RESOLVERS) {
						expect(await resolver.resolve(provider, absent(), {}), resolver.type).toMatchObject({
							errorCode: "FLAG_NOT_FOUND",
						});
					}
				});

				test("Requirement 2.2.7 — a failure answers with the default value and reason ERROR", async () => {
					let provider = await start();

					for (let resolver of RESOLVERS) {
						let details = await resolver.resolve(provider, absent(), {});

						expect(details.value, resolver.type).toStrictEqual(resolver.fallback);
						expect(details.reason, resolver.type).toBe("ERROR");
						expect(details.errorCode, resolver.type).toBeDefined();
					}
				});

				for (let resolver of RESOLVERS) {
					let mismatched = [...served.values()].find((one) => !resolver.holds(one.value));
					if (!mismatched) continue;

					let { key } = mismatched;

					test(`answers TYPE_MISMATCH when the flag holds no ${resolver.type}`, async () => {
						let provider = await start();

						expect(await resolver.resolve(provider, key, {})).toMatchObject({
							value: resolver.fallback,
							reason: "ERROR",
							errorCode: "TYPE_MISMATCH",
						});
					});
				}
			}
		});

		if (options.lifecycle) {
			describe("lifecycle", () => {
				test("Requirement 2.8.2 — emits PROVIDER_READY before initialize returns", async () => {
					let provider = await create();
					let ready = vi.fn();

					expect(provider.events, "a lifecycle is announced on an emitter").toBeDefined();
					provider.events?.on("PROVIDER_READY", ready);
					await provider.initialize?.({});

					expect(ready).toHaveBeenCalled();
				});

				test("Requirement 2.5.2 — reverts to its uninitialized state, and starts again", async () => {
					let provider = await start();
					let ready = vi.fn();

					await provider.shutdown?.();
					provider.events?.on("PROVIDER_READY", ready);
					await provider.initialize?.({});

					expect(ready).toHaveBeenCalled();
				});

				test("Requirement 2.5.3 — shutting down twice does nothing the second time", async () => {
					let provider = await start();

					expect(typeof provider.shutdown, "a lifecycle releases what it took").toBe("function");
					await provider.shutdown?.();

					await expect(provider.shutdown?.()).resolves.toBeUndefined();
				});

				if (options.failing) {
					let failing = options.failing;

					test("Requirement 2.8.3 — emits PROVIDER_ERROR before initialize rejects", async () => {
						let provider = await failing();
						let error = vi.fn();

						expect(typeof provider.initialize, "a preparation that fails is one that runs").toBe(
							"function",
						);
						provider.events?.on("PROVIDER_ERROR", error);

						await expect(provider.initialize?.({})).rejects.toThrow();
						expect(error).toHaveBeenCalled();
					});
				}
			});
		}

		if (options.tracking) {
			describe("tracking", () => {
				test("records an occurrence, answering nothing and throwing nothing", async () => {
					let provider = await start();

					expect(typeof provider.track, "declaring tracking means implementing it").toBe(
						"function",
					);
					expect(
						provider.track?.("checkout-completed", { targetingKey: "user-1" }),
					).toBeUndefined();
					expect(
						provider.track?.("checkout-completed", hostile(), { value: 42, currency: "USD" }),
					).toBeUndefined();
				});
			});
		}

		describe("registration", () => {
			test("Requirement 2.4.4 — a domain-scoped instance is bound to one domain only", async () => {
				let flags = createFlags();
				let provider = scoped(await create());

				let first = await flags.setProvider("checkout", provider);
				let second = await flags.setProvider("billing", provider);

				expect(isSuccess(first), "the domain it was registered under binds").toBe(true);
				expect(isFailure(second), "a second domain is refused").toBe(true);
			});
		});
	});
}
