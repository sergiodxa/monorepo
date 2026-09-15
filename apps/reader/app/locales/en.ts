/**
 * English translation dictionary and the canonical source of truth for every translatable
 * string: the landing page, the sign-in and sign-out flows, each reading surface, and the
 * error copy. Every other locale file mirrors this shape, because a key missing from a
 * dictionary renders as the key itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export default {
	app: {
		name: "Reader",
	},

	landing: {
		meta: {
			title: "Reader",
			description:
				"Follow any site that publishes RSS or Atom and read everything it writes in one place, newest first.",
		},

		hero: {
			title: "Read the web on your own terms",
			description:
				"Follow any site that publishes RSS or Atom and read everything it writes in one queue. No algorithm decides the order, and nothing you read is sold on.",
			cta: "Sign in to start reading",
		},

		features: {
			queue: {
				title: "One queue, in order",
				description:
					"Every post from every feed you follow, newest first. No algorithm reorders it and nothing is promoted into it.",
			},
			private: {
				title: "Nobody watches you read",
				description:
					"What you follow and what you have read is yours. There is no tracking, no advertising, and nothing to sell on.",
			},
			openWeb: {
				title: "Built on the open web",
				description:
					"Any URL that publishes RSS or Atom works. No platform has to agree, and nothing is locked behind an API key.",
			},
		},
	},

	auth: {
		error: {
			title: "Sign-in failed",
			missingIdToken:
				"The identity provider answered without an ID token, so nobody was signed in.",
			generic: "Something went wrong while signing you in. Try again.",
		},
	},

	logout: {
		title: "Sign out",
		cta: "Sign out",
	},

	/** The toolbar every signed-in page wears. */
	nav: {
		label: "Sections",
		reading: "Reading",
		feeds: "Feeds",
		settings: "Settings",
		logout: "Sign out",
	},

	/** Shared by both timelines, which offer the same way through a long list of posts. */
	timeline: {
		newer: "Newer posts",
		older: "Older posts",
		markRead: "Mark as read",
		markUnread: "Mark as unread",
		read: "Read",
		openPost: "Open post",
		publishedOn: "Published {{date}}",
		byAuthor: "by {{author}}",
		badCursor: "That page of posts is no longer there.",
		restart: "Back to the newest",
	},

	reading: {
		title: "Reading",
		heading: "Reading",
		caughtUp: {
			title: "You are all caught up",
			description: "Every post from every feed you follow has been read.",
		},
		noFeeds: {
			title: "Nothing to read yet",
			description: "Follow a site that publishes RSS or Atom and its posts land here.",
			cta: "Follow your first feed",
		},
	},

	feeds: {
		index: {
			title: "Feeds",
			heading: "Feeds",
			empty: {
				title: "You follow nothing yet",
				description: "Paste a feed address below, or the address of a site that publishes one.",
			},
			unread_one: "{{count}} unread",
			unread_other: "{{count}} unread",
			allRead: "All read",
			checked: "Checked {{date}}",
			neverChecked: "Not checked yet",
			failing_one: "The last check failed",
			failing_other: "The last {{count}} checks failed",
			/** How many checks failed and what the last one recorded, read as one badge. */
			failingBecause: "{{failures}} — {{reason}}",
		},

		follow: {
			title: "Follow a feed",
			label: "Feed or site address",
			description: "A feed address, or a site that advertises one.",
			placeholder: "https://example.com",
			submit: "Follow",
			error: {
				invalidUrl: "That is not an address this app can fetch. Use one starting http or https.",
				notFound: "Nothing at that address publishes an RSS or Atom feed.",
				unreachable: "That address could not be reached. Try again in a moment.",
				alreadyFollowing: "You already follow that feed.",
			},
		},

		show: {
			title: "Feed",
			visitSite: "Visit site",
			empty: {
				title: "No posts yet",
				description: "This feed has published nothing since you started following it.",
			},
			notFound: {
				title: "Feed not found",
				description: "You do not follow a feed with that address.",
				back: "Back to your feeds",
			},
		},

		unfollow: {
			title: "Unfollow a feed",
			submit: "Unfollow",
			confirm: "Stop following {{title}}? Its posts, and what you have read of them, go with it.",
		},

		/** What the last refresh of a feed recorded, shown beside a feed that is struggling. */
		status: {
			http_error: "The site answered with an error",
			network_error: "The site could not be reached",
			parse_error: "The feed could not be read",
		},
	},

	items: {
		read: {
			title: "Mark as read",
			notFound: "That post is not in your reading queue.",
		},
	},

	settings: {
		title: "Settings",
		heading: "Settings",
		refresh: {
			legend: "How often to check for new posts",
			description:
				"Every feed you follow is checked on this schedule. Checking more often finds posts sooner and costs the sites you read a little more.",
			submit: "Save",
			saved: "Saved.",
			invalid: "That is not one of the schedules on offer.",
		},
		interval_one: "Every hour",
		interval_other: "Every {{count}} hours",
		lastRefreshed: "Last checked {{date}}",
		neverRefreshed: "Not checked yet",
	},

	notFound: {
		title: "Page not found",
		description: "The page you asked for does not exist.",
		goBackHome: "Go back home",
	},
};
