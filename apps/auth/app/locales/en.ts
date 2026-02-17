export default {
	layout: {
		meta: {
			title: "Auth by Sergio Xalambrí",
			description: "Simple & reliable authentication for developers",
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
			title: "Access to {{client}}",
			description: "Sign in to continue to {{client}}",
		},

		standalone: {
			title: "Sign in",
			description: "Sign in to your account for faster access to connected apps",
		},

		errors: {
			invalidRequest: {
				title: "Invalid request",
				description: "The request is invalid.",
			},
			unauthorizedClient: {
				title: "Unauthorized client",
				description: "This application is not authorized to use your account.",
			},
		},

		forms: {
			separator: "or",

			credentials: {
				cta: "Login",
				fields: {
					name: { placeholder: "Display name" },
					username: { placeholder: "Username" },
					email: { placeholder: "Email" },
					password: { placeholder: "Password" },
				},
			},

			github: {
				cta: "Login with GitHub",
				reminder: "Last time you logged in with GitHub",
			},
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
		empty: "No active sessions found.",
		device: {
			desktop: "Desktop",
			mobile: "Mobile",
			tablet: "Tablet",
			unknown: "Unknown device",
		},
	},

	logout: {
		title: "Are you sure you want to logout?",
		cta: "Logout",
	},

	splat: {
		notFound: {
			title: "Not Found",
			description: "The page you are looking for does not exist.",
		},
	},
};
