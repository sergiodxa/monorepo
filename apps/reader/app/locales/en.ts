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
		/** The feeds a reader pinned, drawn first because that is what pinning was for. */
		pinned: "Pinned",
		/** The feeds nobody grouped and that publish almost nothing, drawn last. */
		quiet: "Quiet",
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
	/**
	 * Reading one post on its own page: what the feed gave, and the article behind the
	 * link when the reader's plan carries fetching it.
	 */
	post: {
		notFound: {
			title: "That post is not here",
			description: "It may have aged out of your timeline, or it was never yours.",
			back: "Back to your queue",
		},
		/** Where the post came from, said above the article as a link to the original. */
		source: "From {{feed}}",
		original: "Open the original",
		back: "Back to {{feed}}",
		/** What a save actually keeps, said on the control rather than discovered in two years. */
		saveKeeps:
			"Saving keeps the title, the excerpt and the link. When the site goes, the link goes.",
		article: {
			heading: "The article",
			pending: "Fetching the article\u2026",
			/** Every one of these leaves the excerpt and the link exactly where they were. */
			refused: "This site does not allow reading here.",
			timeout: "This page took too long to read.",
			empty: "There is nothing to read here.",
			/** Said to a reader whose plan does not carry fetching the article. */
			upgrade: "Reading articles in place is part of the paid plan.",
			/** Who the article is by, printed under its own heading. */
			byline: "By {{byline}}",
		},

		/** The episode or the clip the post came with, played by the browser's own element. */
		media: {
			label: "Play this post's audio or video",
			unsupported: "Your browser cannot play this file.",
			download: "Open it directly.",
		},
	},

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
		/** That one of the reader's own filters picked this post out as it arrived. */
		flagged: "Flagged",
		openPost: "Open post",
		readHere: "Read here",
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
				description:
					"Search reads the title, the summary and the author of each post, not the article behind it.",
			},
			unread: {
				title: "Nothing unread matches",
				description:
					"Search reads the title, the summary and the author of each unread post. Try All.",
			},
			read: {
				title: "Nothing read matches",
				description:
					"Search reads the title, the summary and the author of each post you have read. Try All.",
			},
		},
		/**
		 * What a search page looked at, said under the list. A search that shows nothing has
		 * to name the span it covered, because the confusing failure is the one where the
		 * post exists and the search was never allowed to reach it.
		 */
		searched: {
			/** Stopped at a step, which the reader carries on from with the same link. */
			step: "Searched back to {{date}}.",
			continue: "Keep searching",
			/** Stopped at the oldest post the tier lets a search reach. */
			window:
				"Searched back to {{date}}. Free searches the last {{days}} days. Everything you have kept is searchable on Paid.",
			/** Stopped at the oldest post stored, so there is nothing further to search. */
			archive: "Searched everything you have kept, back to {{date}}.",
		},
		noFeeds: {
			title: "Nothing to read yet",
			description:
				"Paste a feed address, or the address of a site that publishes one, into the box above.",
		},
	},

	/** The queries a reader kept, which the rail draws as addresses of the queue itself. */
	searches: {
		/** Names the rail's band of kept queries. */
		label: "Saved searches",
		save: "Save this search",
		nameLabel: "Name this search",
		namePlaceholder: "What to call it",
		saved: "Search saved.",
		forget: "Forget this search",
		forgotten: "Search forgotten.",
		error: {
			invalidName: "Give the search a name of up to {{length}} characters.",
			invalidQuery: "Type something to search for before saving it.",
			duplicateName: "You already have a saved search by that name.",
			notFound: "That saved search is no longer there.",
			full: "You have {{limit}} saved searches — forget one to make room.",
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

		/** Pinning a feed above the queue, from that feed's own page. */
		pin: {
			label: "Pinned feeds",
			submit: "Pin",
			remove: "Unpin",
			pinned: "Pinned above your reading.",
			unpinned: "Taken off the pinned strip.",
			full: "You have pinned as many feeds as the strip holds. Unpin one to pin another.",
			/** Said on a pinned feed with nothing waiting, which is the point of pinning it. */
			caughtUp: "Nothing new.",
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
		/**
		 * The one preference about privacy a reader is offered, and it exists because two
		 * readers can correctly want different answers: almost every publisher's server is
		 * indifferent to a campaign parameter, and the rare one that routes on it answers a
		 * broken address without it.
		 */
		linkParameters: {
			keep: "Keep link parameters",
			strip: "Strip link parameters",
			kept: "Links to this feed now open exactly as published.",
			stripped: "Tracking parameters are removed from this feed's links again.",
		},

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

	/**
	 * The labels a reader puts on the posts they kept. A label answers why something was
	 * kept, where a folder answers where a publication belongs, so nothing here talks about
	 * subscriptions and nothing here deletes a post.
	 */
	/**
	 * The rules a reader writes about what a post says, applied as posts arrive. Every
	 * sentence here is written so a rule reads as one: when the <field> of a post contains
	 * <value>, <action> it.
	 */
	rules: {
		title: "Filters",
		heading: "Filters",
		description:
			"A filter reads one part of a post, looks for a piece of text in it, and decides what happens to that post as it arrives. Filters act on what arrives from now on and leave everything already here alone.",
		/** The one surprise in the language, said where the field is chosen rather than after. */
		summaryCaveat:
			"A filter on the summary reads the first 280 characters, which is the line under the title — not the article.",
		/** Said to a reader whose plan runs no filters, which deletes none they have. */
		notEntitled: "Filters are part of a paid plan. Nothing you follow or have read changes.",
		empty: "You have no filters yet.",
		/** One rule, read back as the sentence it is. */
		sentence: "When the {{field}} of a post contains “{{value}}”, {{action}} it.",
		scope: {
			all: "Every feed you follow",
			feed: "Only {{feed}}",
		},
		fields: {
			legend: "Part of the post",
			title: "title",
			url: "link",
			summary: "summary",
			author: "author",
		},
		actions: {
			legend: "What happens to it",
			drop: "drop",
			mark_read: "mark it read",
			flag: "flag",
		},
		/** What the counters on a rule say, which is the one number that says it is working. */
		matched_one: "Decided {{count}} post.",
		matched_other: "Decided {{count}} posts.",
		neverMatched: "This filter has never matched a post.",
		lastMatched: "Last matched {{date}}.",
		form: {
			legend: "Add a filter",
			value: "Text to look for",
			valuePlaceholder: "Sponsored…",
			feed: "Where it applies",
			allFeeds: "Every feed you follow",
			submit: "Add filter",
			update: "Save changes",
			delete: "Delete filter",
		},
		/** The preview, which is the whole of what looks backwards and writes nothing. */
		preview: {
			legend: "What this would have caught",
			submit: "Preview",
			result_one: "{{count}} of your newest {{scanned}} posts matches.",
			result_other: "{{count}} of your newest {{scanned}} posts match.",
			none: "None of your newest {{scanned}} posts match. Check the part of the post you chose and the spelling of the text.",
			/** The one shape worth a warning: a term every post carries empties the list. */
			everything:
				"This matches every one of your newest posts. A filter that drops them all leaves a feed synchronizing into an empty timeline.",
			apply_one: "Apply to the {{count}} post above",
			apply_other: "Apply to the {{count}} posts above",
			applied_one: "{{count}} post was acted on.",
			applied_other: "{{count}} posts were acted on.",
		},
		notice: {
			created: "Filter added. It acts on what arrives from now on.",
			updated: "Filter saved.",
			deleted: "Filter deleted. No post was removed.",
			limit: "You have as many filters as your plan allows. Delete one to add another.",
			invalidValue: "A filter needs text of up to 100 characters to look for.",
			invalidField: "That is not one of the parts of a post a filter can read.",
			invalidAction: "That is not one of the things a filter can do.",
			notFollowing: "That is not a feed you follow.",
			missing: "That filter is no longer one of yours.",
		},
	},

	tags: {
		created: "Label made.",
		renamed: "Label renamed.",
		duplicate: "You already have a label reading under that name.",
		invalid: "A label needs a name of up to 32 characters.",
		full: "You have as many labels as this holds. Delete one to make another.",
		/** A post carrying ten reasons to have been kept has none, which is what this says. */
		postFull: "That post already carries as many labels as one post can.",
		/** Labelling keeps the post, so a full shelf refuses the label for the same reason. */
		savedFull: "Your saved posts are full, so nothing was labelled. Remove one to make room.",
		notEntitled: "Labels are part of a paid plan. Everything you have kept stays where it is.",
		missing: "That label is no longer one of yours.",

		/** The field both the naming forms type into. */
		name: {
			label: "Label name",
			placeholder: "Name this label…",
		},

		/** The strip of labels under a kept post, and the field that adds another. */
		strip: {
			legend: "Labels on this post",
			add: "Add a label",
			placeholder: "Label…",
			remove: "Remove",
		},

		rename: {
			legend: "Rename this label",
			submit: "Rename",
		},

		delete: {
			title: "Delete a label",
			submit: "Delete label",
			/** Backs out of the prompt, leaving the label as it is. */
			cancel: "Cancel",
			/** Says what is lost, which is the label and nothing else. */
			confirm_one: "Delete {{name}}? {{count}} post stops carrying it and stays saved.",
			confirm_other: "Delete {{name}}? {{count}} posts stop carrying it and stay saved.",
		},

		empty: {
			title: "Nothing under this label yet",
			description: "Put this label on a post from your saved posts and it arrives here.",
		},

		notFound: {
			title: "Label not found",
			description: "You do not have a label with that address.",
			back: "Back to your saved posts",
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
		 * What the reader may change about how their pages look, which is everything this app
		 * offers on the subject: a scheme and a reading face.
		 */
		appearance: {
			legend: "How your pages look",
			description:
				"Both follow you to any browser you sign in on, and both take effect on the next page.",
			theme: {
				label: "Colours",
				names: {
					system: "Follow my system",
					light: "Light",
					dark: "Dark",
				},
			},
			face: {
				label: "Reading face",
				names: {
					sans: "Sans serif",
					serif: "Serif",
				},
				hint: "The face is used for posts and articles. Menus and controls stay as they are.",
			},
			save: "Save",
			saved: "Saved.",
		},

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
			allowance: "{{feeds}} feeds, {{saved}} saved posts, {{posts}} posts kept.",
			/**
			 * What the count of posts above means for the reader. The allowance states that
			 * count rather than promising history for ever, because the object holding it has
			 * a limit, and this says what the reader gets while they are inside it.
			 */
			history: "Nothing is deleted while you are inside these numbers.",
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

	/**
	 * Notifications: what a scheduled check says when it finds something, how the reader is
	 * reached, and the two places they decide any of it.
	 */
	notifications: {
		/** The line a lock screen and an inbox both lead with, which is a count and nothing else. */
		title_one: "One new post",
		title_other: "{{count}} new posts",
		/** Up to three publishers by name, which is what makes the count worth tapping. */
		body_one: "From {{feeds}}.",
		body_other: "From {{feeds}}.",

		email: {
			footer:
				"You are getting this because you asked to hear about some of the feeds you follow. You can change that in Settings.",
		},

		legend: "Notifications",
		description:
			"When a check finds posts in a feed you picked, you get one notification about all of them. Nothing is ever sent about a feed you have not picked.",
		noFeeds: "No feeds are picked yet. Open a feed and turn notifications on there.",
		noChannel: "You have picked feeds and no way to be reached. Turn one on below.",

		channels: {
			legend: "How you are reached",
			push: "On the browsers you allow",
			pushHint: "Your browser will ask once. Nothing is sent until you allow it.",
			email: "By email",
			emailHint: "Sent at most once every four hours, to {{address}}.",
			emailUnknown: "Sent at most once every four hours.",
			emailLocked: "Email comes with the Premium plan.",
			save: "Save",
			saved: "Saved.",
			notEntitled: "Email comes with the Premium plan, so nothing changed.",
		},

		quiet: {
			legend: "Quiet hours",
			description:
				"Nothing arrives between these hours. A notification held back is not lost: the next check outside the window carries it.",
			enabled: "Leave me alone between these hours",
			from: "From",
			to: "Until",
			hour: "{{hour}}:00",
			zone: "Read in {{zone}}, as your browser reported it.",
			save: "Save",
			saved: "Saved.",
		},

		devices: {
			legend: "Browsers",
			description: "Every browser you allowed. Forgetting one stops it being notified.",
			none: "No browser is registered yet.",
			added: "Added {{date}}",
			never: "Nothing delivered yet",
			delivered: "Last delivered {{date}}",
			forget: "Forget",
			forgotten: "That browser will not be notified again.",
			missing: "That browser was already forgotten.",
		},

		feed: {
			legend: "Notifications",
			description:
				"Hear about this feed when a check finds something. How you are reached is set once, in Settings.",
			on: "Notify me about this feed",
			off: "Stop notifying me about this feed",
			turnedOn: "You will hear about this feed.",
			turnedOff: "You will not hear about this feed.",
			missing: "That feed could not be found.",
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
