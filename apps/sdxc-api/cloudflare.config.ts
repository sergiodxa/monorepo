/**
 * Cloudflare deployment for the package-backed micro-APIs Worker. No storage
 * bindings beyond a rate limiter — every request is pure compute settled through x402.
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
			/** Receive wallet for settled payments (Base USDC address). */
			X402_PAY_TO: bindings.secret(),
			/**
			 * Facilitator base URL. Soft-launch: `memory` (or empty) disables
			 * charging so the Worker can be exercised without a receive wallet.
			 * Non-http stubs keep MemoryFacilitator while still charging.
			 * Production: CDP or another HTTPS facilitator.
			 */
			X402_FACILITATOR_URL: bindings.secret(),
			/**
			 * Optional `Authorization` value sent on every facilitator call
			 * (for example `Bearer <cdp-jwt>`). Soft-launch / public facilitators:
			 * a placeholder such as `-` is fine until a real value is set.
			 */
			X402_FACILITATOR_AUTH: bindings.secret(),
			/** CAIP-2 network id, e.g. `eip155:84532` (Sepolia) or `eip155:8453` (Base). */
			X402_NETWORK: bindings.secret(),
			/** Asset contract charged (USDC on the configured network). */
			X402_ASSET: bindings.secret(),
			/**
			 * Operator free pass. Send `Authorization: Bearer <value>` on priced
			 * HTTP or MCP calls to skip x402. Mint with `randomToken({ prefix: "owner" })`.
			 */
			OWNER_ACCESS_TOKEN: bindings.secret(),
			/**
			 * 60 requests per minute per payer (when `PAYMENT-SIGNATURE` is present)
			 * or per connecting address. Keep in step with `OPERATION_RATE_LIMIT`.
			 */
			RATE_LIMITER: bindings.rateLimit({
				namespace: "2101",
				simple: { limit: 60, period: 60 },
			}),
			CF_VERSION_METADATA: bindings.versionMetadata(),
		},
	},
});
