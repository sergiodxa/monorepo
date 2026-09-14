/**
 * Everything it takes to supply flag values: the interface a flag system
 * implements, and the kit for writing one — the two answer helpers, the typed
 * emitter and the error that carries a code.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { ResolvedDetails } from "./details.js";
export type { ProviderEventHandler } from "./events.js";
export type { Provider } from "./provider.js";

export { failed, resolved } from "./details.js";
export { ProviderError } from "./error.js";
export { ProviderEvents } from "./events.js";
