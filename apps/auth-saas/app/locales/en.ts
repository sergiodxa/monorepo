/**
 * English translation dictionary for the hosted sign-in, consent and error screens —
 * the only bundle shipped today. Every visible string on those pages reads from here
 * through `ctx.intl.t(...)`, so a later locale is a sibling file away rather than a
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
			dauCapReached:
				"This account has reached its daily limit of active users. Try again tomorrow.",
			turnstileFailed: "We couldn't verify you're not a robot. Try again.",
		},
		footer: "Secured by Auth SaaS",
	},

	hostedSecondFactor: {
		title: "Enter your authentication code",
		codeLabel: "Authentication code or recovery code",
		remember: "Remember this device for 30 days",
		submit: "Verify",
		errors: {
			invalid: "That code isn't right. Try again.",
			replayed: "That code was already used. Wait for the next one and try again.",
		},
		enrol: {
			title: "Set up two-factor authentication",
			body: "Your authentication method was reset. Add it to an authenticator app, then enter the code it shows.",
			setupKeyLabel: "Setup key",
			uriLabel: "Or open this link on a device with an authenticator app installed",
			codeLabel: "Authentication code",
			submit: "Activate",
			errors: {
				invalid:
					"That code isn't right. The setup key expired; reload this page for a new one and try again.",
			},
		},
		recoveryCodes: {
			title: "Save your recovery codes",
			body: "Store these somewhere safe. Each code works once, if you ever lose access to your authenticator app.",
			continueButton: "Continue",
		},
	},

	hostedStepUp: {
		title: "Confirm it's you",
		body: "This action needs a fresh proof of your authentication code, even if you signed in recently.",
		codeLabel: "Authentication code or recovery code",
		submit: "Confirm",
		errors: {
			invalid: "That code isn't right. Try again.",
			replayed: "That code was already used. Wait for the next one and try again.",
		},
		enrol: {
			title: "Set up two-factor authentication",
			body: "This action needs a second factor and none is set up yet. Add it to an authenticator app, then enter the code it shows.",
			setupKeyLabel: "Setup key",
			uriLabel: "Or open this link on a device with an authenticator app installed",
			codeLabel: "Authentication code",
			submit: "Activate",
			errors: {
				invalid:
					"That code isn't right. The setup key expired; reload this page for a new one and try again.",
			},
		},
		recoveryCodes: {
			title: "Save your recovery codes",
			body: "Store these somewhere safe. Each code works once, if you ever lose access to your authenticator app.",
			continueButton: "Continue",
		},
	},

	hostedConsent: {
		title: "{$clientName} is asking for access",
		signedInAs: "Signed in as {$name}",
		scopesHeading: "This will allow {$clientName} to:",
		alreadyGranted: "Already granted",
		approve: "Allow",
		deny: "Deny",
	},

	hostedDevice: {
		title: "Connect a device",
		body: "Enter the code shown on your device.",
		codeLabel: "Code",
		submit: "Continue",
		errors: {
			unknown: "That code doesn't match a device waiting to be approved. Check it and try again.",
			expired: "That code has expired. Go back to your device for a new one.",
		},
		done: {
			approvedTitle: "Device connected",
			approvedBody: "You may close this window and return to your device.",
			deniedTitle: "Device not connected",
			deniedBody: "You may close this window. The device was not signed in.",
		},
	},

	hostedSignUp: {
		title: "Create your account",
		passwordHint: "Use at least {$minLength} characters.",
		identifier: { label: "Email" },
		password: { label: "Password" },
		name: { label: "Display name (optional)" },
		submit: "Create account",
		errors: {
			identifierInvalid: "Enter a valid email address.",
			identifierTaken: "An account with that email already exists.",
			generic: "We couldn't create your account. Try again.",
			turnstileFailed: "We couldn't verify you're not a robot. Try again.",
		},
	},

	platformSignUp: {
		errors: {
			emailInvalid: "Enter a valid email address.",
			emailDisposable:
				"Use an email address you'll keep. Disposable addresses can't own an organization.",
			emailNoMailServer: "{$domain} can't receive email. Check the address and try again.",
			emailSuggestion:
				"Did you mean {$suggestion}? We filled it in. Submit again, or change it back to keep {$address}.",
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
		errors: {
			turnstileFailed: "We couldn't verify you're not a robot. Try again.",
		},
	},

	hostedMagicLink: {
		requestTitle: "Sign in with email",
		identifier: { label: "Email" },
		requestSubmit: "Send magic link",
		confirmation: {
			heading: "Check your email",
			body: "If that address has an account, we sent a sign-in link and a code to it.",
			codeLabel: "Or enter the code from the email",
			codeSubmit: "Sign in",
		},
		tokenLanding: {
			heading: "Finish signing in",
			body: "Click below to finish signing in on this device.",
			submit: "Sign in",
		},
		invalid: {
			heading: "This link no longer works",
			body: "This sign-in link or code is invalid or has expired.",
			requestNew: "Request a new one",
		},
		wrongBrowser: {
			heading: "Open this on the device you requested it from",
			body: "This sign-in link only works in the browser that asked for it. Use the code from the email instead, or request a new link on this device.",
			requestNew: "Request a new one",
		},
		errors: {
			badCode: "That code isn't right. {$attemptsLeft} attempts left.",
			emailInvalid: "Enter a valid email address.",
			dauCapReached:
				"This account has reached its daily limit of active users. Try again tomorrow.",
			turnstileFailed: "We couldn't verify you're not a robot. Try again.",
		},
	},

	hostedPassword: {
		errors: {
			tooShort: "Password must be at least {$minLength} characters.",
			tooLong: "Password must be at most {$maxLength} characters.",
			common: "Choose a password that isn't easy to guess.",
			breached: "This password has appeared in a data breach. Choose a different one.",
			similarToIdentifier: "Your password can't be similar to your email.",
			deniedTerm: 'Your password can\'t contain "{$term}".',
			reused: "Choose a password you haven't used before.",
			checkUnavailable: "We couldn't check that password right now. Try again.",
		},
	},

	mail: {
		footer: "This is an automated message from {$tenantName}.",
		verifyAddress: {
			subject: "Verify your email for {$tenantName}",
			preview: "Confirm your email address to finish setting up your account.",
			heading: "Confirm your email address",
			body: "Follow this link to finish setting up your {$tenantName} account.",
			action: "Verify email",
		},
		resetPassword: {
			subject: "Reset your password for {$tenantName}",
			preview: "Use this link to choose a new password.",
			heading: "Reset your password",
			body: "Follow this link to choose a new password for your {$tenantName} account.",
			action: "Reset password",
			unexpected: "If you didn't request this, you can safely ignore this email.",
		},
		magicLinkSignIn: {
			subject: "Your sign-in link for {$tenantName}",
			preview: "Use this link or code to finish signing in.",
			heading: "Sign in to {$tenantName}",
			body: "Follow this link to finish signing in to your {$tenantName} account.",
			action: "Sign in",
			codeIntro: "Or enter this code where you started signing in:",
			unexpected: "If you didn't request this, you can safely ignore this email.",
		},
		magicLinkNoAccount: {
			subject: "Sign-in attempted for {$tenantName}",
			preview: "Someone tried to sign in with this address, but no account exists.",
			heading: "No account found",
			body: "Someone just tried to sign in to {$tenantName} using this email address, but no account exists for it.",
			notice: "If this wasn't you, you can safely ignore this email.",
		},
		attackSignalAlert: {
			subject: "Unusual sign-in activity on {$tenantName}",
			preview: "Failed sign-ins on {$tenantName} are running well above their usual rate.",
			heading: "Elevated failed sign-ins",
			body: "{$tenantName} saw {$recentFailures} failed sign-ins in the last hour, well above its usual rate of about {$baselineHourlyAverage} per hour.",
			notice: "This is a notification only; nothing was locked or changed on your account.",
		},
		credentialsExportStarted: {
			subject: "A credentials export started for {$tenantName}",
			preview: "Someone started an export that includes every stored password hash.",
			heading: "Credentials export started",
			body: "An export of {$tenantName}'s directory has started, including every subject's stored password hash.",
			notice: "If you didn't expect this, contact whoever on your team has access to start one.",
		},
		tenantInvitation: {
			subject: "You've been invited to administer {$tenantName}",
			preview: "Accept this invitation to help administer {$tenantName}.",
			heading: "You've been invited",
			body: "You've been invited to administer {$tenantName} as {$role}.",
			action: "Accept invitation",
			unexpected: "If you weren't expecting this, you can safely ignore this email.",
		},
		platformSignupVerify: {
			subject: "Verify your email for {$tenantName}",
			preview: "Confirm your email address to finish setting up your account and organization.",
			heading: "Confirm your email address",
			body: "Follow this link to finish setting up your {$tenantName} account and your new organization.",
			action: "Verify email",
			unexpected: "If you didn't request this, you can safely ignore this email.",
		},
	},

	hostedError: {
		title: "Something went wrong",
		correlationId: "Reference: {$id}",
		backHint: "Contact the application that sent you here if this continues.",
		invalidInteraction:
			"This sign-in attempt is no longer valid. Start again from the application that sent you here.",
		tooManyAttempts: "Too many attempts. Wait a moment and try again.",
	},
};
