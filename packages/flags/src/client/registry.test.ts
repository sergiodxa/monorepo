/**
 * The API instance: binding providers, handing out clients, and going back to
 * where it started.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/types";

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { EvaluationContext } from "../core/context.js";
import type { TrackingEventDetails } from "../core/tracking.js";

import { resolved } from "../provider/details.js";
import { ProviderEvents } from "../provider/events.js";

import { asyncLocalStoragePropagator } from "./propagator.js";
import { createFlags } from "./registry.js";

/** Records its own lifecycle, which is what the binding rules are asserted against. */
class Tracked {
	readonly metadata: { name: string };
	readonly events = new ProviderEvents();
	readonly domainScoped: boolean;

	initializations: (string | undefined)[] = [];
	shutdowns = 0;
	seen: EvaluationContext | undefined;
	tracked: { name: string; context: EvaluationContext; details?: TrackingEventDetails }[] = [];

	constructor(name = "tracked", domainScoped = false) {
		this.metadata = { name };
		this.domainScoped = domainScoped;
	}

	async initialize(_context: EvaluationContext, domain?: string): Promise<void> {
		this.initializations.push(domain);
		this.events.emit("PROVIDER_READY");
	}

	async shutdown(): Promise<void> {
		this.shutdowns++;
	}

	track(name: string, context: EvaluationContext, details?: TrackingEventDetails): void {
		this.tracked.push({ name, context, details });
	}

	resolveBoolean(_key: string, value: boolean, context: EvaluationContext) {
		this.seen = context;
		return resolved(value, { reason: "STATIC" });
	}
	resolveString(_key: string, value: string) {
		return resolved(value, { reason: "STATIC" });
	}
	resolveNumber(_key: string, value: number) {
		return resolved(value, { reason: "STATIC" });
	}
	resolveObject(_key: string, value: JSONValue) {
		return resolved(value, { reason: "STATIC" });
	}
}

/** Nothing to track, which is what the client has to survive without complaining. */
class Untracked {
	readonly metadata = { name: "untracked" };

	resolveBoolean(_key: string, value: boolean) {
		return resolved(value, { reason: "STATIC" });
	}
	resolveString(_key: string, value: string) {
		return resolved(value, { reason: "STATIC" });
	}
	resolveNumber(_key: string, value: number) {
		return resolved(value, { reason: "STATIC" });
	}
	resolveObject(_key: string, value: JSONValue) {
		return resolved(value, { reason: "STATIC" });
	}
}

describe("the provider mutator", () => {
	test("Requirement 1.1.2.1: the API sets the default provider", async () => {
		let flags = createFlags();
		let outcome = await flags.setProvider(new Tracked("default"));

		expect(isSuccess(outcome)).toBe(true);
		expect(flags.providerMetadata().name).toBe("default");
	});

	test("Requirement 1.1.2.2: setting a provider initializes it, with the domain it was bound to", async () => {
		let provider = new Tracked();
		let flags = createFlags();

		await flags.setProvider("checkout", provider);

		expect(provider.initializations).toEqual(["checkout"]);
		expect(flags.getClient("checkout").providerStatus).toBe("READY");
	});

	test("Requirement 1.1.2.3: the provider that was replaced is shut down", async () => {
		let first = new Tracked("first");
		let flags = createFlags();

		await flags.setProvider(first);
		await flags.setProvider(new Tracked("second"));

		expect(first.shutdowns).toBe(1);
		expect(flags.providerMetadata().name).toBe("second");
	});

	test("Requirement 1.1.2.3: a provider on several domains is shut down when the last one lets go", async () => {
		let shared = new Tracked("shared");
		let flags = createFlags();

		await flags.setProvider("checkout", shared);
		await flags.setProvider("digest", shared);

		await flags.setProvider("checkout", new Tracked("other"));
		expect(shared.shutdowns).toBe(0);

		await flags.setProvider("digest", new Tracked("another"));
		expect(shared.shutdowns).toBe(1);
	});

	test("Requirement 1.1.3: a provider binds to a domain, and a second binding overwrites it", async () => {
		let flags = createFlags();

		await flags.setProvider("checkout", new Tracked("first"));
		expect(flags.providerMetadata("checkout").name).toBe("first");

		await flags.setProvider("checkout", new Tracked("second"));
		expect(flags.providerMetadata("checkout").name).toBe("second");
	});

	test("Requirement 1.1.8.1: a domain-scoped provider is refused a second domain", async () => {
		let provider = new Tracked("scoped", true);
		let flags = createFlags();

		expect(isSuccess(await flags.setProvider("checkout", provider))).toBe(true);

		let outcome = await flags.setProvider("digest", provider);

		expect(isFailure(outcome)).toBe(true);
		expect(flags.providerMetadata("digest").name).not.toBe("scoped");
	});

	test("a provider bound to several domains is initialized once, with the first domain", async () => {
		let shared = new Tracked("shared");
		let flags = createFlags();

		await flags.setProvider("checkout", shared);
		await flags.setProvider("digest", shared);

		expect(shared.initializations).toEqual(["checkout"]);
		expect(flags.getClient("digest").providerStatus).toBe("READY");
	});

	test("Requirement 1.1.5: the API reports the configured provider's metadata", async () => {
		let flags = createFlags();
		expect(flags.providerMetadata().name).toBe("No-op Provider");

		await flags.setProvider(new Tracked("checkout-flags"));

		expect(flags.providerMetadata().name).toBe("checkout-flags");
	});
});

describe("clients", () => {
	test("Requirement 1.1.6: the API creates a client, optionally for a domain", async () => {
		let flags = createFlags();
		await flags.setProvider(new Tracked());

		expect(flags.getClient().metadata.domain).toBeUndefined();
		expect(flags.getClient("checkout").metadata.domain).toBe("checkout");
	});

	test("Requirement 1.1.7: creating a client never throws, even with no provider set", () => {
		let flags = createFlags();

		expect(() => flags.getClient()).not.toThrow();
		expect(() => flags.getClient("never-bound")).not.toThrow();
	});

	test("Requirement 1.2.1: the client adds hooks without losing the ones already there", async () => {
		let log: string[] = [];
		let flags = createFlags();
		await flags.setProvider(new Tracked());

		let client = flags.getClient();
		client.addHooks({ before: () => void log.push("first") });
		client.addHooks({ before: () => void log.push("second") });

		await client.boolean("flag", false);

		expect(log).toEqual(["first", "second"]);
	});

	test("Requirement 1.2.2: the client metadata carries the domain it was created with", async () => {
		let flags = createFlags();
		await flags.setProvider(new Tracked());

		expect(flags.getClient("checkout").metadata).toEqual({ domain: "checkout" });
	});
});

describe("shutdown", () => {
	test("Requirement 1.6.1: shutdown reaches every registered provider", async () => {
		let first = new Tracked("first");
		let second = new Tracked("second");
		let flags = createFlags();

		await flags.setProvider(first);
		await flags.setProvider("digest", second);

		expect(isSuccess(await flags.shutdown())).toBe(true);
		expect(first.shutdowns).toBe(1);
		expect(second.shutdowns).toBe(1);
	});

	test("Requirement 1.6.2: shutdown resets the hooks, handlers, context, propagator and providers", async () => {
		let log: string[] = [];
		let flags = createFlags({
			context: { plan: "pro" },
			hooks: [{ before: () => void log.push("api hook") }],
			handlers: { PROVIDER_STALE: () => void log.push("handler") },
			propagator: asyncLocalStoragePropagator(),
		});
		await flags.setProvider(new Tracked());
		flags.getClient().addHooks({ before: () => void log.push("client hook") });

		await flags.shutdown();

		expect(flags.providerMetadata().name).toBe("No-op Provider");

		let provider = new Tracked("after");
		await flags.setProvider(provider);
		provider.events.emit("PROVIDER_STALE");

		await flags.setTransactionContext({ transaction: true }, () =>
			flags.getClient().boolean("flag", false),
		);

		expect(log).toEqual([]);
		expect(provider.seen).toEqual({});
	});

	test("Requirement 1.6.2: the reset instance evaluates through the no-op provider again", async () => {
		let flags = createFlags();
		await flags.setProvider(new Tracked());
		await flags.shutdown();

		expect(await flags.getClient().booleanDetails("flag", true)).toMatchObject({
			value: true,
			reason: "DEFAULT",
		});
	});
});

describe("isolated instances", () => {
	test("Requirement 1.8.1: the factory returns a new, independent instance every time", async () => {
		let one = createFlags();
		let other = createFlags();

		await one.setProvider(new Tracked("one"));

		expect(one.providerMetadata().name).toBe("one");
		expect(other.providerMetadata().name).toBe("No-op Provider");
	});

	test("Requirement 1.8.2: an instance covers evaluation, providers, context, hooks, events and shutdown", async () => {
		let log: string[] = [];
		let provider = new Tracked();
		let flags = createFlags();

		flags.addHooks({ before: () => void log.push("hook") });
		flags.addHandler("PROVIDER_READY", () => void log.push("ready"));
		flags.setContext({ plan: "pro" });
		flags.setTransactionContextPropagator(asyncLocalStoragePropagator());

		await flags.setProvider(provider);
		await flags.ready();

		expect(await flags.getClient().boolean("flag", true)).toBe(true);
		expect(log).toEqual(["ready", "hook"]);
		expect(isSuccess(await flags.shutdown())).toBe(true);
	});

	test("Requirement 1.1.4: the API adds hooks without losing the ones already there", async () => {
		let log: string[] = [];
		let flags = createFlags({ hooks: [{ before: () => void log.push("seeded") }] });
		await flags.setProvider(new Tracked());

		flags.addHooks({ before: () => void log.push("added") });

		await flags.getClient().boolean("flag", false);

		expect(log).toEqual(["seeded", "added"]);
	});

	test("the provider callback runs no earlier than the first evaluation", async () => {
		let built = 0;
		let flags = createFlags({
			provider: () => {
				built++;
				return new Untracked();
			},
		});

		expect(built).toBe(0);

		await flags.getClient().boolean("flag", true);

		expect(built).toBe(1);
	});
});

describe("tracking", () => {
	test("Requirement 6.1.1.1: track takes a name, a context and details, and returns nothing", async () => {
		let provider = new Tracked();
		let flags = createFlags();
		await flags.setProvider(provider);

		expect(
			flags.getClient().track("checkout-completed", { targetingKey: "u" }, { value: 42 }),
		).toBe(undefined);
		expect(provider.tracked.at(0)).toMatchObject({
			name: "checkout-completed",
			details: { value: 42 },
		});
	});

	test("Requirement 6.1.3: the tracking context merges API, transaction, client and invocation", async () => {
		let provider = new Tracked();
		let flags = createFlags({
			context: { level: "api", api: true },
			propagator: asyncLocalStoragePropagator(),
		});
		await flags.setProvider(provider);

		let client = flags.getClient(undefined, { level: "client", client: true });

		flags.setTransactionContext({ level: "transaction", transaction: true }, () =>
			client.track("checkout-completed", { level: "invocation", invocation: true }),
		);

		expect(provider.tracked.at(0)?.context).toEqual({
			level: "invocation",
			api: true,
			transaction: true,
			client: true,
			invocation: true,
		});
	});

	test("Requirement 6.1.4: track no-ops when the provider does not implement tracking", async () => {
		let flags = createFlags();
		await flags.setProvider(new Untracked());

		expect(() => flags.getClient().track("checkout-completed")).not.toThrow();
	});

	test("Requirement 6.2.1: the tracking details carry an optional numeric value", async () => {
		let provider = new Tracked();
		let flags = createFlags();
		await flags.setProvider(provider);

		flags.getClient().track("cart-checked-out", undefined, { value: 129.5 });
		flags.getClient().track("page-viewed");

		expect(provider.tracked.at(0)?.details).toEqual({ value: 129.5 });
		expect(provider.tracked.at(1)?.details).toBeUndefined();
	});

	test("Requirement 6.2.2: the tracking details carry arbitrary custom fields", async () => {
		let provider = new Tracked();
		let flags = createFlags();
		await flags.setProvider(provider);

		flags.getClient().track("cart-checked-out", undefined, {
			value: 1,
			currency: "usd",
			gift: true,
			items: [{ sku: "a" }],
		});

		expect(provider.tracked.at(0)?.details).toEqual({
			value: 1,
			currency: "usd",
			gift: true,
			items: [{ sku: "a" }],
		});
	});
});
