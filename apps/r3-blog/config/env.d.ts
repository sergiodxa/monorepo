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
