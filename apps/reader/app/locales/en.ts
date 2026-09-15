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
		search: "Search",
		settings: "Settings",
		logout: "Sign out",
	},

	/** Searching the posts of every followed feed. */
	search: {
		title: "Search",
		heading: "Search",
		label: "Search your posts",
		placeholder: "What are you looking for?",
		submit: "Search",
		resultsFor: "Posts matching “{{query}}”.",
		results_one: "{{count}} post matches “{{query}}”.",
		results_other: "{{count}} posts match “{{query}}”.",
		none: {
			title: "Nothing matches",
			description: "No post in any feed you follow contains those words.",
		},
		prompt: {
			title: "Search your reading",
			description: "Type what you remember of a post's title or summary.",
		},
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
		/**
		 * Marking a whole queue read is one sweep with no undo, so the trigger opens a
		 * prompt carrying the warning rather than acting on the first click.
		 */
		markAllRead: {
			submit: "Mark everything read",
			title: "Mark everything read",
			confirm:
				"Mark every unread post read, across every feed you follow? Nothing here records what was unread, so this cannot be undone.",
			cancel: "Cancel",
		},
		markFeedRead: "Mark this feed read",
		markedRead_one: "{{count}} post marked read.",
		markedRead_other: "{{count}} posts marked read.",
		nothingToMark: "There was nothing unread to mark.",
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
				description: "Paste a feed address above, or the address of a site that publishes one.",
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

		/** Checking every followed feed at once, from the subscription list. */
		checkAll: {
			submit: "Check every feed",
			done_one: "Checked {{count}} feed.",
			done_other: "Checked {{count}} feeds.",
			newPosts_one: "{{count}} feed had new posts.",
			newPosts_other: "{{count}} feeds had new posts.",
			nothingNew: "No feed had anything new.",
			failed_one: "{{count}} feed could not be reached.",
			failed_other: "{{count}} feeds could not be reached.",
		},

		/** Carrying subscriptions to and from another reader. */
		transfer: {
			/** Names the section on the settings page that carries subscriptions in and out. */
			legend: "Carrying your subscriptions",
			export: "Download as OPML",
			/** The exported document's own title, which the receiving reader shows. */
			documentTitle: "Reader subscriptions",
			import: {
				label: "OPML file",
				description: "A subscription list exported from another reader.",
				submit: "Import",
				added_one: "Followed {{count}} new feed.",
				added_other: "Followed {{count}} new feeds.",
				alreadyFollowing_one: "{{count}} was already followed.",
				alreadyFollowing_other: "{{count}} were already followed.",
				failed_one: "{{count}} could not be retrieved.",
				failed_other: "{{count}} could not be retrieved.",
				empty: "That file lists no feeds.",
				unreadable: "That file could not be read as OPML.",
				tooLarge:
					"That file is larger than this app will read. A subscription list is a few hundred kilobytes at most.",
				missing: "Choose an OPML file to import.",
			},
		},

		/** Paging the subscription list, which is long once a reader follows enough. */
		paging: {
			newer: "Newer subscriptions",
			older: "Older subscriptions",
		},

		/** What asking for a feed to be checked on the spot reports back. */
		check: {
			submit: "Check now",
			new: "New posts arrived.",
			none: "Nothing new since the last check.",
			failed: "That feed could not be reached just now. The next scheduled check will try again.",
		},

		unfollow: {
			title: "Unfollow a feed",
			submit: "Unfollow",
			/** Backs out of the prompt, leaving the feed followed. */
			cancel: "Cancel",
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
