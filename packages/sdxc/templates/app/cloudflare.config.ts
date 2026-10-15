/**
 * Cloudflare configuration for the Worker, read by `cf` and the Vite plugin alike. Every
 * binding and trigger the app reads is declared here, so `bun cf:typegen` types `env` from
 * this file and local development simulates exactly what production provides.
 */

import { bindings, defineConfig, triggers } from "cf/config";

import manifest from "./package.json" with { type: "json" };

export default defineConfig({
	worker: {
		name: manifest.name,
		compatibilityDate: "2026-09-02",
		compatibilityFlags: ["nodejs_compat"],
		entrypoint: "./bootstrap/worker.ts",
		observability: { enabled: true },
		/**
		 * A queue has exactly one consumer, so this Worker owns the role: every job the
		 * dispatcher enqueues is delivered back here and run through the same dispatcher.
		 */
		triggers: [triggers.queue({ name: manifest.name })],
		env: {
			/** Where the job dispatcher enqueues; `cf queues create <name>` before the first deploy. */
			QUEUE: bindings.queue({ name: manifest.name }),
		},
	},
});
