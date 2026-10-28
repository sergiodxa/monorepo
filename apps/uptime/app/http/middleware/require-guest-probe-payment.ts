/**
 * Collects x402 payment for the accountless guest probe before the handler runs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { bazaarHttpPost } from "@sdxc/x402";
import { requirePayment } from "@sdxc/x402/middleware";

/** Atomic USDC amount for one guest probe (`$0.01`). */
export const GUEST_PROBE_AMOUNT = "10000";

/** Human description stamped on the 402 challenge. */
const DESCRIPTION = "One accountless HTTP probe from a fixed region; no monitor row.";

/**
 * Answers `402` until the client settles `GUEST_PROBE_AMOUNT`, then continues with
 * `ctx.payment` set. Marketing `/try` stays free and never mounts this guard.
 */
export const requireGuestProbePayment: Middleware = requirePayment({
	amount: GUEST_PROBE_AMOUNT,
	description: DESCRIPTION,
	resourceUrl: (ctx) => new URL("/api/v1/guest/probe", ctx.url).href,
	extensions: {
		bazaar: bazaarHttpPost(
			{ url: "https://example.com" },
			{
				type: "json",
				example: {
					data: {
						probe: { status: "up", responseTimeMs: 120, responseStatus: 200 },
					},
				},
			},
		),
	},
});
