/**
 * The channel a provider announces its status transitions on, since the client
 * reads status from what it is told and never from a lifecycle call returning.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ProviderEvent, ProviderEventDetails } from "../core/status.js";

/** What a provider's own emitter calls when an event it declared occurs. */
export type ProviderEventHandler = (details: ProviderEventDetails) => void;

/**
 * A typed emitter a provider holds as a field and emits from — `PROVIDER_READY`
 * before `initialize` returns, `PROVIDER_ERROR` before it rejects, and the
 * others whenever the backing state changes underneath it.
 *
 * A listener that throws is on its own: the remaining listeners still run, so
 * one subscriber cannot cost another the event.
 *
 * @example
 * class MyProvider implements Provider {
 * 	readonly events = new ProviderEvents();
 * }
 */
export class ProviderEvents {
	#listeners = new Map<ProviderEvent, Set<ProviderEventHandler>>();

	/** Announces a transition to everything listening for it. */
	emit(event: ProviderEvent, details: ProviderEventDetails = {}): void {
		let listeners = this.#listeners.get(event);
		if (!listeners) return;

		// A snapshot, so a listener that subscribes or unsubscribes still lets this emission finish.
		for (let listener of new Set(listeners)) {
			try {
				listener(details);
			} catch {
				continue;
			}
		}
	}

	/** Starts calling `handler` for `event`. Adding the same handler twice calls it once. */
	on(event: ProviderEvent, handler: ProviderEventHandler): void {
		let listeners = this.#listeners.get(event);
		if (!listeners) {
			listeners = new Set();
			this.#listeners.set(event, listeners);
		}
		listeners.add(handler);
	}

	/** Stops calling `handler` for `event`, from the next emission onwards. */
	off(event: ProviderEvent, handler: ProviderEventHandler): void {
		this.#listeners.get(event)?.delete(handler);
	}
}
