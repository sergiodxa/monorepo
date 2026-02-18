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
			title: "{{client}}",
			titleShort: "Sign in",
			description: "Sign in to continue",
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
		dashboard: {
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
				authorizedUsers: "Authorized Users",
				createdAt: "Created",
			},
			create: {
				title: "New Client",
				description: "Register a new OAuth client application",
				success: "Client created successfully. Save the secret - it won't be shown again!",
				secretWarning: "Copy this secret now. You won't be able to see it again.",
			},
			edit: {
				title: "Edit Client",
				description: "Update client configuration",
				success: "Client updated successfully",
				secretRegenerated: "New secret generated. Save it - it won't be shown again!",
			},
			delete: {
				title: "Delete Client",
				confirm: "Are you sure you want to delete this client? This action cannot be undone.",
				success: "Client deleted successfully",
			},
			form: {
				name: { label: "Name", placeholder: "My Application" },
				description: {
					label: "Description",
					placeholder: "A brief description of your application (max 280 characters)",
				},
				redirectUri: { label: "Redirect URI", placeholder: "https://example.com/callback" },
				logoutUri: { label: "Logout URI", placeholder: "https://example.com/logout" },
				submit: "Save",
				cancel: "Cancel",
			},
		},
		subjects: {
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
		},
	},

	account: {
		nav: {
			label: "Account navigation",
			items: {
				profile: "Profile",
				sessions: "Sessions",
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
		},
	},
};
