/**
 * HTTP controller for the public Encore support page, the Support URL of the app's App Store
 * listings. It renders the contact form, and on submission validates, rate-limits and mails
 * the request, redirecting to a confirmation only once the mail provider accepted it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getClientIP } from "@sdxc/get-client-ip";
import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";
import { Session } from "remix/session";

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
			return ctx.render(EncoreSupportView, {
				state: sent ? "sent" : "idle",
				values: {},
				issues: [],
			});
		},

		/**
		 * Handles a submission. The honeypot answers like a success without sending, so a bot
		 * learns nothing; a denied budget, a validation issue, or a failed delivery re-renders
		 * the form with the visitor's values. Nothing the visitor wrote is logged.
		 *
		 * @returns A See Other redirect to the confirmation, or the form with a 4xx/5xx status.
		 */
		action: async (ctx) => {
			let form = ctx.get(FormData);
			let values = submittedValues(form);
			let session = ctx.get(Session);

			let honeypot = form?.get("website");
			if (typeof honeypot === "string" && honeypot.length > 0) {
				ctx.log.set({ support: { outcome: "honeypot" } });
				session.flash(SENT_FLASH, true);
				return redirect(routes.encoreSupport.index.href(), { status: redirect.Status.SeeOther });
			}

			let admitted = await ctx.supportDesk.admit(getClientIP(ctx.request) ?? "unknown");
			if (!admitted) {
				ctx.log.set({ support: { outcome: "rate_limited" } });
				return ctx.render(
					EncoreSupportView,
					{ state: "rate-limited", values, issues: [] },
					{ status: 429, headers: { "retry-after": "60" } },
				);
			}

			let parsed = await validate(form ?? new FormData(), SupportRequestSchema);
			if (isFailure(parsed)) {
				ctx.log.set({ support: { outcome: "invalid" } });
				return ctx.render(
					EncoreSupportView,
					{ state: "invalid", values, issues: parsed.error.issues },
					{ status: 400 },
				);
			}

			let delivered = await ctx.supportDesk.deliver(parsed.data);
			if (isFailure(delivered)) {
				ctx.log.warn("support.delivery_failed", { reason: delivered.error.reason });
				return ctx.render(
					EncoreSupportView,
					{ state: "failed", values, issues: [] },
					{ status: 503 },
				);
			}

			ctx.log.set({ support: { outcome: "delivered", topic: parsed.data.topic } });
			session.flash(SENT_FLASH, true);
			return redirect(routes.encoreSupport.index.href(), { status: redirect.Status.SeeOther });
		},
	},
});
