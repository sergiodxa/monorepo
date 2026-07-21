/**
 * The insert/remove lifecycle bookkeeping a mixin repeats on its own before
 * it can read or write anything on its own host element from outside its
 * render callback — a document-level listener, an observer callback, a
 * queued task — since the host node doesn't exist yet while a mixin's setup
 * function runs, and stops existing again once the host unmounts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinHandle } from "remix/ui";

/**
 * Caches the DOM node behind a mixin's own host element for as long as it
 * stays mounted. `handle`'s `insert` event records the freshly mounted node,
 * and its `remove` event clears the cache again, so a listener or callback a
 * mixin sets up once during its setup function — before any host node
 * exists — can still read whichever node is currently mounted through the
 * returned getter, or `undefined` while the host is unmounted.
 *
 * @param handle Mixin handle to track the host node of.
 * @returns A getter returning the currently mounted host node, or `undefined` while unmounted.
 * @example
 * export const example = createMixin<HTMLElement>((handle) => {
 * 	let hostNode = trackHostNode(handle);
 *
 * 	addEventListeners(document, handle.signal, {
 * 		keydown() {
 * 			let node = hostNode();
 * 			if (node === undefined) return;
 * 			// ...
 * 		},
 * 	});
 *
 * 	return () => {};
 * });
 */
export function trackHostNode<node extends EventTarget = Element>(
	handle: MixinHandle<node>,
): () => node | undefined {
	let hostNode: node | undefined;

	handle.addEventListener("insert", (event) => {
		hostNode = event.node;
	});
	handle.addEventListener("remove", () => {
		hostNode = undefined;
	});

	return () => hostNode;
}
