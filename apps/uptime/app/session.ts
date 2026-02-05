import { env } from "cloudflare:workers";

import { createWorkersKVSessionStorage } from "~/vendor/create-worker-kv-session-storage";

import { session as cookie } from "./cookies";

export interface SessionData {
	id: string;
	name: string;
	email: string;
	avatar: string;
}

export const sessionStorage = createWorkersKVSessionStorage<SessionData>({
	kv: env.KV,
	cookie,
	prefix: "session:",
});
