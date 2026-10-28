/**
 * Cloudflare deployment for the package-backed micro-APIs Worker. No storage bindings —
 * every request is pure compute settled through x402.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bindings, defineConfig } from "cf/config";

export default defineConfig({
	worker: {
		name: "sdxc-api",
		compatibilityDate: "2026-09-02",
		compatibilityFlags: ["nodejs_compat"],
		entrypoint: "./bootstrap/worker.ts",
		workersDev: true,
		placement: { mode: "smart" },
		observability: {
			enabled: true,
			traces: { enabled: true, headSamplingRate: 0.1 },
		},
		domains: ["api.sdxc.dev"],
		env: {
			/** Receive wallet for settled payments. */
			X402_PAY_TO: bindings.secret(),
			/**
			 * Facilitator base URL. Empty or `memory` uses the in-memory facilitator
			 * (local and tests only).
			 */
			X402_FACILITATOR_URL: bindings.secret(),
			/** CAIP-2 network id, e.g. `eip155:84532` or `eip155:8453`. */
			X402_NETWORK: bindings.secret(),
			/** Asset contract charged (USDC on the configured network). */
			X402_ASSET: bindings.secret(),
			/**
			 * Operator free pass. Send `Authorization: Bearer <value>` on priced
			 * HTTP or MCP calls to skip x402. Mint with `randomToken({ prefix: "owner" })`.
			 */
			OWNER_ACCESS_TOKEN: bindings.secret(),
			CF_VERSION_METADATA: bindings.versionMetadata(),
		},
	},
});
