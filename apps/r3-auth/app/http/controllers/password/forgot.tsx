/**
 * `/password/forgot` — the unauthenticated page that asks which address needs a recovery
 * link, and the submission that produces one. It is the way back into an account whose
 * password is lost.
 *
 * Every well-formed submission is answered identically whether or not the address belongs to
 * a subject: same validation, same per-address cooldown, same page and status, and logs that
 * record only that a request arrived.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { getClientIP } from "@sdxc/get-client-ip";
import { isFailure } from "@sdxc/result";
import { inject } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";

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
 * Renders the one page a well-formed submission ever produces: same view, same `200`, same
 * headers for a registered address, an unregistered one, and an address inside its cooldown.
 * It ends the flow, since the only step left is a retry the cooldown refuses.
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
		 * POST /password/forgot — issues a reset when the address exists and answers identically
		 * otherwise; {@link requestPasswordReset} returns nothing, so there is no outcome here to
		 * branch on. Its per-address cooldown bounds mail; the shared IP budget bounds callers.
		 */
		action: inject([Database, RateLimiters] as const, async (db, limiters) => {
			let ctx = getContext();

			let limited = await spendRateLimit(limiters.login, getClientIP(ctx.request) ?? "unknown");
			if (limited) return limited;

			let result = await validate(ctx.formData, ForgotPasswordSchema);
			if (isFailure(result)) {
				ctx.log.note("password_reset.form_invalid");
				return requestPage(
					ctx,
					submittedAddress(ctx.formData),
					ctx.i18next.t("password.forgot.errors.invalid"),
				);
			}

			await requestPasswordReset(ctx, db, result.data.email);

			return sentPage(ctx);
		}),
	},
});
