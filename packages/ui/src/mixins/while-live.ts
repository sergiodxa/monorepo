/**
 * Ties a mixin's subscription to a model, session or frame to the time its host is live in a
 * document, so a mixin that renders on a server as well as in a browser subscribes only where
 * a node exists to update, with a real signal that detaches the listeners again.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinHandle } from "remix/component";

/**
 * Keeps `subscribe` bound to the latest target handed to the returned function while the host
 * is inserted: binding waits for insertion, so server rendering never subscribes, and a new
 * target detaches the previous one's listeners. Call it during setup, before `insert` listeners.
 *
 * @param handle Handle of the mixin whose host lifetime bounds every subscription.
 * @param subscribe Registers listeners on `target` with `signal`, which aborts once that target
 * is replaced or the mixin slot is disposed.
 * @returns A function the render callback calls with its current target.
 * @template target The model, session or frame the mixin listens to.
 * @template node The host element the mixin is applied to.
 * @example let follow = whileLive(handle, (model, signal) => model.addEventListener("change", sync, { signal }));
 */
export function whileLive<target extends object, node extends EventTarget = Element>(
	handle: MixinHandle<node>,
	subscribe: (target: target, signal: AbortSignal) => void,
): (target: target) => void {
	let lifetime = handle.signal;
	let live = false;
	let latest: target | undefined;
	let bound: target | undefined;
	let binding: AbortController | undefined;

	/** Subscribes to the latest target once the host is live and that target is not yet bound. */
	function bind(): void {
		if (!live || latest === undefined || latest === bound) return;

		binding?.abort();
		binding = new AbortController();
		bound = latest;
		subscribe(latest, AbortSignal.any([lifetime, binding.signal]));
	}

	handle.addEventListener("insert", () => {
		live = true;
		bind();
	});
	handle.addEventListener("remove", () => {
		live = false;
	});

	return (target) => {
		latest = target;
		bind();
	};
}
