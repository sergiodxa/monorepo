/**
 * Collects x402 payment for the accountless guest probe before the handler runs.
 * Soft-launch (`X402_FACILITATOR_URL=memory`) skips charging so the route can be
 * exercised without a wallet.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { bazaarHttpPost } from "@sdxc/x402";
import { requirePayment } from "@sdxc/x402/middleware";

import { paymentsEnabled } from "~/app/services/payments";

/** Atomic USDC amount for one guest probe (`$0.01`). */
export const GUEST_PROBE_AMOUNT = "10000";

/** Human description stamped on the 402 challenge. */
const DESCRIPTION = "One accountless HTTP probe from a fixed region; no monitor row.";

/** Collects payment when charging is configured. */
const collectGuestProbePayment: Middleware = requirePayment({
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

/**
 * Answers `402` until the client settles `GUEST_PROBE_AMOUNT`, then continues with
 * `ctx.payment` set — or passes through unpaid when soft-launch has disabled charging.
 * Marketing `/try` stays free and never mounts this guard.
 */
export const requireGuestProbePayment: Middleware = (ctx, next) => {
	if (!paymentsEnabled()) {
		ctx.log.set({ payment: { disabled: true, surface: "guest-probe" } });
		return next();
	}
	return collectGuestProbePayment(ctx, next);
};
