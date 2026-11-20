/**
 * The signal a part's listeners are removed with. A server render hands components a stand-in
 * for `handle.signal` that Cloudflare Workers refuse in `addEventListener`, so parts register
 * their listeners through this and render on every runtime.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

/**
 * The component's signal when it is a real `AbortSignal`, which it is once mounted in a browser,
 * else `undefined`: a server render never disconnects, so its listeners need no removal.
 *
 * @param handle - The component's handle.
 * @returns The signal to pass as `addEventListener`'s `signal` option.
 * @example model.addEventListener("change", update, { signal: listenerSignal(handle) });
 */
export function listenerSignal(handle: Pick<Handle, "signal">): AbortSignal | undefined {
	return handle.signal instanceof AbortSignal ? handle.signal : undefined;
}
