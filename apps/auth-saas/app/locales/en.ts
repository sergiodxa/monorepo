/**
 * English translation dictionary for the hosted sign-in, consent and error screens —
 * the only bundle shipped today. Every visible string on those pages reads from here
 * through `ctx.i18next.t(...)`, so a later locale is a sibling file away rather than a
 * change to the screens themselves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export default {
	hostedSignIn: {
		title: "Sign in",
		forcedNotice: "Sign in again to continue.",
		identifier: { label: "Email or username" },
		password: { label: "Password" },
		remember: "Stay signed in on this device",
		submit: "Sign in",
		orSeparator: "or",
		passkey: {
			trigger: "Sign in with a passkey",
			pending: "Waiting for your passkey…",
		},
		errors: {
			invalidCredentials: "That email/username or password is incorrect.",
			passwordExpired: "Your password has expired. Contact support to reset it.",
			passkeyFailed: "Sign-in with a passkey did not complete. Try again or use your password.",
			passkeyUnsupported: "This browser cannot sign in with a passkey. Use your password instead.",
		},
		footer: "Secured by Auth SaaS",
	},

	hostedConsent: {
		title: "{{clientName}} is asking for access",
		signedInAs: "Signed in as {{name}}",
		scopesHeading: "This will allow {{clientName}} to:",
		alreadyGranted: "Already granted",
		approve: "Allow",
		deny: "Deny",
	},

	hostedSignUp: {
		title: "Create your account",
		passwordHint: "Use at least {{minLength}} characters.",
		identifier: { label: "Email" },
		password: { label: "Password" },
		name: { label: "Display name (optional)" },
		submit: "Create account",
		errors: {
			identifierInvalid: "Enter a valid email address.",
			identifierTaken: "An account with that email already exists.",
			generic: "We couldn't create your account. Try again.",
		},
	},

	hostedVerify: {
		title: "Verify your email",
		pending: {
			heading: "Check your email",
			body: "We sent a verification link to your email address. Follow it to finish setting up your account.",
			sendFailedHeading: "Your account was created",
			sendFailedBody:
				"We couldn't send the verification email right now. Use the button below to send it again.",
			resend: "Resend verification email",
			resent: "We sent another verification link.",
		},
		verified: {
			heading: "Email verified",
			body: "Your email is verified. Return to the application to sign in.",
		},
		invalid: {
			heading: "This link no longer works",
			body: "This verification link is invalid or has expired.",
		},
		errors: {
			missingState:
				"There is nothing to verify here. Start again from the application that sent you here.",
		},
	},

	hostedReset: {
		requestTitle: "Reset your password",
		identifier: { label: "Email or username" },
		requestSubmit: "Send reset link",
		requested: {
			heading: "Check your email",
			body: "If that account exists, we sent a link to reset its password.",
		},
		completeTitle: "Choose a new password",
		newPassword: { label: "New password" },
		completeSubmit: "Reset password",
		completeSuccess: {
			heading: "Password reset",
			body: "Your password has been reset. Sign in with your new password.",
			signIn: "Sign in",
		},
		invalidTicket: {
			heading: "This link no longer works",
			body: "This password reset link is invalid or has expired.",
			requestNew: "Request a new reset link",
		},
	},

	hostedPassword: {
		errors: {
			tooShort: "Password must be at least {{minLength}} characters.",
			common: "Choose a password that isn't easy to guess.",
			similarToIdentifier: "Your password can't be similar to your email.",
			deniedTerm: 'Your password can\'t contain "{{term}}".',
			reused: "Choose a password you haven't used before.",
		},
	},

	mail: {
		footer: "This is an automated message from {{tenantName}}.",
		verifyAddress: {
			subject: "Verify your email for {{tenantName}}",
			preview: "Confirm your email address to finish setting up your account.",
			heading: "Confirm your email address",
			body: "Follow this link to finish setting up your {{tenantName}} account.",
			action: "Verify email",
		},
		resetPassword: {
			subject: "Reset your password for {{tenantName}}",
			preview: "Use this link to choose a new password.",
			heading: "Reset your password",
			body: "Follow this link to choose a new password for your {{tenantName}} account.",
			action: "Reset password",
			unexpected: "If you didn't request this, you can safely ignore this email.",
		},
	},

	hostedError: {
		title: "Something went wrong",
		correlationId: "Reference: {{id}}",
		backHint: "Contact the application that sent you here if this continues.",
		invalidInteraction:
			"This sign-in attempt is no longer valid. Start again from the application that sent you here.",
	},
};
