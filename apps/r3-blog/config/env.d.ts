/**
 * Ambient type declarations for the r3-blog application environment. Augments the
 * global `App.Env` interface with the resolved secrets, flags, and KV-backed
 * bindings that request middleware injects into the router's request context.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { KVStore } from "../app/contracts/kv-store";

declare global {
	namespace App {
		interface Env {
			IS_PROD: boolean;
			CLIENT_ID: string;
			CLIENT_SECRET: string;
			COOKIE_SESSION_SECRET: string;
			AUTH: KVStore;
			REDIRECTS: KVStore;
		}
	}
}

/**
 * Re-exports module members.
 */
export {};
