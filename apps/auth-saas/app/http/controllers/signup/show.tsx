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

import type { EmailAddress } from "@sdxc/email-address";
import type { Translate } from "@sdxc/i18n";
import type { Form } from "@sdxc/ui";
import type { RequestContext } from "remix/router";

import { checkDisposable } from "@sdxc/email-address/disposable";
import { checkMailServer } from "@sdxc/email-address/mail-server";
import { suggestDomain } from "@sdxc/email-address/typo";
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
import { emailAddress } from "~/app/http/lib/email-address";
import { requestOrigin } from "~/app/lib/request-origin";
import { mailTranslator } from "~/app/mail/locale";
import { PlatformSignupVerifyEmail } from "~/app/mail/platform-signup-verify-email";
import { parseSenderAddress } from "~/app/mail/sender";
import PendingSignup from "~/app/models/pending-signup";
import { PublicDocument } from "~/app/views/landing";
import { SignUpForm } from "~/app/views/signup";
import routes from "~/routes/web";

/**
 * The sign-up form's schema: the address parsed the way its identifier folds, and the
 * password's minimum length drawn from the platform's own policy.
 */
function signUpSchema(policy: PasswordPolicy, t: Translate) {
	return f.object({
		organizationName: f.field(s.string().pipe(checks.minLength(1))),
		email: f.field(emailAddress(t("platformSignUp.errors.emailInvalid"))),
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

/** Why a parsed address was held back, and what the re-rendered form offers instead. */
interface AddressRefusal {
	message: string;
	/** The provider's spelling the form fills in, when the domain looks mistyped. */
	suggestion?: string;
}

/**
 * Screens an organization owner's address before anything is claimed. A likely typo of a
 * common provider is offered first, since the disposable list holds many typo domains, and
 * `confirmedEmail` naming the address keeps it; a disposable domain or one that cannot receive
 * mail then refuses, while a failed lookup passes, so a resolver outage never blocks a sign-up.
 *
 * @param t - The request's translator.
 * @param address - The parsed address.
 * @param confirmedEmail - The address the person already kept over a suggestion, if any.
 * @returns Why the address was held back, or `null` when it may sign up.
 */
async function screenOwnerAddress(
	t: Translate,
	address: EmailAddress,
	confirmedEmail: FormDataEntryValue | null,
): Promise<AddressRefusal | null> {
	let suggestion = suggestDomain(address);
	if (suggestion && confirmedEmail !== address.address) {
		return {
			message: t("platformSignUp.errors.emailSuggestion", {
				suggestion: suggestion.address,
				address: address.address,
			}),
			suggestion: suggestion.address,
		};
	}

	if (isFailure(checkDisposable(address))) {
		return { message: t("platformSignUp.errors.emailDisposable") };
	}

	let servers = await checkMailServer(address.domain);
	if (isFailure(servers) && servers.error.reason !== "lookup-failed") {
		return { message: t("platformSignUp.errors.emailNoMailServer", { domain: address.domain }) };
	}

	return null;
}

/** Renders the sign-up form, stating the platform's real password policy rather than a guessed one. */
function renderSignUpPage(
	ctx: RequestContext,
	input: {
		policy: PasswordPolicy;
		issues?: ReadonlyArray<Form.Issue>;
		organizationName?: string;
		email?: string;
		confirmedEmail?: string;
	},
): Promise<Response> {
	return ctx.render(
		<PublicDocument title="Auth SaaS - Create your organization">
			<SignUpForm
				action={routes.signup.submit.href()}
				policy={input.policy}
				turnstileSiteKey={env.TURNSTILE_SITE_KEY}
				turnstileNonce={turnstileNonce(ctx)}
				organizationName={input.organizationName}
				email={input.email}
				confirmedEmail={input.confirmedEmail}
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

	let parsed = s.parseSafe(signUpSchema(policy, ctx.intl.t), ctx.formData);
	if (!parsed.success) return renderSignUpPage(ctx, { policy, issues: parsed.issues });

	let { organizationName, password } = parsed.value;
	let email = parsed.value.email.address;

	let refusal = await screenOwnerAddress(
		ctx.intl.t,
		parsed.value.email,
		ctx.formData.get("confirmedEmail"),
	);
	if (refusal) {
		return renderSignUpPage(ctx, {
			policy,
			issues: [{ message: refusal.message, path: ["email"] }],
			organizationName,
			email: refusal.suggestion ?? email,
			confirmedEmail: refusal.suggestion ? email : undefined,
		});
	}

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
