/**
 * `GET/POST /u/reset` — two states behind one path, told apart by whether its
 * own `ticket` query parameter is present: without one, the request form,
 * which always renders the same confirmation `beginPasswordReset` itself
 * never distinguishes; with one, the new-password form `completePasswordReset`
 * spends. Neither leg opens a session — a reset revokes every one the
 * subject held — so a completed reset offers `/u/sign-in` for signing in fresh.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Form } from "@sdxc/ui";
import type { RequestContext } from "remix/router";

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import type { PasswordPolicy } from "~/database/passwords";

import { passwordPolicyIssue } from "~/app/http/controllers/hosted/password-policy-issue";
import { HostedDocument } from "~/app/views/hosted/document";
import { ResetPage } from "~/app/views/hosted/reset";
import routes from "~/routes/tenant";

/** Builds an absolute URL for one of this tenant's routes, carrying the current request's query along. */
function actionUrl(ctx: RequestContext, path: string): string {
	let url = new URL(path, ctx.request.url);
	for (let [key, value] of ctx.url.searchParams) url.searchParams.set(key, value);
	return url.toString();
}

/** Where a completed reset offers to continue, carrying forward `ui_locales` alone — never the spent ticket. */
function signInHref(ctx: RequestContext): string {
	let url = new URL(routes.hostedSignInShow.href(), ctx.request.url);
	let uiLocales = ctx.url.searchParams.get("ui_locales");
	if (uiLocales) url.searchParams.set("ui_locales", uiLocales);
	return url.toString();
}

/** Where an invalid ticket's page offers to request a fresh one, carrying forward `ui_locales` alone. */
function freshRequestHref(ctx: RequestContext): string {
	let url = new URL(routes.hostedResetShow.href(), ctx.request.url);
	let uiLocales = ctx.url.searchParams.get("ui_locales");
	if (uiLocales) url.searchParams.set("ui_locales", uiLocales);
	return url.toString();
}

let RequestSchema = f.object({
	identifier: f.field(s.string().pipe(checks.minLength(1))),
});

/** The new-password form's schema, its minimum length drawn from the tenant's own policy. */
function completeSchema(policy: PasswordPolicy) {
	return f.object({
		newPassword: f.field(s.string().pipe(checks.minLength(policy.minLength))),
	});
}

/** Renders the request-a-reset form. */
function renderRequestForm(
	ctx: RequestContext,
	issues?: ReadonlyArray<Form.Issue>,
): Promise<Response> {
	let t = ctx.i18next.t;

	return ctx.render(
		<HostedDocument title={t("hostedReset.requestTitle")} locale={ctx.locale}>
			<ResetPage
				t={t}
				state="request"
				action={actionUrl(ctx, routes.hostedResetSubmit.href())}
				issues={issues}
			/>
		</HostedDocument>,
		issues?.length ? { status: 400 } : undefined,
	);
}

/** Renders the new-password form for the ticket the current request's own query names. */
function renderCompleteForm(
	ctx: RequestContext,
	policy: PasswordPolicy,
	issues?: ReadonlyArray<Form.Issue>,
): Promise<Response> {
	let t = ctx.i18next.t;

	return ctx.render(
		<HostedDocument title={t("hostedReset.completeTitle")} locale={ctx.locale}>
			<ResetPage
				t={t}
				state="complete"
				action={actionUrl(ctx, routes.hostedResetSubmit.href())}
				policy={policy}
				issues={issues}
			/>
		</HostedDocument>,
		issues?.length ? { status: 400 } : undefined,
	);
}

/**
 * Renders the request form, or the new-password form when a `ticket` names a
 * pending reset.
 *
 * @param ctx - The request context (provides `render`, `locale`, `i18next` and `tenantStub`).
 * @returns The rendered reset screen for whichever state the request is in.
 * @example
 * router.map(routes.hostedResetShow, resetShow);
 */
export const resetShow = createAction(routes.hostedResetShow, async (ctx) => {
	let ticket = ctx.url.searchParams.get("ticket");
	if (!ticket) return renderRequestForm(ctx);

	let policy = await ctx.tenantStub.describePasswordPolicy();
	return renderCompleteForm(ctx, policy);
});

/**
 * Begins a reset for the submitted identifier, or spends the ticket the
 * request's own query names to complete one. The request leg renders its
 * confirmation from the schema's own success alone, never from
 * `beginPasswordReset`'s answer, so a resolved and an unresolved identifier
 * reach the same response.
 *
 * @param ctx - The request context (provides `formData`, `render` and `tenantStub`).
 * @returns The confirmation or new-password-written response, or this same
 * screen re-rendered with an error.
 * @example
 * router.map(routes.hostedResetSubmit, resetSubmit);
 */
export const resetSubmit = createAction(routes.hostedResetSubmit, async (ctx) => {
	let t = ctx.i18next.t;
	let ticket = ctx.url.searchParams.get("ticket");

	if (!ticket) {
		let parsed = s.parseSafe(RequestSchema, ctx.formData);
		if (!parsed.success) return renderRequestForm(ctx, parsed.issues);

		await ctx.tenantStub.beginPasswordReset({ identifier: parsed.value.identifier });

		return ctx.render(
			<HostedDocument title={t("hostedReset.requestTitle")} locale={ctx.locale}>
				<ResetPage t={t} state="requested" />
			</HostedDocument>,
		);
	}

	let policy = await ctx.tenantStub.describePasswordPolicy();
	let parsed = s.parseSafe(completeSchema(policy), ctx.formData);
	if (!parsed.success) return renderCompleteForm(ctx, policy, parsed.issues);

	let completed = await ctx.tenantStub.completePasswordReset({
		ticket,
		newPassword: parsed.value.newPassword,
	});

	if (!completed.ok) {
		if (completed.reason === "invalid-ticket") {
			return ctx.render(
				<HostedDocument title={t("hostedReset.invalidTicket.heading")} locale={ctx.locale}>
					<ResetPage t={t} state="invalidTicket" requestHref={freshRequestHref(ctx)} />
				</HostedDocument>,
				{ status: 400 },
			);
		}

		return renderCompleteForm(ctx, policy, [passwordPolicyIssue(t, completed, "newPassword")]);
	}

	return ctx.render(
		<HostedDocument title={t("hostedReset.completeSuccess.heading")} locale={ctx.locale}>
			<ResetPage t={t} state="completed" signInHref={signInHref(ctx)} />
		</HostedDocument>,
	);
});
