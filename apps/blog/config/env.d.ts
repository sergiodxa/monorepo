/**
 * Ambient type declarations for the blog application environment. Augments the
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
			/**
			 * The platform binding rather than the app's `KVStore` contract, because its only
			 * consumer is `@pkg/kv-cache`, which needs the real namespace. The narrow contract
			 * exists to keep repositories and services off the binding; a cache is neither.
			 */
			CACHE: KVNamespace;
			/** Absent when the running deployment declares no `ratelimits` binding. */
			MCP_RATE_LIMITER: RateLimit | undefined;
			/** Lets a deferred write finish after the response has been sent. */
			waitUntil(promise: Promise<unknown>): void;
		}
	}
}

export {};
