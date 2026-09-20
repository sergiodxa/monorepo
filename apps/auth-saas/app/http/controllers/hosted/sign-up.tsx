/**
 * `GET/POST /u/sign-up` — an identifier, a password, and an optional display
 * name. `createSubject` claims the identifier unverified; `addIdentifier`
 * mints the ticket that proves it, per `subjects.ts`'s own split between the
 * two; `setPassword` writes the credential last, once the address is
 * claimed. No session opens here — `signInWithPassword` only ever resolves a
 * verified identifier, so a fresh signup lands on `/u/verify` instead of
 * completing any authorization it may have arrived from.
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
import { SignUpPage } from "~/app/views/hosted/sign-up";
import routes from "~/routes/tenant";

/** Builds an absolute URL for one of this tenant's routes, carrying the current request's query along. */
function actionUrl(ctx: RequestContext, path: string): string {
	let url = new URL(path, ctx.request.url);
	for (let [key, value] of ctx.url.searchParams) url.searchParams.set(key, value);
	return url.toString();
}

/** The sign-up form's schema, its password's minimum length drawn from the tenant's own policy. */
function signUpSchema(policy: PasswordPolicy) {
	return f.object({
		email: f.field(s.string().pipe(checks.minLength(1), checks.email())),
		password: f.field(s.string().pipe(checks.minLength(policy.minLength))),
		name: f.field(s.string()),
	});
}

/** Renders the sign-up form, carrying the current request's own query onto its action. */
async function renderSignUpPage(
	ctx: RequestContext,
	input: { policy: PasswordPolicy; issues?: ReadonlyArray<Form.Issue> },
): Promise<Response> {
	let t = ctx.i18next.t;

	return ctx.render(
		<HostedDocument title={t("hostedSignUp.title")} locale={ctx.locale}>
			<SignUpPage
				t={t}
				action={actionUrl(ctx, routes.hostedSignUpSubmit.href())}
				policy={input.policy}
				issues={input.issues}
			/>
		</HostedDocument>,
		input.issues?.length ? { status: 400 } : undefined,
	);
}

/**
 * Renders the sign-up form, stating the tenant's real password policy rather
 * than a guessed one.
 *
 * @param ctx - The request context (provides `render`, `locale`, `i18next` and `tenantStub`).
 * @returns The rendered sign-up page.
 * @example
 * router.map(routes.hostedSignUpShow, signUpShow);
 */
export const signUpShow = createAction(routes.hostedSignUpShow, async (ctx) => {
	let policy = await ctx.tenantStub.describePasswordPolicy();
	return renderSignUpPage(ctx, { policy });
});

/**
 * Creates the subject, mints its email's verification ticket, and writes its
 * password, in that order — then sends the browser to `/u/verify` with the
 * new subject id, since nothing yet delivers the ticket anywhere for the
 * person to follow.
 *
 * @param ctx - The request context (provides `formData`, `render` and `tenantStub`).
 * @returns The redirect to `/u/verify` on success, or this same page re-rendered with an error.
 * @example
 * router.map(routes.hostedSignUpSubmit, signUpSubmit);
 */
export const signUpSubmit = createAction(routes.hostedSignUpSubmit, async (ctx) => {
	let t = ctx.i18next.t;
	let policy = await ctx.tenantStub.describePasswordPolicy();

	let parsed = s.parseSafe(signUpSchema(policy), ctx.formData);
	if (!parsed.success) {
		return renderSignUpPage(ctx, { policy, issues: parsed.issues });
	}

	let { email, password, name } = parsed.value;
	let displayName = name.trim().length > 0 ? name.trim() : undefined;

	let created = await ctx.tenantStub.createSubject({
		identifiers: [{ kind: "email", value: email }],
		profile: { name: displayName },
	});

	if (!created.ok) {
		let message =
			created.reason === "identifier-taken"
				? t("hostedSignUp.errors.identifierTaken")
				: t("hostedSignUp.errors.identifierInvalid");
		return renderSignUpPage(ctx, { policy, issues: [{ message, path: ["email"] }] });
	}

	let added = await ctx.tenantStub.addIdentifier({
		subjectId: created.subjectId,
		kind: "email",
		value: email,
		actor: { kind: "subject" },
	});

	if (!added.ok) {
		return renderSignUpPage(ctx, {
			policy,
			issues: [{ message: t("hostedSignUp.errors.generic") }],
		});
	}

	let written = await ctx.tenantStub.setPassword({
		subjectId: created.subjectId,
		password,
		actor: { kind: "subject" },
	});

	if (!written.ok) {
		if (written.reason === "not-found") {
			return renderSignUpPage(ctx, {
				policy,
				issues: [{ message: t("hostedSignUp.errors.generic") }],
			});
		}

		return renderSignUpPage(ctx, {
			policy,
			issues: [passwordPolicyIssue(t, written, "password")],
		});
	}

	let url = new URL(routes.hostedVerifyShow.href(), ctx.request.url);
	url.searchParams.set("subject", created.subjectId);
	let uiLocales = ctx.url.searchParams.get("ui_locales");
	if (uiLocales) url.searchParams.set("ui_locales", uiLocales);

	return new Response(null, { status: 302, headers: { Location: url.toString() } });
});
