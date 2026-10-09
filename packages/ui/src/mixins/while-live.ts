/**
 * Ties a subscription to a model, session, frame or global to the time a mixin's host or an
 * island component is live in a document, so code that renders on a server as well as in a
 * browser subscribes only in the browser, with a real signal that detaches the listeners.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, MixinHandle } from "remix/component";

/**
 * Keeps `subscribe` bound to the latest target handed to the returned function while the host
 * is inserted, or once an island component's first render commits: server rendering never
 * subscribes, and a new target detaches the previous one's listeners. Call it during setup.
 *
 * @param handle Handle of the mixin or island component whose lifetime bounds every subscription.
 * @param subscribe Registers listeners on `target` with `signal`, which aborts once that target
 * is replaced or the mixin slot or component is disposed.
 * @returns A function to call with the current target, from render or straight after setup.
 * @template target The model, session, frame or global being listened to.
 * @template node The host element a mixin is applied to.
 * @example let follow = whileLive(handle, (model, signal) => model.addEventListener("change", sync, { signal }));
 * @example whileLive(handle, (model: Toaster, signal) => model.addEventListener("change", () => void handle.update(), { signal }))(toaster);
 */
export function whileLive<target extends object, node extends EventTarget = Element>(
	handle: MixinHandle<node> | Pick<Handle, "signal" | "queueTask">,
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

	/** Marks the host or component live and binds whatever target arrived before it was. */
	function goLive(): void {
		live = true;
		bind();
	}

	if ("addEventListener" in handle) {
		handle.addEventListener("insert", goLive);
		handle.addEventListener("remove", () => {
			live = false;
		});
	} else {
		handle.queueTask(goLive);
	}

	return (target) => {
		latest = target;
		bind();
	};
}
