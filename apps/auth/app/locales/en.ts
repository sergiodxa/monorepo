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
