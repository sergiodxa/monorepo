/**
 * The provider's emitter: who hears an event, who stops hearing it, and what
 * one listener's failure costs the others.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { expect, test, vi } from "vitest";

import { ProviderEvents } from "./events.js";

test("Requirement 5.1.1 — a provider signals an event to everything listening for it", () => {
	let events = new ProviderEvents();
	let ready = vi.fn();
	let stale = vi.fn();

	events.on("PROVIDER_READY", ready);
	events.on("PROVIDER_STALE", stale);
	events.emit("PROVIDER_READY");

	expect(ready).toHaveBeenCalledWith({});
	expect(stale).not.toHaveBeenCalled();
});

test("hands the listener the details the provider emitted", () => {
	let events = new ProviderEvents();
	let handler = vi.fn();

	events.on("PROVIDER_ERROR", handler);
	events.emit("PROVIDER_ERROR", { errorCode: "PROVIDER_FATAL", message: "Gone." });

	expect(handler).toHaveBeenCalledWith({ errorCode: "PROVIDER_FATAL", message: "Gone." });
});

test("calls a listener added twice once per emission", () => {
	let events = new ProviderEvents();
	let handler = vi.fn();

	events.on("PROVIDER_READY", handler);
	events.on("PROVIDER_READY", handler);
	events.emit("PROVIDER_READY");

	expect(handler).toHaveBeenCalledTimes(1);
});

test("stops calling a listener that was removed", () => {
	let events = new ProviderEvents();
	let handler = vi.fn();

	events.on("PROVIDER_STALE", handler);
	events.off("PROVIDER_STALE", handler);
	events.emit("PROVIDER_STALE");

	expect(handler).not.toHaveBeenCalled();
});

test("removing a listener that was never added leaves the rest alone", () => {
	let events = new ProviderEvents();
	let handler = vi.fn();

	events.on("PROVIDER_READY", handler);
	events.off("PROVIDER_READY", vi.fn());
	events.off("PROVIDER_ERROR", handler);
	events.emit("PROVIDER_READY");

	expect(handler).toHaveBeenCalledTimes(1);
});

test("a listener that throws does not cost the others the event", () => {
	let events = new ProviderEvents();
	let after = vi.fn();

	events.on("PROVIDER_READY", () => {
		throw new Error("Listener failed.");
	});
	events.on("PROVIDER_READY", after);

	expect(() => events.emit("PROVIDER_READY")).not.toThrow();
	expect(after).toHaveBeenCalledTimes(1);
});

test("emitting an event nothing listens for does nothing", () => {
	expect(() => new ProviderEvents().emit("PROVIDER_CONFIGURATION_CHANGED")).not.toThrow();
});

test("a listener added during an emission waits for the next one", () => {
	let events = new ProviderEvents();
	let late = vi.fn();

	events.on("PROVIDER_READY", () => events.on("PROVIDER_READY", late));
	events.emit("PROVIDER_READY");

	expect(late).not.toHaveBeenCalled();

	events.emit("PROVIDER_READY");

	expect(late).toHaveBeenCalledTimes(1);
});
