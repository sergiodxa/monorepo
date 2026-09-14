/**
 * The status machine and the handler collection behind it: what each event
 * means for the status, and how handlers are stored, replayed and run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	EventDetails,
	EventHandler,
	ProviderEvent,
	ProviderEventDetails,
	ProviderStatus,
} from "../core/status.js";

/** Every event a provider may announce, which is what a binding subscribes to. */
export const PROVIDER_EVENTS: ProviderEvent[] = [
	"PROVIDER_READY",
	"PROVIDER_ERROR",
	"PROVIDER_CONFIGURATION_CHANGED",
	"PROVIDER_STALE",
];

/**
 * The status an event leaves behind. A configuration change says nothing about
 * readiness, so it keeps whatever status the provider already had.
 */
export function statusFor(
	event: ProviderEvent,
	details: ProviderEventDetails,
	current: ProviderStatus,
): ProviderStatus {
	if (event === "PROVIDER_READY") return "READY";
	if (event === "PROVIDER_STALE") return "STALE";
	if (event === "PROVIDER_ERROR") {
		return details.errorCode === "PROVIDER_FATAL" ? "FATAL" : "ERROR";
	}
	return current;
}

/** The status that means an event of this kind has already happened. */
function reached(event: ProviderEvent, status: ProviderStatus): boolean {
	if (event === "PROVIDER_READY") return status === "READY";
	if (event === "PROVIDER_STALE") return status === "STALE";
	if (event === "PROVIDER_ERROR") return status === "ERROR" || status === "FATAL";
	return false;
}

/**
 * Handlers for one scope — the API instance, or one client — kept by event so a
 * provider change never costs a subscriber its registration.
 */
export class Handlers {
	#byEvent = new Map<ProviderEvent, Set<EventHandler>>();

	/**
	 * Starts calling `handler` for `event`, and calls it right away when the
	 * status it waits for has already been reached, so a late subscriber is not
	 * left waiting for an event that will not come again.
	 */
	add(event: ProviderEvent, handler: EventHandler, status: ProviderStatus, name: string): void {
		let handlers = this.#byEvent.get(event);
		if (!handlers) {
			handlers = new Set();
			this.#byEvent.set(event, handlers);
		}
		handlers.add(handler);

		if (reached(event, status)) call(handler, { providerName: name });
	}

	remove(event: ProviderEvent, handler: EventHandler): void {
		this.#byEvent.get(event)?.delete(handler);
	}

	/** Runs everything listening for `event`; one handler throwing costs the others nothing. */
	run(event: ProviderEvent, details: EventDetails): void {
		let handlers = this.#byEvent.get(event);
		if (!handlers) return;

		for (let handler of new Set(handlers)) call(handler, details);
	}

	clear(): void {
		this.#byEvent.clear();
	}
}

function call(handler: EventHandler, details: EventDetails): void {
	try {
		handler(details);
	} catch {
		return;
	}
}
