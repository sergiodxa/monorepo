/**
 * English translation catalog for the auth app. Holds all user-facing UI
 * strings — layout metadata, transactional email copy, OAuth scope descriptions,
 * the authorize and logout flows, account/admin navigation, and the profile,
 * sessions, grants, clients, and subjects screens — as the single source of copy
 * consumed by i18next.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export default {
	layout: {
		meta: {
			title: "Auth by Sergio Xalambrí",
			description: "Simple & reliable authentication for developers",
		},
	},

	// Copy for the messages this server sends. `footer` is outside the per-message
	// sections because the shared email layout appends it to every one of them.
	emails: {
		footer:
			"This is an automated message about your Auth account. Nobody reads replies to the sender address.",

		newSignIn: {
			subject: "New sign-in to your account",
			preview: "Your account was signed in to from a new session.",
			heading: "New sign-in to your account",
			body: "Somebody signed in to your Auth account. Here is what we recorded about it.",
			facts: {
				browser: "Browser",
				device: "Device",
				ip: "IP address",
				ipUnknown: "Not recorded",
			},
			devices: {
				desktop: "Desktop",
				mobile: "Phone",
				tablet: "Tablet",
				unknown: "Unknown device",
			},
			expected: "If this was you, there is nothing to do.",
			action: "Review your devices",
			unexpected:
				"If it was not you, review your devices, sign the session out, and change your password.",
		},

		verifyEmail: {
			subject: "Confirm your email address",
			preview: "Confirm your email address to finish setting up your Auth account.",
			heading: "Confirm your email address",
			body: "Confirm that this address belongs to you, so the apps you sign in to are told your email is yours.",
			action: "Confirm email address",
			// The number comes from the one constant that also sets the resend window, so
			// the copy cannot promise a lifetime the token does not have.
			expiry:
				"This link works for {{minutes}} minutes and can be used once. If it has expired, ask for a new one from your profile.",
			ignore:
				"If you did not create an Auth account and did not sign in, you can ignore this message.",
		},

		resetPassword: {
			subject: "Reset your password",
			preview: "Use this link to choose a new password for your Auth account.",
			heading: "Reset your password",
			body: "Somebody asked to reset the password on your Auth account. Choose a new one here.",
			action: "Choose a new password",
			// The number comes from the constant that sets the token's own lifetime, so the
			// copy cannot promise a window the link does not have.
			expiry: "This link works for {{minutes}} minutes and can be used once.",
			unexpected:
				"If you did not ask for this, you can ignore this message. Your password stays as it is until this link is used.",
		},

		passwordChanged: {
			subject: "Your password was changed",
			preview: "The password on your Auth account was changed.",
			heading: "Your password was changed",
			body: "The password on your Auth account has just been changed through a reset link.",
			sessions:
				"Everything that was signed in to your account has been signed out, so you will be asked to sign in again on your other devices.",
			action: "Sign in",
			unexpected:
				"If this was not you, reply to this message straight away — somebody else may have access to this mailbox.",
		},
	},

	// Copy for the password-recovery pages. Every outcome of the request form reads the
	// same, because whether an address is registered is not something the page may reveal.
	password: {
		forgot: {
			documentTitle: "Reset your password",
			title: "Reset your password",
			description: "We will email you a link to choose a new password.",
			// Label of the link on the sign-in card. Phrased as the reader's problem rather than
			// as the page's title, because that is the sentence they are scanning the card for.
			link: "Forgot your password?",
			email: { label: "Email", placeholder: "Email" },
			submit: "Send reset link",
			errors: {
				invalid: "Enter a valid email address.",
			},
		},

		sent: {
			documentTitle: "Check your inbox",
			title: "Check your inbox",
			description:
				"If that address belongs to an account, a link to choose a new password is on its way. It works for 30 minutes.",
		},

		reset: {
			documentTitle: "Choose a new password",
			title: "Choose a new password",
			description: "Enter the password you want to use from now on.",
			password: { label: "New password", placeholder: "New password" },
			confirmation: { label: "Repeat new password", placeholder: "Repeat new password" },
			submit: "Change password",
			errors: {
				invalid: "Use at least 8 characters.",
				mismatch: "The two passwords do not match.",
				failedTitle: "Something went wrong",
				failed: "Your password was not changed. Ask for a new link and try again.",
			},
		},

		invalid: {
			documentTitle: "This link no longer works",
			title: "This link no longer works",
			description:
				"Reset links expire and can only be used once. Ask for a new one to choose a password.",
			action: "Ask for a new link",
		},

		done: {
			documentTitle: "Password changed",
			title: "Password changed",
			description:
				"Your new password is ready, and everything that was signed in to your account has been signed out.",
			action: "Sign in",
		},
	},

	scopes: {
		openid: "Verify your identity",
		profile: "Access your basic profile information",
		email: "Access your email address",
		offline_access: "Keep you signed in when you're not actively using the app",
	},

	authorize: {
		header: {
			title: "{{client}}",
			titleShort: "Sign in",
			description: "Sign in to continue",
		},

		// One line per OAuth error code a refused sign-in can carry, since the sign-in
		// page shows the reason as a single sentence above the form.
		errors: {
			missingValidation: "Verify your email address to continue.",
			accessDenied: "Invalid email or password.",
			serverError: "Something went wrong. Please try again.",
		},

		forms: {
			separator: "or",

			credentials: {
				cta: "Login",
				fields: {
					name: { label: "Display name", placeholder: "Display name" },
					username: { label: "Username", placeholder: "Username" },
					email: { label: "Email", placeholder: "Email" },
					password: { label: "Password", placeholder: "Password" },
				},
			},

			github: {
				cta: "Login with GitHub",
			},

			error: "Sign in failed",
		},

		formPost: {
			title: "Submitting authorization response",
			submit: "Continue",
			noscript: "JavaScript is required to complete this authorization request.",
		},
	},

	sessions: {
		title: "Sessions",
		description:
			"This is a list of devices that have logged into your account. Revoke any sessions you do not recognize.",
		current: "Your current session",
		lastAccessed: "Last accessed on {{date}}",
		status: {
			active: "active",
			stale: "stale",
		},
		actions: {
			revoke: "Revoke",
			revokeAll: "Revoke all other sessions",
			logout: "Logout",
		},
		confirm: {
			cancel: "Cancel",
			revoke: {
				title: "Revoke session?",
				description: "This will log out the device associated with this session.",
				descriptionCurrent:
					"This is your current session. Revoking it will log you out immediately.",
				confirm: "Revoke session",
			},
			revokeAll: {
				title: "Revoke all other sessions?",
				description:
					"This will log out all other devices. Only your current session will remain active.",
				confirm: "Revoke all",
			},
		},
		empty: "No active sessions found.",
		device: {
			desktop: "Desktop",
			mobile: "Mobile",
			tablet: "Tablet",
			unknown: "Unknown device",
		},
		tableLabel: "Active sessions",
		columns: {
			device: "Device",
			ip: "IP address",
			client: "App",
			status: "Status",
			lastAccessed: "Last accessed",
			expires: "Expires",
			actions: "Actions",
		},
	},

	logout: {
		documentTitle: "Logout",
		title: "Are you sure you want to logout?",
		cta: "Logout",
		signing_out: "Signing you out from all applications...",
		redirecting: "Redirecting...",
		continue: "Click here to continue",
	},

	// The page a verification link lands on. Every outcome a token can have gets its own
	// heading and sentence, so nobody is left guessing whether their address is confirmed.
	verifyEmail: {
		documentTitle: "Email verification",
		verified: {
			title: "Email address confirmed",
			description: "Thank you. This address is confirmed, and nothing else is needed here.",
			action: "Go to your account",
		},
		// One message for expired, already used, and malformed alike: distinguishing them
		// tells whoever is holding the link something they should not learn from it.
		invalid: {
			title: "This link no longer works",
			description:
				"Verification links last a few minutes and can only be used once. Sign in and ask for a new one from your profile.",
			action: "Sign in",
		},
		unavailable: {
			title: "Something went wrong",
			description: "We could not check that link just now. Please try again in a moment.",
		},
	},

	splat: {
		notFound: {
			title: "Not Found",
			description: "The page you are looking for does not exist.",
		},
	},

	admin: {
		nav: {
			label: "Admin navigation",
			items: {
				dashboard: "Dashboard",
				clients: "Clients",
				subjects: "Users",
				profile: "Profile",
				logout: "Logout",
			},
		},
		breadcrumbs: {
			label: "Breadcrumb",
		},
		pagination: {
			label: "Pagination",
			previous: "Previous",
			next: "Next",
		},
		dashboard: {
			documentTitle: "Admin Dashboard | Auth",
			title: "Dashboard",
			stats: {
				clients: {
					label: "Total Clients",
					description: "OAuth applications registered",
				},
				subjects: {
					label: "Total Users",
					description: "Registered user accounts",
				},
				sessions: {
					label: "Active Sessions",
					description: "Currently active sessions",
				},
			},
		},
		clients: {
			documentTitle: "Clients | Auth",
			title: "Clients",
			description: "Manage OAuth client applications",
			empty: "No clients found. Create your first client to get started.",
			table: {
				name: "Name",
				redirectUri: "Redirect URI",
				createdAt: "Created",
				actions: "Actions",
			},
			actions: {
				create: "New Client",
				view: "View",
				edit: "Edit",
				delete: "Delete",
				regenerateSecret: "Regenerate Secret",
				copy: "Copy",
				copied: "Copied",
			},
			detail: {
				title: "Client Details",
				id: "Client ID",
				name: "Name",
				description: "Description",
				noDescription: "No description provided",
				secret: "Client Secret",
				secretHidden: "Hidden for security",
				redirectUri: "Redirect URI",
				logoutUri: "Logout URI",
				backchannelLogoutUri: "Back-Channel Logout URI",
				frontchannelLogoutUri: "Front-Channel Logout URI",
				sessionRequired: "Session required",
				notSet: "Not set",
				authorizedUsers: "Authorized Users",
				createdAt: "Created",
			},
			create: {
				documentTitle: "New Client | Auth",
				title: "New Client",
				description: "Register a new OAuth client application",
				success: "Client created successfully. Save the secret - it won't be shown again!",
				secretWarning: "Copy this secret now. You won't be able to see it again.",
			},
			edit: {
				documentTitle: "Edit {{name}} | Auth",
				title: "Edit Client",
				description: "Update client configuration",
				success: "Client updated successfully",
				secretRegenerated: "New secret generated. Save it - it won't be shown again!",
			},
			delete: {
				title: "Delete Client",
				confirm: "Are you sure you want to delete this client? This action cannot be undone.",
				cancel: "Cancel",
				success: "Client deleted successfully",
			},
			form: {
				name: { label: "Name", placeholder: "My Application" },
				description: {
					label: "Description",
					placeholder: "A brief description of your application (max 280 characters)",
				},
				logoUrl: { label: "Logo URL", placeholder: "https://example.com/logo.png" },
				redirectUri: { label: "Redirect URI", placeholder: "https://example.com/callback" },
				logoutUri: { label: "Logout URI", placeholder: "https://example.com/logout" },
				backchannelLogoutUri: {
					label: "Back-Channel Logout URI",
					placeholder: "https://example.com/backchannel-logout",
				},
				backchannelLogoutSessionRequired: {
					label: "Send the session id with back-channel logout tokens",
				},
				frontchannelLogoutUri: {
					label: "Front-Channel Logout URI",
					placeholder: "https://example.com/frontchannel-logout",
				},
				frontchannelLogoutSessionRequired: {
					label: "Send the session id with front-channel logout requests",
				},
				submit: "Save",
				cancel: "Cancel",
				invalid: "Some fields need attention. Check the highlighted ones and try again.",
			},
		},
		subjects: {
			documentTitle: "Users | Auth",
			title: "Users",
			description: "Manage user accounts",
			empty: "No users found.",
			table: {
				avatar: "Avatar",
				displayName: "Name",
				email: "Email",
				role: "Role",
				createdAt: "Joined",
				actions: "Actions",
			},
			actions: {
				view: "View",
				edit: "Edit",
				delete: "Delete",
			},
			detail: {
				title: "User Details",
				id: "User ID",
				displayName: "Display Name",
				username: "Username",
				email: "Email",
				role: "Role",
				avatar: "Avatar",
				emailVerifiedAt: "Email Verified",
				createdAt: "Created",
				notVerified: "Not verified",
			},
			edit: {
				documentTitle: "Edit {{name}} | Auth",
				title: "Edit User",
				description: "Update user information",
				success: "User updated successfully",
			},
			delete: {
				title: "Delete User",
				confirm:
					"Are you sure you want to delete this user? All their sessions will be revoked. This action cannot be undone.",
				success: "User deleted successfully",
			},
			form: {
				displayName: { label: "Display Name", placeholder: "John Doe" },
				username: { label: "Username", placeholder: "johndoe" },
				email: { label: "Email", placeholder: "john@example.com" },
				role: { label: "Role" },
				avatar: { label: "Avatar URL", placeholder: "https://example.com/avatar.png" },
				emailVerified: { label: "Email Verified" },
				submit: "Save",
				cancel: "Cancel",
				invalid: "Some fields need attention. Check the highlighted ones and try again.",
			},
			roles: {
				user: "User",
				admin: "Admin",
			},
			sessions: {
				title: "Active Sessions",
				description: "Manage this user's active sessions. Revoking a session will log them out.",
				empty: "No active sessions.",
				lastAccessed: "Last accessed on {{date}}",
				lastAccessedLabel: "Last accessed",
				expiresLabel: "Expires",
				unknownDevice: "Unknown",
				status: {
					active: "active",
					stale: "stale",
				},
				actions: {
					revoke: "Revoke",
					revokeAll: "Revoke all sessions",
				},
				confirm: {
					cancel: "Cancel",
					revoke: {
						title: "Revoke session?",
						description: "This will log out the device associated with this session.",
						confirm: "Revoke session",
					},
					revokeAll: {
						title: "Revoke all sessions?",
						description:
							"This will log out all devices for this user. They will need to log in again.",
						confirm: "Revoke all",
					},
				},
			},
			connections: {
				title: "Connected Accounts",
				description: "External identities this user can sign in with.",
				empty: "No connected accounts.",
				externalId: "Provider ID",
				linkedAt: "Linked on",
			},
		},
	},

	account: {
		title: "Account",
		breadcrumbsLabel: "Breadcrumb",
		nav: {
			label: "Account navigation",
			items: {
				profile: "Profile",
				sessions: "Sessions",
				grants: "Apps",
				admin: "Admin Panel",
				logout: "Logout",
			},
		},
	},

	profile: {
		title: "Profile",
		description: "Manage your account information",
		view: {
			title: "Your Profile",
			displayName: "Display Name",
			username: "Username",
			email: "Email",
			avatar: "Avatar",
			actions: {
				edit: "Edit Profile",
				sessions: "Manage Sessions",
			},
			// The signal an unverified subject needs: the badge beside their address says what
			// the state is, and the panel says what it costs them and how to fix it.
			emailVerification: {
				verified: "Verified",
				unverified: "Unverified",
				title: "Confirm your email address",
				description:
					"This address has not been confirmed yet, so every app you sign in to is told it is unverified.",
				action: "Send a verification email",
				sent: "Verification email sent. The link in it works for {{minutes}} minutes.",
				// Said as "already sent" rather than as a refusal: the outstanding link is still
				// valid for exactly as long as this window lasts, so there is nothing to wait for.
				cooldown:
					"A verification email was sent to you in the last few minutes. The link in it still works — check your inbox.",
				failed: "The verification email could not be sent. Please try again in a moment.",
			},
		},
		edit: {
			title: "Edit Profile",
			description: "Update your account information",
			success: "Profile updated successfully",
			form: {
				displayName: { label: "Display Name", placeholder: "John Doe" },
				username: { label: "Username", placeholder: "johndoe" },
				avatar: { label: "Avatar URL", placeholder: "https://example.com/avatar.png" },
				submit: "Save Changes",
				cancel: "Cancel",
			},
			errors: {
				invalid: "Please check the highlighted fields and try again.",
				usernameTaken: "That username is already taken.",
			},
		},
	},

	grants: {
		title: "Authorized Apps",
		description:
			"Apps you have authorized to access your account. You can revoke access at any time.",
		empty: "No authorized apps found.",
		authorizedOn: "Authorized on {{date}}",
		tableLabel: "Authorized apps",
		columns: {
			app: "App",
			authorizedOn: "Authorized",
			actions: "Actions",
		},
		cannotRevoke: "Required",
		actions: {
			revoke: "Revoke Access",
		},
		confirm: {
			cancel: "Cancel",
			revoke: {
				title: "Revoke access?",
				description:
					"This will revoke {{client}}'s access to your account and log you out of that app.",
				confirm: "Revoke Access",
			},
		},
	},
};
