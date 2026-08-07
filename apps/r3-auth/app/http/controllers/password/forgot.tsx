/**
 * `/password/forgot` — the page that asks which address needs a recovery link, and the
 * submission that produces one. It is the only way back into an account whose password is
 * lost, and it is unauthenticated by definition.
 *
 * Its whole design is one rule: the answer must not depend on whether the address belongs
 * to a subject. Both cases run the same validation, claim the same per-address cooldown and
 * render the same page with the same status, and neither is reported in a log line — so the
 * form cannot be used to find out who has an account here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/fetch-router";

import { getClientIP } from "@pkg/get-client-ip";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createController } from "remix/fetch-router";

import { ForgotPasswordSchema } from "~/app/http/validators/password";
import { requestPasswordReset } from "~/app/services/password-reset";
import { spendRateLimit } from "~/app/services/rate-limit";
import RateLimiters from "~/app/services/rate-limiters";
import DocumentLayout from "~/resources/layouts/document";
import ForgotPasswordView from "~/resources/views/password/forgot";
import PasswordNoticeView from "~/resources/views/password/notice";
import routes from "~/routes/web";

/**
 * Renders the request form.
 *
 * @param value - What the address field starts with, so a refused submission keeps typing.
 * @param error - Why the previous submission was refused, already translated.
 */
function requestPage(
	ctx: RequestContext,
	value: string,
	error: string | null,
): Response | Promise<Response> {
	return ctx.render(
		<DocumentLayout title={ctx.i18next.t("password.forgot.documentTitle")} clientRuntime={false}>
			<ForgotPasswordView
				title={ctx.i18next.t("password.forgot.title")}
				description={ctx.i18next.t("password.forgot.description")}
				email={{
					label: ctx.i18next.t("password.forgot.email.label"),
					placeholder: ctx.i18next.t("password.forgot.email.placeholder"),
				}}
				value={value}
				submit={ctx.i18next.t("password.forgot.submit")}
				error={error}
			/>
		</DocumentLayout>,
		{ status: error ? 400 : 200 },
	);
}

/**
 * Renders the one page a well-formed submission ever produces.
 *
 * The same response for a registered address, an unregistered one and an address inside its
 * cooldown: same view, same `200`, same headers. It offers no way onward, because the only
 * one it could offer is trying again, which the cooldown would refuse.
 */
function sentPage(ctx: RequestContext): Response | Promise<Response> {
	return ctx.render(
		<DocumentLayout title={ctx.i18next.t("password.sent.documentTitle")} clientRuntime={false}>
			<PasswordNoticeView
				title={ctx.i18next.t("password.sent.title")}
				description={ctx.i18next.t("password.sent.description")}
				action={null}
			/>
		</DocumentLayout>,
	);
}

/** The submitted address, so a refused submission re-renders with it rather than empty. */
function submittedAddress(formData: FormData): string {
	let value = formData.get("email");
	return typeof value === "string" ? value : "";
}

export default createController(routes.password.forgot, {
	actions: {
		/** GET /password/forgot — the empty request form. */
		index() {
			return requestPage(getContext(), "", null);
		},

		/**
		 * POST /password/forgot — issues a reset for the address when one exists, and answers
		 * identically when it does not.
		 *
		 * The limiter is the same IP-keyed budget password attempts spend, which bounds how
		 * many requests one caller can make. It is not the control that bounds mail: that is
		 * the per-address cooldown inside {@link requestPasswordReset}, because this budget
		 * is keyed by address of the caller and a distributed caller walks through it.
		 */
		action: inject([Database, RateLimiters] as const, async (db, limiters) => {
			let ctx = getContext();

			let limited = await spendRateLimit(limiters.login, getClientIP(ctx.request) ?? "unknown");
			if (limited) return limited;

			let result = await validate(ctx.formData, ForgotPasswordSchema);
			if (isFailure(result)) {
				// No address in the payload, here or anywhere else on this path.
				ctx.logger.info("password_reset_form_invalid");
				return requestPage(
					ctx,
					submittedAddress(ctx.formData),
					ctx.i18next.t("password.forgot.errors.invalid"),
				);
			}

			// Returns nothing on purpose: there is no outcome to branch on, so this
			// controller cannot leak one.
			await requestPasswordReset(ctx, db, result.data.email);

			return sentPage(ctx);
		}),
	},
});
