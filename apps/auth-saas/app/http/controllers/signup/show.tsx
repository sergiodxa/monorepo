/**
 * `GET/POST /signup` — an organization name, an email, and a password. Claims the
 * email as an unverified platform subject, mints its verification ticket, and holds
 * the organization name in `pending_signups` until the address verifies — nothing is
 * provisioned yet, since an open, unauthenticated form that spent a Durable Object per
 * submission would cost real money on every unproven request. The password writes
 * last, once the address is claimed, so a submission that fails partway never leaves a
 * credential attached to an identifier nobody has proven yet.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Form } from "@sdxc/ui";
import type { RequestContext } from "remix/router";

import { isFailure } from "@sdxc/result";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import type { PasswordPolicy, PasswordPolicyFailure } from "~/database/passwords";

import {
	passesUnconditionalTurnstileChallenge,
	turnstileNonce,
} from "~/app/http/controllers/hosted/turnstile-guard";
import { requestOrigin } from "~/app/lib/request-origin";
import { mailTranslator } from "~/app/mail/locale";
import { PlatformSignupVerifyEmail } from "~/app/mail/platform-signup-verify-email";
import { parseSenderAddress } from "~/app/mail/sender";
import PendingSignup from "~/app/models/pending-signup";
import { PublicDocument } from "~/app/views/landing";
import { SignUpForm } from "~/app/views/signup";
import routes from "~/routes/web";

/** The sign-up form's schema, its password's minimum length drawn from the platform's own policy. */
function signUpSchema(policy: PasswordPolicy) {
	return f.object({
		organizationName: f.field(s.string().pipe(checks.minLength(1))),
		email: f.field(s.string().pipe(checks.minLength(1), checks.email())),
		password: f.field(s.string().pipe(checks.minLength(policy.minLength))),
	});
}

/** Renders a password policy refusal as plain English, with no translation layer behind this router. */
function passwordPolicyMessage(failure: PasswordPolicyFailure): string {
	switch (failure.reason) {
		case "too-short":
			return `Use at least ${failure.minLength} characters.`;
		case "breached-or-common":
			return "Choose a password that isn't easy to guess.";
		case "similar-to-identifier":
			return "Your password can't be similar to your email.";
		case "denied-term":
			return `Your password can't contain "${failure.term}".`;
		case "reused":
			return "Choose a password you haven't used before.";
	}
}

/** Renders the sign-up form, stating the platform's real password policy rather than a guessed one. */
function renderSignUpPage(
	ctx: RequestContext,
	input: { policy: PasswordPolicy; issues?: ReadonlyArray<Form.Issue> },
): Promise<Response> {
	return ctx.render(
		<PublicDocument title="Auth SaaS - Create your organization">
			<SignUpForm
				action={routes.signup.submit.href()}
				policy={input.policy}
				turnstileSiteKey={env.TURNSTILE_SITE_KEY}
				turnstileNonce={turnstileNonce(ctx)}
				issues={input.issues}
			/>
		</PublicDocument>,
		input.issues?.length ? { status: 400 } : undefined,
	);
}

/**
 * Renders the empty sign-up form, stating the platform's real password policy.
 *
 * @param ctx - The request context (provides `render` and `db`).
 * @returns The rendered sign-up page.
 * @example
 * router.map(routes.signup.show, signupShow);
 */
export const signupShow = createAction(routes.signup.show, async (ctx) => {
	let platform = env.TENANT.getByName(env.PLATFORM_DOMAIN);
	let policy = await platform.describePasswordPolicy();
	return renderSignUpPage(ctx, { policy });
});

/**
 * Claims the organization's email as an unverified platform subject, mints its
 * verification ticket, writes the pending signup row the organization name lives
 * in until that ticket is spent, then writes the password. Sends the verification
 * email and lands on `/signup/pending` regardless of whether the send succeeded,
 * since a subject that already exists is recoverable through a resend but one rolled
 * back for a delivery failure would not be.
 *
 * @param ctx - The request context (provides `formData`, `render`, `db` and `mail`).
 * @returns The redirect to `/signup/pending` on success, or this same page re-rendered
 * with an error.
 * @example
 * router.map(routes.signup.submit, signupSubmit);
 */
export const signupSubmit = createAction(routes.signup.submit, async (ctx) => {
	let platform = env.TENANT.getByName(env.PLATFORM_DOMAIN);
	let policy = await platform.describePasswordPolicy();

	let turnstilePassed = passesUnconditionalTurnstileChallenge(ctx.captcha, {
		env,
		tenantId: env.PLATFORM_DOMAIN,
		country: requestOrigin(ctx.request).country ?? undefined,
	});
	if (!turnstilePassed) {
		return renderSignUpPage(ctx, {
			policy,
			issues: [{ message: "We couldn't verify you're not a robot. Try again." }],
		});
	}

	let parsed = s.parseSafe(signUpSchema(policy), ctx.formData);
	if (!parsed.success) return renderSignUpPage(ctx, { policy, issues: parsed.issues });

	let { organizationName, email, password } = parsed.value;

	let created = await platform.createSubject({ identifiers: [{ kind: "email", value: email }] });

	if (!created.ok) {
		let message =
			created.reason === "identifier-taken"
				? "An account with this email already exists."
				: "Enter a valid email address.";
		return renderSignUpPage(ctx, { policy, issues: [{ message, path: ["email"] }] });
	}

	let added = await platform.addIdentifier({
		subjectId: created.subjectId,
		kind: "email",
		value: email,
		actor: { kind: "subject" },
	});

	if (!added.ok) {
		return renderSignUpPage(ctx, {
			policy,
			issues: [{ message: "Something went wrong. Try again." }],
		});
	}

	await PendingSignup.create(ctx.db, { subjectId: created.subjectId, organizationName });

	let sendFailed = false;

	if (added.kind === "email") {
		let { t } = mailTranslator();
		let url = new URL(routes.signup.verify.href(), ctx.request.url);
		url.searchParams.set("ticket", added.ticket);

		let sent = await ctx.mail.send(
			new PlatformSignupVerifyEmail({ email: added.value, url: url.toString(), t }),
			{ from: parseSenderAddress(env.EMAIL_FROM) },
		);

		sendFailed = isFailure(sent);
	}

	let written = await platform.setPassword({
		subjectId: created.subjectId,
		password,
		actor: { kind: "subject" },
	});

	if (!written.ok) {
		if (written.reason === "not-found") {
			return renderSignUpPage(ctx, {
				policy,
				issues: [{ message: "Something went wrong. Try again." }],
			});
		}

		return renderSignUpPage(ctx, {
			policy,
			issues: [{ message: passwordPolicyMessage(written), path: ["password"] }],
		});
	}

	let redirectUrl = new URL(routes.signup.pending.href(), ctx.request.url);
	redirectUrl.searchParams.set("subject", created.subjectId);
	if (sendFailed) redirectUrl.searchParams.set("sendFailed", "1");

	return new Response(null, { status: 302, headers: { Location: redirectUrl.toString() } });
});
