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

	/** The sidebar every signed-in page wears. */
	nav: {
		label: "Sections",
		reading: "Reading",
		saved: "Saved",
		feeds: "Feeds",
		subscriptions: "Followed feeds",
		openSidebar: "Show feeds and search",
		settings: "Settings",
		account: "Your account",
		logout: "Sign out",
	},

	/** The box the sidebar searches every followed feed's posts from. */
	search: {
		label: "Search your posts",
		placeholder: "What are you looking for?",
	},

	/** Shared by both timelines, which offer the same way through a long list of posts. */
	timeline: {
		newer: "Newer posts",
		older: "Older posts",
		markRead: "Mark as read",
		markUnread: "Mark as unread",
		markFailed: "Could not be marked — try again",
		read: "Read",
		/** Keeping a post, which is the one thing here no rule that deletes a post reaches. */
		save: "Save",
		unsave: "Remove from saved",
		saveFailed: "Could not be saved — try again",
		/** Said where a save was refused outright, which is a shelf with no room left on it. */
		saveFull: "Your saved posts are full — remove one to make room",
		/** That a post is being kept, for a reader who cannot see the mark it is kept with. */
		saved: "Saved",
		openPost: "Open post",
		publishedOn: "Published {{date}}",
		byAuthor: "by {{author}}",
		badCursor: "That page is no longer there.",
		restart: "Back to the newest",
		/**
		 * Marking a whole queue read is one sweep with no undo, so the trigger opens a
		 * prompt carrying the warning rather than acting on the first click.
		 */
		markAllRead: {
			/** Short enough for a row of controls, and still saying how far the sweep reaches. */
			submit: "Mark all read",
			title: "Mark everything read",
			confirm:
				"Mark every unread post read, across every feed you follow? Nothing here records what was unread, so this cannot be undone.",
			cancel: "Cancel",
		},
		markFeedRead: "Mark feed read",
		/** Said where the list stops, so it is known to have an end rather than to go on. */
		end: "You have reached the end.",
		markedRead_one: "{{count}} post marked read.",
		markedRead_other: "{{count}} posts marked read.",
		nothingToMark: "There was nothing unread to mark.",
	},

	reading: {
		heading: "Reading",
		/** The same queue, narrowed to words somebody typed, which the heading says back. */
		headingFor: "Reading about “{{query}}”",
		/**
		 * What the queue knows is missing from it, which is the question a reader opening it
		 * has and the one nothing here could answer before. The posts are being fetched behind
		 * the page, so the sentence says that rather than offering a button that waits for them.
		 */
		waiting_one: "One feed has posts you have not got yet. They are arriving now.",
		waiting_other: "{{count}} feeds have posts you have not got yet. They are arriving now.",
		/** Which of the queue's posts the page holds, named beside the heading. */
		filter: {
			label: "Show",
			all: "All",
			unread: "Unread",
			read: "Read",
		},
		/**
		 * An empty queue reads differently under each filter: nothing published, nothing left
		 * to read, and nothing read so far are three different pieces of news.
		 */
		empty: {
			all: {
				title: "Nothing here yet",
				description: "The feeds you follow have published nothing so far.",
			},
			unread: {
				title: "You are all caught up",
				description: "Every post from every feed you follow has been read.",
			},
			read: {
				title: "Nothing read yet",
				description: "Posts collect here as you open them or mark them read.",
			},
		},
		/**
		 * A search that found nothing says so about the words rather than about the queue,
		 * and under a filter it says which of the two came up empty, since widening the
		 * filter is what a reader does next.
		 */
		found: {
			all: {
				title: "Nothing matches",
				description: "No post in any feed you follow contains those words.",
			},
			unread: {
				title: "Nothing unread matches",
				description: "Every post containing those words has been read. Try All.",
			},
			read: {
				title: "Nothing read matches",
				description: "No post you have read contains those words. Try All.",
			},
		},
		noFeeds: {
			title: "Nothing to read yet",
			description:
				"Paste a feed address, or the address of a site that publishes one, into the box above.",
		},
	},

	/** The posts a reader asked to keep, which is the one list here nothing prunes. */
	saved: {
		title: "Saved",
		heading: "Saved",
		empty: {
			title: "Nothing saved yet",
			description:
				"Keep a post from any list and it stays here — however old it gets, and whatever the feed it came from does.",
		},
	},

	feeds: {
		/** How many of a feed's posts are waiting, said beside its name in the sidebar. */
		unread_one: "{{count}} unread",
		unread_other: "{{count}} unread",

		follow: {
			label: "Feed or site address",
			placeholder: "Follow a feed or site…",
			error: {
				invalidUrl: "That is not an address this app can fetch. Use one starting http or https.",
				notFound: "Nothing at that address publishes an RSS or Atom feed.",
				unreachable: "That address could not be reached. Try again in a moment.",
				alreadyFollowing: "You already follow that feed.",
				/**
				 * The one refusal here whose sentence carries a number, because the way out is the
				 * reader's and it is a count. It names both ways out and puts neither first.
				 */
				overLimit_one:
					"Your plan follows {{count}} feed. Unfollow one, or move up a plan, to follow another.",
				overLimit_other:
					"Your plan follows {{count}} feeds. Unfollow one, or move up a plan, to follow another.",
			},
		},

		show: {
			title: "Feed",
			visitSite: "Visit site",
			checked: "Checked {{date}}",
			neverChecked: "Not checked yet",
			failing_one: "The last check failed",
			failing_other: "The last {{count}} checks failed",
			/** How many checks failed and what the last one recorded, read as one badge. */
			failingBecause: "{{failures}} — {{reason}}",
			empty: {
				title: "No posts yet",
				description: "This feed has published nothing since you started following it.",
			},
			notFound: {
				title: "Feed not found",
				description: "You do not follow a feed with that address.",
				back: "Back to your reading",
			},
		},

		/** Checking every followed feed at once, from the reading queue. */
		checkAll: {
			/** Said against the feed page's own "Check feed", so the reach of each is plain. */
			submit: "Check all",
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

		/** What asking for a feed to be checked on the spot reports back. */
		check: {
			submit: "Check feed",
			new: "New posts arrived.",
			none: "Nothing new since the last check.",
			failed: "That feed could not be reached just now. The next scheduled check will try again.",
		},

		/**
		 * How long this feed's posts stay in the reader's own timeline. Each span says what it
		 * is for as well as how long it holds, since the name alone is a category and the hours
		 * alone are a number: a reader choosing between them is matching the two.
		 */
		velocity: {
			legend: "How long these posts stay",
			/** Said inside the menu, where a reader is choosing rather than reading the page. */
			description: "Older posts leave your timeline, read or not. Saved posts always stay.",
			saved: "Saved.",
			invalid: "That is not one of the spans on offer.",
			/** What each span is for, which is the word the control wears once it is chosen. */
			name: {
				breaking: "Breaking",
				news: "News",
				article: "Articles",
				essay: "Essays",
				evergreen: "Evergreen",
			},
			/** And how long it holds, read beside the name rather than folded into it. */
			window: {
				breaking: "3 hours",
				news: "18 hours",
				article: "3 days",
				essay: "2 weeks",
				evergreen: "Forever",
			},
			/**
			 * Offered beside the control rather than acted on: a measurement is a good reason to
			 * ask a reader a question and a bad reason to delete their posts, so this says what
			 * the feed does and leaves the answer where it was.
			 */
			suggestion_one:
				"This feed publishes about {{count}} post a day and nothing here ever leaves. A shorter span keeps it from becoming a backlog.",
			suggestion_other:
				"This feed publishes about {{count}} posts a day and nothing here ever leaves. A shorter span keeps it from becoming a backlog.",
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

	/**
	 * Named groups of subscriptions, each read as one stream. A folder is somewhere a
	 * reader goes rather than a place posts are kept, which is why nothing here talks about
	 * losing any.
	 */
	folders: {
		created: "Folder made.",
		renamed: "Folder renamed.",
		duplicate: "You already have a folder by that name.",
		invalid: "A folder needs a name.",

		/** The field both the naming forms type into. */
		name: {
			label: "Folder name",
			placeholder: "Name this folder…",
		},

		create: {
			legend: "Make a folder",
			submit: "New folder",
		},

		rename: {
			legend: "Rename this folder",
			submit: "Rename",
		},

		delete: {
			title: "Delete a folder",
			submit: "Delete folder",
			/** Backs out of the prompt, leaving the folder as it is. */
			cancel: "Cancel",
			/** Says what is lost, which is the filing and nothing else. */
			confirm: "Delete {{title}}? Its feeds go back among the unfiled ones and keep every post.",
		},

		/** Putting one feed into a folder, from that feed's own page. */
		file: {
			legend: "Which folder this feed reads in",
			description: "Pick a folder, or name a new one.",
			/** What the control says for a feed the reader has filed nowhere. */
			none: "No folder",
			remove: "Take out of this folder",
			submit: "File",
			filed: "Filed.",
			unfiled: "Taken out of its folder.",
			gone: "That folder is no longer one of yours.",
		},

		empty: {
			title: "Nothing here yet",
			description:
				"File a feed into this folder from that feed's own page and its posts arrive here.",
		},

		notFound: {
			title: "Folder not found",
			description: "You do not have a folder with that address.",
			back: "Back to your reading",
		},
	},

	items: {
		read: {
			title: "Mark as read",
			notFound: "That post is not in your reading queue.",
		},
		save: {
			title: "Save a post",
			notFound: "That post is not in your reading queue.",
			/**
			 * A full shelf is told to the reader rather than made room on, since making room
			 * would delete a post they asked to keep. The way out is theirs to choose.
			 */
			full: "You have saved as many posts as this keeps. Remove one from Saved to make room for another.",
		},
	},

	settings: {
		title: "Settings",
		heading: "Settings",
		/**
		 * What the schedule is, rather than a choice of one. Checking a feed more often spends
		 * the bandwidth of the site publishing it, and a reader who wants a feed sooner has the
		 * check they can ask for on the feed's own page, which is what this points them at.
		 */
		cadence: {
			legend: "How your feeds are checked",
			description:
				"Every feed is checked once a day. To see one sooner, open it and use Check feed.",
		},
		lastRefreshed: "Last checked {{date}}",
		neverRefreshed: "Not checked yet",

		/**
		 * What the reader is on and what it allows, said in numbers. Nothing here counts down,
		 * because nothing expires and nothing is deleted: a countdown on a page where nothing
		 * is going to happen is urgency invented to sell.
		 */
		plan: {
			legend: "Your plan",
			current: "You are on {{plan}}.",
			names: {
				free: "Free",
				paid: "Paid",
				premium: "Premium",
			},
			/** What each plan allows, as the numbers the reader is measured against. */
			allowance: "{{feeds}} feeds, {{saved}} saved posts.",
			usage: "You follow {{feeds}} feeds and have saved {{saved}} posts.",
			upgrade: "Move to {{plan}}",
			manage: "Manage billing",
			/**
			 * A failed card is not a data event on the day it fails. The sentence says what is
			 * true — nothing has changed — and points at the page where a card is replaced.
			 */
			lapsed:
				"Your payment did not go through. Nothing has changed, and everything you follow is still here. Update your card to keep it that way.",
			/**
			 * Over a limit, stated as the two ways out and no third. Both belong to the reader,
			 * and nothing of theirs is deleted while they decide.
			 */
			over: {
				legend: "Over your plan",
				description:
					"Nothing has been deleted, and nothing will be. New additions are paused until you are back inside these numbers or on a larger plan.",
				feeds_one: "Unfollow {{count}} feed, or move up a plan.",
				feeds_other: "Unfollow {{count}} feeds, or move up a plan.",
				saved_one: "Unsave {{count}} post, or move up a plan.",
				saved_other: "Unsave {{count}} posts, or move up a plan.",
				posts_one: "{{count}} post over what this plan holds.",
				posts_other: "{{count}} posts over what this plan holds.",
				rules_one: "{{count}} rule over what this plan runs.",
				rules_other: "{{count}} rules over what this plan runs.",
			},
		},
	},

	/** What stands in for a part of a page that did not load. */
	frame: {
		failed: "This part of the page did not load.",
		retry: "Reload",
	},

	notFound: {
		title: "Page not found",
		description: "The page you asked for does not exist.",
		goBackHome: "Go back home",
	},
};
