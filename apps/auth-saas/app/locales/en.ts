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

	hostedError: {
		title: "Something went wrong",
		correlationId: "Reference: {{id}}",
		backHint: "Contact the application that sent you here if this continues.",
		invalidInteraction:
			"This sign-in attempt is no longer valid. Start again from the application that sent you here.",
	},
};
