/**
 * Public entry point for the KV session storage package. Re-exports the KV store
 * contract and the KV-backed `SessionStorage` implementation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { KVStore } from "./kv-store";
export { KVSessionStorage } from "./kv-session-storage";
