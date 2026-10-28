/**
 * The accountless guest-probe operation of the API document: one HTTP check paid
 * with x402, with no team, API key or monitor row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import { defineOperation } from "@sdxc/openapi";

import { GUEST_PROBE_AMOUNT } from "~/app/http/middleware/require-guest-probe-payment";
import { envelope } from "~/app/http/openapi/envelope";
import routes from "~/routes/web";

/** Body `POST /api/v1/guest/probe` accepts. */
export const GUEST_PROBE_BODY = s.object({
	url: s
		.string()
		.pipe(checks.minLength(1), checks.maxLength(2048))
		.meta({ description: "The absolute URL to probe; only public http(s) hosts are allowed" }),
});

/** What one guest probe observed. */
const GUEST_PROBE = s
	.object({
		url: s.string().meta({ description: "The normalized absolute URL that was probed" }),
		status: s.enum_(["up", "degraded", "down"]),
		responseTimeMs: s.number().meta({ description: "0 when the target never answered" }),
		responseStatus: s.nullable(s.integer()).meta({ description: "Null when unreachable" }),
		location: s
			.nullable(s.string())
			.meta({ description: "Redirect target when redirects were not followed" }),
		checkedAt: s.string().meta({ format: "date-time" }),
		payment: s
			.nullable(
				s.object({
					payer: s.optional(s.string()),
					transaction: s.string(),
					network: s.string(),
					amount: s.string(),
					asset: s.string(),
					scheme: s.string(),
				}),
			)
			.meta({ description: "Settlement receipt when payment cleared" }),
	})
	.meta({ id: "GuestProbe" });

const GUEST_PROBE_CREATE = defineOperation("guestProbeCreate", routes.api.v1.guestProbe, {
	summary: "Run an accountless HTTP probe",
	description:
		`Runs one GET probe from a fixed region and stores nothing. Unpaid requests ` +
		`answer HTTP 402 with an x402 \`PAYMENT-REQUIRED\` challenge for ${GUEST_PROBE_AMOUNT} ` +
		`atomic USDC ($0.01). Marketing \`/try\` stays free and does not use this route.`,
	tags: ["Ping"],
	body: GUEST_PROBE_BODY,
	responses: {
		200: {
			description: "The check ran; its outcome is `data.probe.status`",
			body: envelope({ probe: GUEST_PROBE }),
			headers: {
				"PAYMENT-RESPONSE": {
					schema: s.string(),
					description: "Base64 JSON settlement receipt from the x402 facilitator",
				},
			},
		},
		402: {
			description:
				"Payment required. Retry with a `PAYMENT-SIGNATURE` header built from the " +
				"`PAYMENT-REQUIRED` challenge.",
			headers: {
				"PAYMENT-REQUIRED": {
					schema: s.string(),
					description: "Base64 JSON x402 V2 challenge (amount, network, payTo, Bazaar info)",
				},
				"Cache-Control": {
					schema: s.string(),
					description: "`no-store`",
				},
			},
		},
	},
	problems: ["validationError"],
	security: [],
});

/** Every operation in this module, in the order the reference lists them. */
export const OPERATIONS = [GUEST_PROBE_CREATE];
