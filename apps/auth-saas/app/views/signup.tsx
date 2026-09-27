/**
 * Public (pre-authentication) `remix/ui` views for platform self-serve onboarding: the
 * `/signup` form, its "check your email" and "invalid or expired ticket" states, and
 * the confirmation screen a freshly-provisioned tenant's new owner lands on. Rendered
 * inside `landing.tsx`'s own `PublicDocument` shell, with the same plain English copy
 * and module-level `css()` mixins that shell's other screens already use.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Form } from "@sdxc/ui";
import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { PasswordPolicy } from "~/database/passwords";

import { TurnstileWidget } from "./hosted/turnstile-widget";

let pageWrap = css({
	minHeight: "100vh",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	padding: "2rem 1rem",
});

let card = css({
	background: "#ffffff",
	borderRadius: "0.75rem",
	padding: "2rem",
	boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
	width: "100%",
	maxWidth: "28rem",
});

let cardTitle = css({
	fontSize: "1.5rem",
	fontWeight: "700",
	margin: "0 0 0.5rem",
	color: "#111827",
});

let cardSubtitle = css({ color: "#4b5563", margin: "0 0 1.5rem" });

let formStack = css({ display: "flex", flexDirection: "column", gap: "1rem" });

let fieldLabel = css({
	display: "block",
	fontSize: "0.875rem",
	fontWeight: "500",
	color: "#374151",
	marginBottom: "0.25rem",
});

let fieldInput = css({
	width: "100%",
	boxSizing: "border-box",
	padding: "0.5rem 0.75rem",
	borderRadius: "0.5rem",
	border: "1px solid #e5e7eb",
	fontSize: "1rem",
});

let fieldError = css({ color: "#dc2626", fontSize: "0.8125rem", margin: "0.25rem 0 0" });

let submitButton = css({
	display: "block",
	width: "100%",
	background: "#2563eb",
	color: "#ffffff",
	padding: "0.625rem 1rem",
	borderRadius: "0.5rem",
	border: "none",
	fontSize: "1rem",
	fontWeight: "500",
	cursor: "pointer",
	"&:hover": { background: "#1d4ed8" },
});

let secondaryButton = css({
	display: "block",
	width: "100%",
	background: "#ffffff",
	color: "#374151",
	padding: "0.625rem 1rem",
	borderRadius: "0.5rem",
	border: "1px solid #e5e7eb",
	fontSize: "1rem",
	fontWeight: "500",
	cursor: "pointer",
	"&:hover": { background: "#f9fafb" },
});

let errorBanner = css({
	background: "#fef2f2",
	color: "#991b1b",
	padding: "0.75rem 1rem",
	borderRadius: "0.5rem",
	fontSize: "0.875rem",
	margin: "0 0 1rem",
});

let successBanner = css({
	background: "#f0fdf4",
	color: "#15803d",
	padding: "0.75rem 1rem",
	borderRadius: "0.5rem",
	fontSize: "0.875rem",
	margin: "0 0 1rem",
});

let mutedText = css({ color: "#6b7280", fontSize: "0.875rem" });

let link = css({
	color: "#2563eb",
	textDecoration: "none",
	"&:hover": { textDecoration: "underline" },
});

/**
 * Reads the first issue addressed to a field by name, the same `path`-joining
 * convention `@sdxc/ui`'s own `Form` resolves issues through.
 *
 * @param issues - The submission's validation issues, if any.
 * @param name - The field name to look up.
 * @returns The first matching issue's message, or undefined.
 */
function fieldIssue(
	issues: ReadonlyArray<Form.Issue> | undefined,
	name: string,
): string | undefined {
	return issues?.find((issue) => issue.path?.[0] === name)?.message;
}

/**
 * Every issue with no field path at all — a refusal decided before any field
 * was reached, such as a failed Turnstile challenge.
 *
 * @param issues - The submission's validation issues, if any.
 * @returns The form-level issues' messages, joined for display.
 */
function formIssue(issues: ReadonlyArray<Form.Issue> | undefined): string | undefined {
	let messages = issues?.filter((issue) => !issue.path?.length).map((issue) => issue.message);
	return messages?.length ? messages.join(" ") : undefined;
}

export namespace SignUpForm {
	export interface Props {
		/** Where the form posts back to. */
		action: string;
		policy: PasswordPolicy;
		/** The platform's Turnstile site key, rendered unconditionally — signup always challenges. */
		turnstileSiteKey: string;
		issues?: ReadonlyArray<Form.Issue>;
	}
}

/**
 * The `/signup` form: organization name, email, password, and the Turnstile
 * challenge every submission runs through.
 *
 * @param handle - Component handle exposing the screen's props.
 * @returns A render function producing the sign-up form's markup.
 */
export function SignUpForm(handle: Handle<SignUpForm.Props>) {
	return () => {
		let { action, policy, turnstileSiteKey, issues } = handle.props;
		let topIssue = formIssue(issues);

		return (
			<div mix={[pageWrap]}>
				<div mix={[card]}>
					<h1 mix={[cardTitle]}>Create your organization</h1>
					<p mix={[cardSubtitle]}>
						Set up a new Auth SaaS organization with its own tenant, users and OIDC provider.
					</p>

					{topIssue && <div mix={[errorBanner]}>{topIssue}</div>}

					<form method="post" action={action} mix={[formStack]}>
						<div>
							<label mix={[fieldLabel]} htmlFor="organizationName">
								Organization name
							</label>
							<input
								mix={[fieldInput]}
								id="organizationName"
								name="organizationName"
								type="text"
								required
								autoComplete="organization"
							/>
							{fieldIssue(issues, "organizationName") && (
								<p mix={[fieldError]}>{fieldIssue(issues, "organizationName")}</p>
							)}
						</div>

						<div>
							<label mix={[fieldLabel]} htmlFor="email">
								Email
							</label>
							<input
								mix={[fieldInput]}
								id="email"
								name="email"
								type="email"
								required
								autoComplete="email"
							/>
							{fieldIssue(issues, "email") && (
								<p mix={[fieldError]}>{fieldIssue(issues, "email")}</p>
							)}
						</div>

						<div>
							<label mix={[fieldLabel]} htmlFor="password">
								Password
							</label>
							<input
								mix={[fieldInput]}
								id="password"
								name="password"
								type="password"
								required
								autoComplete="new-password"
							/>
							<p mix={[mutedText]}>At least {policy.minLength} characters.</p>
							{fieldIssue(issues, "password") && (
								<p mix={[fieldError]}>{fieldIssue(issues, "password")}</p>
							)}
						</div>

						<TurnstileWidget siteKey={turnstileSiteKey} />

						<button mix={[submitButton]} type="submit">
							Create organization
						</button>
					</form>
				</div>
			</div>
		);
	};
}

export namespace SignUpPendingPage {
	export interface Props {
		/** Where the resend control posts back to. */
		resendAction: string;
		resent: boolean;
		/** Whether the signup that landed here could not send its verification email. */
		sendFailed: boolean;
	}
}

/**
 * The "check your email" state a signup submission lands on, with a resend control.
 *
 * @param handle - Component handle exposing the screen's props.
 * @returns A render function producing the pending screen's markup.
 */
export function SignUpPendingPage(handle: Handle<SignUpPendingPage.Props>) {
	return () => {
		let { resendAction, resent, sendFailed } = handle.props;

		return (
			<div mix={[pageWrap]}>
				<div mix={[card]}>
					<h1 mix={[cardTitle]}>{sendFailed ? "Your account was created" : "Check your email"}</h1>
					<p mix={[cardSubtitle]}>
						{sendFailed
							? "Your account was created, but we couldn't send the verification email. Request a new one below."
							: "We sent a verification link to the email address you signed up with. Follow it to finish creating your organization."}
					</p>

					{resent && <div mix={[successBanner]}>A new verification link is on its way.</div>}

					<form method="post" action={resendAction}>
						<button mix={[secondaryButton]} type="submit">
							Resend verification email
						</button>
					</form>
				</div>
			</div>
		);
	};
}

/**
 * The "invalid or expired ticket" state: an unknown, expired, or already-spent
 * verification link all land here alike.
 *
 * @returns A render function producing the invalid screen's markup.
 */
export function SignUpInvalidPage() {
	return () => (
		<div mix={[pageWrap]}>
			<div mix={[card]}>
				<h1 mix={[cardTitle]}>This link no longer works</h1>
				<p mix={[cardSubtitle]}>
					This verification link is invalid or has expired. Start over by signing up again.
				</p>
			</div>
		</div>
	);
}

export namespace SignUpCompletePage {
	export interface Props {
		/** The freshly-provisioned tenant's own hostname, e.g. `acme-4f9a.example.com`. */
		tenantHostname: string;
		/** Absolute URL of the new tenant's own hosted sign-in page. */
		signInUrl: string;
	}
}

/**
 * The confirmation screen a freshly-provisioned tenant's new owner lands on,
 * already signed in to the platform dashboard.
 *
 * @param handle - Component handle exposing the screen's props.
 * @returns A render function producing the confirmation screen's markup.
 */
export function SignUpCompletePage(handle: Handle<SignUpCompletePage.Props>) {
	return () => {
		let { tenantHostname, signInUrl } = handle.props;

		return (
			<div mix={[pageWrap]}>
				<div mix={[card]}>
					<h1 mix={[cardTitle]}>You're all set</h1>
					<p mix={[cardSubtitle]}>
						Your account and your organization <strong>{tenantHostname}</strong> are ready.
					</p>
					<p mix={[mutedText]}>
						Sign back in any time at{" "}
						<a mix={[link]} href={signInUrl}>
							{tenantHostname}
						</a>
						. If you ever forget your password, a magic link always works — your email is already
						verified.
					</p>
				</div>
			</div>
		);
	};
}
