/**
 * The evaluation API an application calls: `createFlags`, the client it hands
 * out, and the hooks this package ships.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { Flags, FlagsOptions } from "./registry.js";
export type { TransactionContextPropagator } from "./propagator.js";

export { createFlags } from "./registry.js";
export { asyncLocalStoragePropagator } from "./propagator.js";
export { redactHook } from "./hooks/redact.js";
export { wideEventHook } from "./hooks/wide-event.js";
