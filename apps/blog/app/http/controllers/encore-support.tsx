/**
 * HTTP controller for the public Encore support page, the Support URL of the app's App Store
 * listings. It renders the contact form with honeypot fields, and on submission reads their check,
 * validates, rate-limits and mails the request, redirecting to a confirmation once it is sent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";
import { Session } from "remix/session";

import type { AppContext } from "~/app/http/context";

import { SupportRequestSchema } from "~/app/schemas/encore-support";
import { EncoreSupportView } from "~/resources/views/encore-support";
import routes from "~/routes/web";

/** The flash key carrying a successful delivery across the redirect to the confirmation. */
const SENT_FLASH = "encoreSupportSent";

/** The fields the form posts, which a failed submission hands back to the view verbatim. */
const FIELDS = [
	"name",
	"email",
	"topic",
	"platform",
	"osVersion",
	"appVersion",
	"message",
] as const;

/**
 * Reads the submitted values as posted, before validation trims or rejects them, so a
 * re-rendered form shows exactly what the visitor typed.
 */
function submittedValues(form: FormData | undefined): EncoreSupportView.Values {
	let values: EncoreSupportView.Values = {};
	for (let field of FIELDS) {
		let value = form?.get(field);
		if (typeof value === "string") values[field] = value;
	}
	return values;
}

/**
 * Renders the form in `state` with freshly issued honeypot fields, so every re-render carries a
 * token as valid as the first page load's. Issuing fails only without a signing secret, which
 * the session middleware ahead of this route already requires.
 */
async function renderForm(
	ctx: AppContext,
	model: Omit<EncoreSupportView.Model, "honeypot">,
	init?: ResponseInit,
): Promise<Response> {
	let honeypot = unwrap(await ctx.honeypot.issue());
	return ctx.render(EncoreSupportView, { ...model, honeypot }, init);
}

/**
 * The Encore support page. Public and anonymous; `cop()` and the support desk middleware
 * run ahead of it from the route map.
 */
export default createController(routes.encoreSupport, {
	actions: {
		/**
		 * Renders the form, or the confirmation when the previous request was a delivery
		 * that the flash carried across the redirect.
		 *
		 * @returns The support page.
		 */
		index: async (ctx) => {
			let sent = ctx.get(Session).get(SENT_FLASH) === true;
			if (sent) return ctx.render(EncoreSupportView, { state: "sent", values: {}, issues: [] });
			return renderForm(ctx, { state: "idle", values: {}, issues: [] });
		},

		/**
		 * Handles a submission. A filled trap answers like a success without sending, so a bot
		 * learns nothing; a missing or unverifiable token re-renders the form to send again, since
		 * a person with a page opened before a secret rotation holds one. A denied budget, a
		 * validation issue, or a failed delivery re-renders the form with the visitor's values.
		 * A valid request the spam filter scores as spam answers like a success without sending;
		 * one it is unsure about is delivered flagged. Nothing the visitor wrote is logged.
		 *
		 * @returns A See Other redirect to the confirmation, or the form with a 4xx/5xx status.
		 */
		action: async (ctx) => {
			let form = ctx.get(FormData);
			let values = submittedValues(form);
			let session = ctx.get(Session);

			let trap = ctx.honeypotOutcome;
			if (isFailure(trap)) {
				ctx.log.set({ support: { outcome: "honeypot", reason: trap.error.code } });
				if (trap.error.code === "trap-filled") {
					session.flash(SENT_FLASH, true);
					return redirect(routes.encoreSupport.index.href(), {
						status: redirect.Status.SeeOther,
					});
				}
				return renderForm(ctx, { state: "resubmit", values, issues: [] }, { status: 400 });
			}

			let admitted = await ctx.supportDesk.admit(
				ctx.ip?.network({ v4: 32, v6: 64 }).toString() ?? "unknown",
			);
			if (!admitted) {
				ctx.log.set({ support: { outcome: "rate_limited" } });
				return renderForm(
					ctx,
					{ state: "rate-limited", values, issues: [] },
					{ status: 429, headers: { "retry-after": "60" } },
				);
			}

			let parsed = await validate(form ?? new FormData(), SupportRequestSchema);
			if (isFailure(parsed)) {
				ctx.log.set({ support: { outcome: "invalid" } });
				return renderForm(
					ctx,
					{ state: "invalid", values, issues: parsed.error.issues },
					{ status: 400 },
				);
			}

			let assessment = await ctx.supportDesk.assess(parsed.data, {
				ip: ctx.ip?.toString(),
				userAgent: ctx.request.headers.get("user-agent") ?? undefined,
				renderedAt: trap.data.renderedAt,
			});
			ctx.log.set({
				spam: {
					verdict: assessment.verdict,
					score: assessment.score,
					signals: assessment.signals.map((signal) => signal.check).join(","),
					failures: assessment.failures
						.map((entry) => `${entry.check}:${entry.error.code}`)
						.join(","),
				},
			});
			if (assessment.verdict === "spam") {
				ctx.log.set({ support: { outcome: "spam" } });
				session.flash(SENT_FLASH, true);
				return redirect(routes.encoreSupport.index.href(), { status: redirect.Status.SeeOther });
			}

			let delivered = await ctx.supportDesk.deliver(parsed.data, assessment);
			if (isFailure(delivered)) {
				ctx.log.warn("support.delivery_failed", { reason: delivered.error.reason });
				return renderForm(ctx, { state: "failed", values, issues: [] }, { status: 503 });
			}

			ctx.log.set({ support: { outcome: "delivered", topic: parsed.data.topic } });
			session.flash(SENT_FLASH, true);
			return redirect(routes.encoreSupport.index.href(), { status: redirect.Status.SeeOther });
		},
	},
});
