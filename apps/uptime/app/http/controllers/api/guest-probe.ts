/**
 * Accountless one-shot HTTP probe charged with x402: `POST /api/v1/guest/probe`.
 * Marketing `/try` stays free; this lane is for agents and CI that pay per call
 * without creating a team or monitor row, so Polar is not billed either.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { requireGuestProbePayment } from "~/app/http/middleware/require-guest-probe-payment";
import { apiProblems, problemInstance } from "~/app/services/api/problems";
import { apiSuccess } from "~/app/services/api/response";
import { HttpCheck } from "~/app/services/http-check";
import { guardTrialProbe } from "~/app/services/trial/guard";
import { trialProbeOptions } from "~/app/services/trial/probe";
import routes from "~/routes/web";

/** POST /api/v1/guest/probe — pay once, probe once, store nothing. */
export default createAction(routes.api.v1.guestProbe, {
	middleware: [requireGuestProbePayment],
	handler: async (ctx) => {
		let body: unknown;
		try {
			body = await ctx.request.json();
		} catch {
			return apiProblems.validationError({
				instance: problemInstance(),
				extensions: {
					errors: [{ pointer: "", code: "invalid_json", message: "Body must be JSON" }],
				},
			});
		}

		if (
			typeof body !== "object" ||
			body === null ||
			typeof (body as { url?: unknown }).url !== "string"
		) {
			return apiProblems.validationError({
				instance: problemInstance(),
				extensions: {
					errors: [{ pointer: "/url", code: "invalid_type", message: "url must be a string" }],
				},
			});
		}

		let target = (body as { url: string }).url.trim();
		if (target === "") {
			return apiProblems.validationError({
				instance: problemInstance(),
				extensions: {
					errors: [{ pointer: "/url", code: "required", message: "url must not be empty" }],
				},
			});
		}

		/**
		 * `billed: true` skips the free-tier Turnstile and daily budget — the caller
		 * already paid via x402 — while still enforcing the outbound target and host rules.
		 */
		let grant = await guardTrialProbe({
			target,
			token: null,
			request: ctx.request,
			billed: true,
		});
		if (isFailure(grant)) {
			ctx.log.set({
				guest_probe: { refused: grant.error.reason, detail: grant.error.detail },
			});
			return apiProblems.validationError({
				detail: grant.error.message,
				instance: problemInstance(),
				extensions: {
					errors: [{ pointer: "/url", code: grant.error.reason, message: grant.error.detail }],
				},
			});
		}

		let check = new HttpCheck(trialProbeOptions(grant.data.url.href));
		let outcome = await check.probe();
		let status = check.classify(outcome, true);

		return apiSuccess({
			probe: {
				url: grant.data.url.href,
				status,
				responseTimeMs: outcome.responseTimeMs ?? 0,
				responseStatus: outcome.responseStatus ?? null,
				location: outcome.location,
				checkedAt: new Date().toISOString(),
				payment: ctx.payment ?? null,
			},
		});
	},
});
