/**
 * The status machine and the handlers it drives: what each event leaves behind,
 * who hears about it, and when.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/types";

import { describe, expect, test } from "vitest";

import type { EventDetails } from "../core/status.js";

import { resolved } from "../provider/details.js";
import { ProviderEvents } from "../provider/events.js";

import { createFlags } from "./registry.js";

/** Announces nothing on its own, so a test emits exactly the transitions it is about. */
class Announcer {
	readonly metadata: { name: string };
	readonly events = new ProviderEvents();

	shutdowns = 0;

	#ready: boolean;

	constructor(name = "announcer", ready = true) {
		this.metadata = { name };
		this.#ready = ready;
	}

	async initialize(): Promise<void> {
		if (this.#ready) this.events.emit("PROVIDER_READY");
	}

	async shutdown(): Promise<void> {
		this.shutdowns++;
	}

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

/** No lifecycle at all, which the specification treats as ready from registration. */
class Immediate {
	readonly metadata = { name: "immediate" };

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

describe("provider status", () => {
	test("Requirement 1.7.1: the client reports one of the five statuses", async () => {
		let flags = createFlags();
		expect(flags.getClient().providerStatus).toBe("NOT_READY");

		let provider = new Announcer();
		await flags.setProvider(provider);
		expect(flags.getClient().providerStatus).toBe("READY");

		provider.events.emit("PROVIDER_STALE");
		expect(flags.getClient().providerStatus).toBe("STALE");

		provider.events.emit("PROVIDER_ERROR", { message: "the backend went away" });
		expect(flags.getClient().providerStatus).toBe("ERROR");

		provider.events.emit("PROVIDER_ERROR", { errorCode: "PROVIDER_FATAL" });
		expect(flags.getClient().providerStatus).toBe("FATAL");
	});

	test("Requirement 1.7.3: PROVIDER_READY leaves the status READY", async () => {
		let flags = createFlags();
		await flags.setProvider(new Announcer());

		expect(flags.getClient().providerStatus).toBe("READY");
	});

	test("Requirement 1.7.4: PROVIDER_ERROR leaves the status ERROR", async () => {
		let provider = new Announcer();
		let flags = createFlags();
		await flags.setProvider(provider);

		provider.events.emit("PROVIDER_ERROR", { message: "unreachable" });

		expect(flags.getClient().providerStatus).toBe("ERROR");
	});

	test("Requirement 1.7.5: PROVIDER_ERROR carrying PROVIDER_FATAL leaves the status FATAL", async () => {
		let provider = new Announcer();
		let flags = createFlags();
		await flags.setProvider(provider);

		provider.events.emit("PROVIDER_ERROR", {
			errorCode: "PROVIDER_FATAL",
			message: "bad credentials",
		});

		expect(flags.getClient().providerStatus).toBe("FATAL");
	});

	test("Requirement 1.7.6: the status is NOT_READY once the provider's shutdown terminates", async () => {
		let provider = new Announcer();
		let flags = createFlags();
		await flags.setProvider(provider);
		expect(flags.getClient().providerStatus).toBe("READY");

		await flags.shutdown();

		expect(provider.shutdowns).toBe(1);
		expect(flags.getClient().providerStatus).toBe("NOT_READY");
	});

	test("Requirement 2.8.5.1: a provider with no initialize is READY from registration", async () => {
		let seen: EventDetails[] = [];
		let flags = createFlags({ handlers: { PROVIDER_READY: (details) => void seen.push(details) } });

		await flags.setProvider(new Immediate());

		expect(flags.getClient().providerStatus).toBe("READY");
		expect(seen).toEqual([{ providerName: "immediate" }]);
	});

	test("a configuration change leaves the status alone", async () => {
		let provider = new Announcer();
		let flags = createFlags();
		await flags.setProvider(provider);

		provider.events.emit("PROVIDER_CONFIGURATION_CHANGED", { flagsChanged: ["new-checkout"] });

		expect(flags.getClient().providerStatus).toBe("READY");
	});

	test("evaluating through a provider that never became ready is PROVIDER_NOT_READY", async () => {
		let flags = createFlags();
		await flags.setProvider(new Announcer("silent", false));

		expect(await flags.getClient().booleanDetails("flag", false)).toMatchObject({
			value: false,
			reason: "ERROR",
			errorCode: "PROVIDER_NOT_READY",
		});
	});

	test("evaluating through a fatal provider is PROVIDER_FATAL", async () => {
		let provider = new Announcer();
		let flags = createFlags();
		await flags.setProvider(provider);

		provider.events.emit("PROVIDER_ERROR", { errorCode: "PROVIDER_FATAL" });

		expect(await flags.getClient().booleanDetails("flag", true)).toMatchObject({
			value: true,
			reason: "ERROR",
			errorCode: "PROVIDER_FATAL",
		});
	});
});

describe("event handlers", () => {
	test("Requirement 5.1.2: a provider event runs the client and the API handlers", async () => {
		let log: string[] = [];
		let provider = new Announcer();
		let flags = createFlags();
		await flags.setProvider(provider);

		flags.addHandler("PROVIDER_STALE", () => void log.push("api"));
		flags.getClient().addHandler("PROVIDER_STALE", () => void log.push("client"));

		provider.events.emit("PROVIDER_STALE");

		expect(log).toEqual(["api", "client"]);
	});

	test("Requirement 5.1.3: handlers on a client bound elsewhere do not run", async () => {
		let log: string[] = [];
		let checkout = new Announcer("checkout");
		let flags = createFlags();
		await flags.setProvider("checkout", checkout);
		await flags.setProvider("digest", new Announcer("digest"));

		flags.getClient("digest").addHandler("PROVIDER_STALE", () => void log.push("digest"));
		flags.getClient("checkout").addHandler("PROVIDER_STALE", () => void log.push("checkout"));

		checkout.events.emit("PROVIDER_STALE");

		expect(log).toEqual(["checkout"]);
	});

	test("Requirement 5.2.1: the client associates a handler with an event type", async () => {
		let log: string[] = [];
		let provider = new Announcer();
		let flags = createFlags();
		await flags.setProvider(provider);

		flags.getClient().addHandler("PROVIDER_CONFIGURATION_CHANGED", () => void log.push("changed"));
		provider.events.emit("PROVIDER_CONFIGURATION_CHANGED");
		provider.events.emit("PROVIDER_STALE");

		expect(log).toEqual(["changed"]);
	});

	test("Requirement 5.2.2: the API associates a handler with an event type", async () => {
		let log: string[] = [];
		let provider = new Announcer();
		let flags = createFlags();
		await flags.setProvider(provider);

		flags.addHandler("PROVIDER_CONFIGURATION_CHANGED", () => void log.push("changed"));
		provider.events.emit("PROVIDER_CONFIGURATION_CHANGED");

		expect(log).toEqual(["changed"]);
	});

	test("Requirement 5.2.3: the event details name the provider the event came from", async () => {
		let seen: EventDetails | undefined;
		let provider = new Announcer("checkout");
		let flags = createFlags();
		await flags.setProvider(provider);

		flags.addHandler("PROVIDER_STALE", (details) => void (seen = details));
		provider.events.emit("PROVIDER_STALE");

		expect(seen?.providerName).toBe("checkout");
	});

	test("Requirement 5.2.4: a handler is given the event details the provider emitted", async () => {
		let seen: EventDetails | undefined;
		let provider = new Announcer();
		let flags = createFlags();
		await flags.setProvider(provider);

		flags.addHandler("PROVIDER_CONFIGURATION_CHANGED", (details) => void (seen = details));
		provider.events.emit("PROVIDER_CONFIGURATION_CHANGED", {
			flagsChanged: ["new-checkout"],
			eventMetadata: { source: "poll" },
		});

		expect(seen).toEqual({
			providerName: "announcer",
			flagsChanged: ["new-checkout"],
			eventMetadata: { source: "poll" },
		});
	});

	test("Requirement 5.2.5: a handler that throws leaves the others running", async () => {
		let log: string[] = [];
		let provider = new Announcer();
		let flags = createFlags();
		await flags.setProvider(provider);

		flags.addHandler("PROVIDER_STALE", () => {
			throw new Error("noisy handler");
		});
		flags.addHandler("PROVIDER_STALE", () => void log.push("still ran"));

		provider.events.emit("PROVIDER_STALE");

		expect(log).toEqual(["still ran"]);
	});

	test("Requirement 5.2.6: handlers persist across provider changes", async () => {
		let log: string[] = [];
		let flags = createFlags();

		flags.addHandler("PROVIDER_STALE", () => void log.push("heard"));

		let first = new Announcer("first");
		await flags.setProvider(first);
		first.events.emit("PROVIDER_STALE");

		let second = new Announcer("second");
		await flags.setProvider(second);
		second.events.emit("PROVIDER_STALE");

		expect(log).toEqual(["heard", "heard"]);
	});

	test("Requirement 5.2.7: the API and the client both remove handlers", async () => {
		let log: string[] = [];
		let provider = new Announcer();
		let flags = createFlags();
		await flags.setProvider(provider);

		let onApi = () => void log.push("api");
		let onClient = () => void log.push("client");

		flags.addHandler("PROVIDER_STALE", onApi);
		flags.getClient().addHandler("PROVIDER_STALE", onClient);
		flags.removeHandler("PROVIDER_STALE", onApi);
		flags.getClient().removeHandler("PROVIDER_STALE", onClient);

		provider.events.emit("PROVIDER_STALE");

		expect(log).toEqual([]);
	});

	test("Requirement 5.3.1: PROVIDER_READY runs the PROVIDER_READY handlers", async () => {
		let log: string[] = [];
		let flags = createFlags();

		flags.addHandler("PROVIDER_READY", () => void log.push("ready"));
		await flags.setProvider(new Announcer());

		expect(log).toEqual(["ready"]);
	});

	test("Requirement 5.3.2: PROVIDER_ERROR runs the PROVIDER_ERROR handlers", async () => {
		let log: string[] = [];
		let provider = new Announcer();
		let flags = createFlags();
		await flags.setProvider(provider);

		flags.addHandler("PROVIDER_ERROR", (details) => void log.push(details.message ?? ""));
		provider.events.emit("PROVIDER_ERROR", { message: "unreachable" });

		expect(log).toEqual(["unreachable"]);
	});

	test("Requirement 5.3.3: a handler attached after the state was reached runs immediately", async () => {
		let log: string[] = [];
		let flags = createFlags();
		await flags.setProvider(new Announcer());

		flags.addHandler("PROVIDER_READY", () => void log.push("api"));
		flags.getClient().addHandler("PROVIDER_READY", () => void log.push("client"));
		flags.addHandler("PROVIDER_STALE", () => void log.push("never"));

		expect(log).toEqual(["api", "client"]);
	});

	test("Requirement 5.3.5: the status is updated before the handlers for that event run", async () => {
		let seen: string[] = [];
		let provider = new Announcer();
		let flags = createFlags();
		await flags.setProvider(provider);

		flags.addHandler("PROVIDER_STALE", () => void seen.push(flags.getClient().providerStatus));
		flags.addHandler("PROVIDER_ERROR", () => void seen.push(flags.getClient().providerStatus));

		provider.events.emit("PROVIDER_STALE");
		provider.events.emit("PROVIDER_ERROR", { errorCode: "PROVIDER_FATAL" });

		expect(seen).toEqual(["STALE", "FATAL"]);
	});
});
