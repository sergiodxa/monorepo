/**
 * English copy for the public pages: the home, each feature, each way of reading and each
 * comparison, with the header and footer they share. Figures arrive as variables read from
 * the limits the app enforces, so no sentence here states a number of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export default {
	meta: {
		title: "Reader — every feed you follow, in one quiet queue",
		description:
			"Follow any site that publishes RSS or Atom. Reader checks each feed as often as it publishes and puts every new post in one queue, newest first, with nothing promoted into it.",
	},

	nav: {
		label: "Main",
		menu: "Open menu",
		close: "Close menu",
		signIn: "Sign in",
		open: "Open your reading",
		plans: "Plans",
		descriptions: {
			freshness: "Each feed fetched as often as it posts",
			filters: "Drop, mark read or flag as posts arrive",
			articles: "The whole piece, without leaving",
			search: "Phrases, OR and minus, saved to the sidebar",
			notifications: "One message per check, quiet at night",
			organize: "Folders, pins and labels on what you keep",
			yourData: "OPML in and out, and a ZIP of everything",
			agents: "Your assistant reads your queue over MCP",
			news: "Busy feeds, short spans, no churn",
			developers: "Flag releases, hear about fixes",
			research: "Search and label what you keep",
			podcasts: "Episodes beside the essays",
		},
		features: {
			label: "Features",
			reading: "Reading",
			keeping: "Keeping and connecting",
			freshness: "Fresh feeds",
			filters: "Filters",
			articles: "Articles in place",
			search: "Search",
			notifications: "Notifications",
			organize: "Folders and labels",
			yourData: "Your data",
			agents: "Agents",
		},
		useCases: {
			label: "Ways to read",
			news: "Local and world news",
			developers: "Release notes",
			research: "Research and long reads",
			podcasts: "Podcasts",
		},
		compare: {
			label: "Compare",
			feedly: "Feedly",
			inoreader: "Inoreader",
			feedbin: "Feedbin",
			newsblur: "NewsBlur",
		},
	},

	footer: {
		label: "Site",
		tagline: "An RSS and Atom reader with one queue, newest first.",
		copyright: "© {$year} Sergio Xalambrí",
	},

	hero: {
		eyebrow: "RSS and Atom reader",
		title: "The posts you chose, {#strong}in the order they were written{/strong}",
		description:
			"Follow any site that publishes a feed. Reader checks each one as often as it actually publishes and puts every new post in one queue, newest first, with nothing promoted into it.",
		cta: "Sign in to start reading",
		secondary: "See how it works",
		checks: {
			anyFeed: "Any RSS or Atom feed",
			opml: "Bring your OPML",
			free: "{$freeFeeds} feeds free",
		},
		views: {
			label: "Reader's screens",
			queue: "Queue",
			article: "Article",
			feed: "Feed",
			queueAlt:
				"The reading queue: eight posts from six feeds, five unread, one flagged by a filter and one saved, under a note that two feeds have posts arriving.",
			articleAlt:
				"A saved post from Field Notes read in place, with its byline and the first paragraphs of the article.",
			feedAlt:
				"Harbor Daily's own page: checked six minutes ago, the span its posts stay for, and the app suggesting a shorter span for a feed that publishes fourteen posts a day.",
		},
	},

	figures: {
		feeds: "feeds on the Free plan",
		posts: "posts kept on Free",
		interval: "between checks of a busy feed",
		history: "older posts fetched when you follow",
	},

	scenes: {
		cadence: {
			rate: "Posts a day",
			every: "Checked every",
			silent: "Nothing for a month",
		},
		agents: {
			timeline:
				".input {$count :number}\n.match $count\none {{{$count} post}}\n* {{{$count} posts}}",
		},
		syntax: {
			phrase: "The words, as written",
			either: "Posts with either word",
			exclude: "Leaves out posts holding it",
		},
	},

	freshness: {
		eyebrow: "01 / Fresh feeds",
		title: "Each feed is checked as often as it publishes",
		description:
			"Reader measures how often a site posts and fetches it on that rhythm, {#strong}one fetch for everyone who follows it{/strong}. Your queue catches up the moment you open it.",
		more: "How feeds stay fresh",
		checks: {
			rate: "A feed posting ten times a day is fetched every {$pollFloor}; a quiet one, once a day",
			push: "Sites with a WebSub hub push new posts as they publish",
			history: "Following a feed fetches up to {$historyPosts} of its older posts",
		},
		diagram: {
			label: "One fetch of a busy feed",
			pause: "Pause",
			trigger: "Harbor Daily's own schedule",
			detail: "Every {$pollFloor}, because it posts fourteen times a day",
			steps: {
				fetch: "Ask only for what changed",
				store: "Keep the new posts",
				publish: "Publish how far the feed has got",
				arrive: "Your queue catches up when you open it",
			},
			outcome: "Three new posts in your queue",
			footnote: "One fetch, however many people follow it",
		},
	},

	filters: {
		eyebrow: "02 / Filters",
		title: "Decide once what a post gets",
		description:
			"A filter is a sentence: when the title of a post contains a word, drop it, mark it read or flag it. {#strong}It acts as posts arrive{/strong}, so the queue you open is already sorted.",
		more: "How filters work",
		checks: {
			actions: "Drop, mark read or flag, by title, link, summary or author",
			preview: "Preview what a filter would have caught before you save it",
			forward: "Filters act on what arrives and leave everything already here alone",
		},
	},

	features: {
		eyebrow: "Features",
		title: "For a reading list you keep for years",
		description:
			"Read the whole article without leaving, find a post from two years ago, hear about the feeds you care about, and leave with everything whenever you like.",
		more: "Learn more",
		plansLink: "Compare plans",
		factsEyebrow: "What you get",
		stepsEyebrow: "How it works",
		relatedTitle: "More of what Reader does",
		cards: {
			freshness: {
				title: "Feeds fetched on their own rhythm",
				description:
					"From every {$pollFloor} for a busy feed to weekly for one that has gone quiet.",
			},
			filters: {
				title: "Filters that read like sentences",
				description: "Drop the sponsored posts, flag the releases, mark the press notes read.",
			},
			articles: {
				title: "The whole article, in place",
				description:
					"Open a post and read the article behind it, with the publisher named and the original a click away.",
			},
			search: {
				title: "Search with quotes, OR and minus",
				description: "Find a phrase as written, either of two words, or leave a word out.",
			},
			notifications: {
				title: "One notification, not twelve",
				description:
					"Pick the feeds worth hearing about. A check sends one message for all of them, outside your quiet hours.",
			},
			organize: {
				title: "Folders, pins and labels",
				description:
					"Read a folder as one stream, pin the feeds you never miss, label what you keep.",
			},
			yourData: {
				title: "Leave with everything",
				description: "OPML in and out, folders and all, and a ZIP of every post you kept.",
			},
			agents: {
				title: "Your assistant reads your queue",
				description:
					"Point any MCP client at your feeds with a token that can read, or read and act.",
			},
		},
		pages: {
			freshness: {
				meta: {
					title: "Fresh feeds — Reader",
					description:
						"Reader fetches each feed on the rhythm it publishes at, from every {$pollFloor} to weekly, once for everyone who follows it.",
				},
				title: "A feed is checked as often as it {#strong}actually publishes{/strong}",
				description:
					"Reader measures each feed's rate and fetches it on that rhythm. A news site posting all day is fetched every {$pollFloor}; a blog that posts monthly is left alone until it might have something.",
				plan: "The same schedule on every plan.",
				heroAlt:
					"Harbor Daily's page, checked six minutes ago, with the span its posts stay for and a suggestion to shorten it.",
				factsTitle: "Fresh without hammering anybody's server",
				facts: {
					one: {
						title: "One fetch per feed",
						description:
							"A feed is fetched once however many people follow it, so ten thousand readers of one site cost that site one request.",
					},
					two: {
						title: "Only what changed",
						description:
							"Each fetch sends back the validators the site gave last time, so an unchanged feed answers with nothing to download.",
					},
					three: {
						title: "Pushed when the site offers it",
						description:
							"A site with a WebSub hub tells Reader the moment it publishes; the schedule stays on in case a push goes missing.",
					},
				},
				stepsTitle: "From a new follow to a steady rhythm",
				steps: {
					one: {
						title: "Follow a feed or a site",
						description:
							"Paste the feed's address, or the site's, and Reader finds the feed it advertises.",
					},
					two: {
						title: "Its history arrives",
						description:
							"If the feed publishes archives or pages, up to {$historyPosts} older posts come in behind the follow.",
					},
					three: {
						title: "It settles into its rhythm",
						description:
							"After a day of hourly checks, the feed is fetched at the interval its own publishing rate earns.",
					},
				},
				faqTitle: "Questions about freshness",
				faq: {
					one: {
						q: "Can I check a feed right now?",
						a: "Yes. Every feed's page has Check feed, and the queue has Check all, on top of the schedule.",
					},
					two: {
						q: "What happens to a feed that stops publishing?",
						a: "After a month with nothing new it is checked weekly, and it moves to the Quiet group at the bottom of your sidebar.",
					},
					three: {
						q: "What if a site is down?",
						a: "Reader backs off and tries again later, and the feed's page tells you what the last check found.",
					},
				},
				closing: "Follow a feed and watch it arrive",
			},
			filters: {
				meta: {
					title: "Filters — Reader",
					description:
						"Filters drop, mark read or flag posts as they arrive, by title, link, summary or author. Preview what one would catch before saving it.",
				},
				title: "Filters that {#strong}read like sentences{/strong}",
				description:
					"When the title of a post contains “Sponsored”, drop it. Each filter reads one part of a post, looks for a piece of text, and decides what happens as the post arrives.",
				plan: "Filters come with the Paid and Premium plans.",
				heroAlt:
					"The Filters page: three filters written as sentences, each with the number of posts it has decided, and a preview matching 12 of the newest 500 posts.",
				stepsAlt: "The reading queue with a Kettle release flagged by a filter at the top.",
				factsTitle: "Three things a filter can do",
				facts: {
					one: {
						title: "Drop",
						description:
							"The post never reaches your queue. Use it for the sponsored posts and the categories you never read.",
					},
					two: {
						title: "Mark it read",
						description: "The post is there if you search for it, and out of your unread count.",
					},
					three: {
						title: "Flag",
						description:
							"The post arrives with a Flagged mark at the front of its title, so a release note stands out.",
					},
				},
				stepsTitle: "Write it, preview it, let it run",
				steps: {
					one: {
						title: "Write the sentence",
						description:
							"Pick the part of the post, the text to look for, and what happens, for every feed or only one.",
					},
					two: {
						title: "Preview it",
						description:
							"See how many of your newest posts it would have caught, and apply it to those if you want.",
					},
					three: {
						title: "Let it run",
						description:
							"Each filter counts the posts it has decided, so you can tell it is working.",
					},
				},
				faqTitle: "Questions about filters",
				faq: {
					one: {
						q: "Does a filter change posts I already have?",
						a: "No. Filters act on what arrives from now on. The preview can apply one to recent posts if you ask it to.",
					},
					two: {
						q: "Does a filter on the summary read the article?",
						a: "It reads the first {$summaryChars} characters of the summary the feed gave, which is the line under the title.",
					},
					three: {
						q: "What happens to my filters if I move to Free?",
						a: "They stay where they are and stop running. Nothing you follow or have read changes.",
					},
				},
				closing: "Open a queue that sorts itself",
			},
			articles: {
				meta: {
					title: "Articles in place — Reader",
					description:
						"Open a post and read the article behind its link inside Reader, set in your reading face, with the original a click away.",
				},
				title: "The whole article, {#strong}without leaving the queue{/strong}",
				description:
					"Many feeds carry a title and a line. Open the post and Reader fetches the article behind its link, sets it in your reading face, names the publisher and keeps the original a click away.",
				plan: "Reading articles in place comes with the Paid and Premium plans.",
				heroAlt:
					"A Field Notes essay read in place, in a serif face, with its byline and the link to the original.",
				stepsAlt: "The reading queue, where a post is opened.",
				factsTitle: "Read here, credit there",
				facts: {
					one: {
						title: "Fetched when you open it",
						description:
							"The article is read from the publisher at the moment you open the post, and held for everyone who opens the same one.",
					},
					two: {
						title: "Serif or sans",
						description:
							"Posts and articles are set in the reading face you picked; the menus stay as they are.",
					},
					three: {
						title: "The original is one click away",
						description: "Every article names its publisher and links to the page it came from.",
					},
				},
				stepsTitle: "From a line in a feed to the whole piece",
				steps: {
					one: { title: "Open a post", description: "From the queue, a folder or a feed's page." },
					two: {
						title: "The article arrives",
						description:
							"Reader reads the page behind the post's link and keeps the article's own text.",
					},
					three: {
						title: "Or it says why not",
						description:
							"A site that refuses, takes too long or has nothing to read is named as such, and the excerpt and link stay.",
					},
				},
				faqTitle: "Questions about articles",
				faq: {
					one: {
						q: "Does every site work?",
						a: "Most do. A site that does not allow it is told apart from one that took too long, and the post's excerpt and link are always there.",
					},
					two: {
						q: "Does saving a post keep the article?",
						a: "Saving keeps the title, the excerpt and the link. When the site goes, the link goes.",
					},
					three: {
						q: "Can podcasts and videos play here too?",
						a: "Yes. An audio or video attachment plays in the post's own page, in your browser's own player.",
					},
				},
				closing: "Read the whole piece where you found it",
			},
			search: {
				meta: {
					title: "Search — Reader",
					description:
						"Search every post you have kept by title, summary and author, with quoted phrases, OR, and minus or NOT to leave words out. Save a search to the sidebar.",
				},
				title: "Find the post {#strong}you half remember{/strong}",
				description:
					"Search reads the title, the summary and the author of every post you have kept. Quote a phrase, put OR between two words, lead a word with a minus, and save the searches you run every week.",
				plan: "Free searches the last {$freeSearchDays} days; Paid and Premium search everything you have kept.",
				heroAlt:
					"The queue narrowed to a search for harbour OR ferry minus sponsored, with three matching posts and the line saying how far back it searched.",
				factsTitle: "Search that says what it looked at",
				facts: {
					one: {
						title: "Every word, or the ones you say",
						description:
							"A search finds posts holding every word, unless you join two with OR or leave one out with a minus.",
					},
					two: {
						title: "Inside a filter",
						description:
							"Search composes with All, Unread and Read, so “unread posts about the footbridge” is one address.",
					},
					three: {
						title: "Saved to the sidebar",
						description:
							"Keep up to {$savedSearchLimit} searches by name and open them like a folder.",
					},
				},
				stepsTitle: "Four ways to say what you mean",
				steps: {
					one: {
						title: "Type the words",
						description: "Every word has to appear in the title, the summary or the author.",
					},
					two: {
						title: "Shape it",
						description: "Quote a phrase, put OR between two words, lead a word with - or NOT.",
					},
					three: {
						title: "Keep it",
						description:
							"Save the search and it sits in the sidebar, answering with what is new each time.",
					},
				},
				faqTitle: "Questions about search",
				faq: {
					one: {
						q: "Does search read the article?",
						a: "It reads the title, the summary and the author of each post, which is what the feed gave.",
					},
					two: {
						q: "How far back does it go?",
						a: "On Free, the last {$freeSearchDays} days. On Paid and Premium, everything you have kept. The page always says where it stopped.",
					},
					three: {
						q: "Can I search for the word OR?",
						a: "Yes. Quote it, and it is searched for as a word.",
					},
				},
				closing: "Find it again in a second",
			},
			notifications: {
				meta: {
					title: "Notifications — Reader",
					description:
						"Hear about the feeds you pick, in your browser or by email, with one notification per check and quiet hours that hold them overnight.",
				},
				title: "Hear about the feeds {#strong}you picked{/strong}, and only those",
				description:
					"Turn notifications on for the feeds worth it. When a check finds something, you get one notification naming them, never one per post, and nothing at all during your quiet hours.",
				plan: "Paid checks every {$paidCheck} and Premium every {$premiumCheck}; email comes with Premium.",
				heroAlt:
					"The notifications settings: one notification for three new posts from three feeds, and quiet hours from 22:00 to 07:00.",
				factsTitle: "Notifications that respect the evening",
				facts: {
					one: {
						title: "One message per check",
						description: "Three feeds with news is one notification naming up to three publishers.",
					},
					two: {
						title: "Held, not lost",
						description:
							"A notification during quiet hours waits, and the next check outside them carries it.",
					},
					three: {
						title: "Your browsers, your inbox",
						description:
							"Push to the browsers you allow, and email at most once every {$emailGapHours} hours on Premium.",
					},
				},
				stepsTitle: "Pick the feeds, then how to be reached",
				steps: {
					one: {
						title: "Pick a feed",
						description: "Turn notifications on from that feed's own page.",
					},
					two: {
						title: "Choose a channel",
						description: "Allow this browser, add another, or turn on email.",
					},
					three: {
						title: "Set quiet hours",
						description: "Read in your own time zone, as your browser reports it.",
					},
				},
				faqTitle: "Questions about notifications",
				faq: {
					one: {
						q: "Is anything sent about feeds I did not pick?",
						a: "No. Nothing is ever sent about a feed you have not picked.",
					},
					two: {
						q: "Does it work on my phone?",
						a: "Yes, in a browser that supports web push, including an iPhone with Reader added to the home screen.",
					},
					three: {
						q: "How do I stop the emails?",
						a: "Every email has a link that stops them, and Settings turns them back on.",
					},
				},
				closing: "Hear about what matters, when it suits you",
			},
			organize: {
				meta: {
					title: "Folders and labels — Reader",
					description:
						"Group feeds into folders and read each as one stream, pin the feeds you never miss, save posts and label why you kept them.",
				},
				title: "Group the feeds, {#strong}label what you keep{/strong}",
				description:
					"A folder reads its feeds as one stream. A pinned feed sits at the top of the sidebar. A saved post stays whatever happens to its feed, and a label says why you kept it.",
				plan: "Folders and labels come with the Paid and Premium plans; pins with every plan.",
				heroAlt:
					"The Saved page: two kept posts, the sidebar's pinned feed and folders with their unread counts, and three labels.",
				stepsAlt: "Harbor Daily's own page, where a feed is filed into a folder.",
				factsTitle: "Three ways to keep a big list readable",
				facts: {
					one: {
						title: "Folders as streams",
						description: "Open News and read every news feed newest first, as one list.",
					},
					two: {
						title: "Pins and quiet feeds",
						description:
							"Pin up to {$pinLimit} feeds above everything; the ones that rarely post sink to Quiet.",
					},
					three: {
						title: "Saved means kept",
						description:
							"No retention rule reaches a saved post, and up to {$tagLimit} labels say why you kept it.",
					},
				},
				stepsTitle: "File a feed in two clicks",
				steps: {
					one: { title: "Open the feed", description: "Its page holds every action on it." },
					two: {
						title: "Pick or name a folder",
						description: "Choose one you have, or type a name and the folder is made.",
					},
					three: {
						title: "Read the folder",
						description: "It appears in the sidebar with its unread count.",
					},
				},
				faqTitle: "Questions about organizing",
				faq: {
					one: {
						q: "What happens to posts when I delete a folder?",
						a: "Nothing. Its feeds go back among the unfiled ones and keep every post.",
					},
					two: {
						q: "How long do posts stay?",
						a: "As long as you like. Each feed can keep its posts from three hours to forever; saved posts always stay.",
					},
					three: {
						q: "Do folders come with OPML?",
						a: "Yes. Import and export carry your folders with your feeds.",
					},
				},
				closing: "Give every feed a place",
			},
			yourData: {
				meta: {
					title: "Your data — Reader",
					description:
						"Import an OPML file, folders and all, and export your subscriptions or a ZIP of everything you kept, whenever you like.",
				},
				title: "Arrive with your list, {#strong}leave with everything{/strong}",
				description:
					"Import the OPML file from your last reader, folders and all. Export it again whenever you like, or download a ZIP with your subscriptions and every post you kept.",
				plan: "Import and export on every plan.",
				heroAlt:
					"An OPML import reporting 142 new feeds, 3 already followed and 1 that could not be retrieved, above the files a full export contains.",
				factsTitle: "Nothing is held hostage",
				facts: {
					one: {
						title: "OPML both ways",
						description: "The standard file every reader reads, with your folders as outlines.",
					},
					two: {
						title: "One ZIP of everything",
						description:
							"Subscriptions as OPML, kept posts with their labels as CSV, and both as JSON.",
					},
					three: {
						title: "A plan change deletes nothing",
						description:
							"Over your plan, new additions pause and everything you have stays where it is.",
					},
				},
				stepsTitle: "Moving in takes one file",
				steps: {
					one: {
						title: "Export from your old reader",
						description: "Every reader worth leaving has an OPML export.",
					},
					two: {
						title: "Import it in Settings",
						description:
							"Reader follows each feed and tells you which it already had and which it could not reach.",
					},
					three: {
						title: "Read",
						description:
							"Older posts arrive behind the follow for feeds that publish their archives.",
					},
				},
				faqTitle: "Questions about your data",
				faq: {
					one: {
						q: "What if a payment fails?",
						a: "Everything stays for {$graceDays} days. Update the card and nothing has changed.",
					},
					two: {
						q: "Is there a size limit on imports?",
						a: "A subscription list is a few hundred kilobytes at most, and Reader reads files of that size.",
					},
					three: {
						q: "Does the export include the articles?",
						a: "It includes each kept post's title, link, excerpt and labels.",
					},
				},
				closing: "Bring your OPML and start reading",
			},
			agents: {
				meta: {
					title: "Agents — Reader",
					description:
						"Reader answers the Model Context Protocol, so an assistant can read, search and act on your feeds with a token you mint and can revoke.",
				},
				title: "Ask your assistant {#strong}what is new{/strong}",
				description:
					"Reader answers the Model Context Protocol. Mint a token in Settings, give your client the address, and your assistant can read your queue, search it, and — if you let it — mark, save, follow and unfollow.",
				plan: "Agents come with the Paid and Premium plans.",
				heroAlt:
					"The Agents settings: a read-and-write token named Laptop assistant, above the tools it called this morning.",
				factsTitle: "An assistant on a short leash",
				facts: {
					one: {
						title: "Read or write, your choice",
						description: "A read token can never mark, keep, follow or unfollow anything.",
					},
					two: {
						title: "{$toolCount} tools",
						description:
							"Read the timeline, search it, read a feed or the saved posts, list feeds, and act on posts when allowed.",
					},
					three: {
						title: "Revoke any time",
						description:
							"Each token shows when it was last used, and one click stops it answering.",
					},
				},
				stepsTitle: "Three steps to a reading assistant",
				steps: {
					one: {
						title: "Mint a token",
						description: "In Settings, name it and choose whether it may write. It is shown once.",
					},
					two: {
						title: "Configure the client",
						description: "Give it the address and the token as a bearer credential.",
					},
					three: {
						title: "Ask",
						description:
							"“What came in from Harbor Daily this morning?” is answered from your queue, not a browser.",
					},
				},
				faqTitle: "Questions about agents",
				faq: {
					one: {
						q: "Which clients work?",
						a: "Any client that lets you set a bearer token in its configuration.",
					},
					two: {
						q: "Can an agent follow feeds for me?",
						a: "With a write token, yes. With a read token it can only read and search.",
					},
					three: {
						q: "Is there a limit?",
						a: "Each token has a daily budget of calls, and says so when it is spent.",
					},
				},
				closing: "Let your assistant do the skimming",
			},
		},
	},

	privacy: {
		eyebrow: "Privacy",
		title: "What you read stays between you and the page",
		description:
			"Reader sells nothing, shows no ads, and its own logs are written so that they cannot say who read what.",
		facts: {
			logs: {
				title: "Logs that never name you",
				description:
					"An event may carry a count, a duration, a status or a host — never a post's title or address, and never who you are.",
			},
			links: {
				title: "Tracking stripped from links",
				description:
					"Campaign parameters are taken off a feed's links unless you ask to keep them for that feed.",
			},
			retention: {
				title: "Kept for 30 days",
				description:
					"Operational telemetry is deleted after a month, and a publisher's server learns only that a reader visited.",
			},
		},
	},

	plans: {
		eyebrow: "Plans",
		title: "Sized by what you keep, not by what you read",
		description:
			"Every plan reads every feed the same way. They differ in how much they keep and what runs for you while you are away.",
		label: "What each plan includes",
		column: "Included",
		included: "Included",
		notIncluded: "Not included",
		everything: "Everything kept",
		days: "Last {$days} days",
		rows: {
			feeds: "Feeds you follow",
			posts: "Posts kept",
			saved: "Saved posts",
			search: "Search reaches",
			filters: "Filters",
			checks: "Checks for notifications",
			articles: "Articles in place",
			folders: "Folders",
			labels: "Labels",
			agents: "Agents (MCP)",
			email: "Email notifications",
		},
		notes: {
			grace: "A failed payment keeps everything for {$graceDays} days",
			nothingDeleted: "A plan change never deletes anything",
		},
	},

	useCases: {
		eyebrow: "Ways to read",
		title: "One queue, read four ways",
		description: "Same reader, different mornings: what changes is which features carry the load.",
		compare: "Coming from another reader?",
		capabilitiesEyebrow: "What carries it",
		cards: {
			news: {
				title: "Keep up without the churn",
				description:
					"Busy feeds fetched every {$pollFloor}, posts that age out in hours, and a filter for what you never read.",
			},
			developers: {
				title: "Never miss a release",
				description:
					"Flag the release notes, hear about the projects you depend on, and let your assistant summarise the rest.",
			},
			research: {
				title: "Find it again in two years",
				description: "Search with phrases and OR, labels on what you keep, and a ZIP of all of it.",
			},
			podcasts: {
				title: "Episodes beside the essays",
				description: "New episodes in the same queue, played in the post's own page.",
			},
		},
		pages: {
			news: {
				meta: {
					title: "Reader for news",
					description:
						"Follow local and world news by RSS: busy feeds fetched every {$pollFloor}, short spans so old news leaves, and filters for the rest.",
				},
				title: "The news, {#strong}without the feed deciding for you{/strong}",
				description:
					"Follow the papers and the local desks that publish feeds. Busy ones are fetched every {$pollFloor}, old stories leave on a span you choose, and a filter keeps the categories you skip out of sight.",
				heroAlt:
					"A news queue: three unread stories from Harbor Daily and City Desk, and two read ones faded below.",
				capabilitiesTitle: "Built for feeds that never stop",
				spotlight: {
					eyebrow: "Spans",
					title: "Yesterday's news leaves on its own",
					description:
						"Give a news feed a span of 18 hours, or 3 for breaking news, and older posts leave your timeline whether you read them or not. Saved posts always stay.",
					checks: {
						one: "Five spans, from 3 hours to forever",
						two: "Reader suggests a shorter span for a busy feed that keeps everything",
						three: "Saved posts are never reached by a span",
					},
				},
				spotlightAlt:
					"Harbor Daily's page with its five spans and the suggestion to shorten one for a feed posting fourteen times a day.",
				faqTitle: "Questions from news readers",
				faq: {
					one: {
						q: "How quickly does a story arrive?",
						a: "A feed posting ten or more times a day is fetched every {$pollFloor}, and a site with a WebSub hub is heard from as it publishes.",
					},
					two: {
						q: "Can I hide one section of a paper?",
						a: "Yes, with a filter on the link or the title, on Paid and Premium.",
					},
				},
				closing: "Read the news on your own schedule",
			},
			developers: {
				meta: {
					title: "Reader for developers",
					description:
						"Follow release notes, changelogs and engineering blogs by RSS, flag the releases that matter, and let an MCP client read your queue.",
				},
				title: "Release notes {#strong}you will actually see{/strong}",
				description:
					"Follow the changelogs and engineering blogs of everything you depend on. Flag the releases, hear about security fixes from the projects that matter, and ask your assistant what changed this week.",
				heroAlt:
					"A developer's queue: two flagged Kettle releases, an engineering post and a saved postmortem.",
				capabilitiesTitle: "For the projects you depend on",
				spotlight: {
					eyebrow: "Agents",
					title: "Ask what shipped this week",
					description:
						"Reader answers the Model Context Protocol, so the assistant in your editor or terminal can read and search your feeds with a token you can revoke.",
					checks: {
						one: "Read-only tokens for assistants that only summarise",
						two: "Search with the same syntax as the app",
						three: "Every token shows when it was last used",
					},
				},
				faqTitle: "Questions from developers",
				faq: {
					one: {
						q: "Can I follow GitHub releases?",
						a: "Any project page that publishes an Atom or RSS feed works, including a repository's releases feed.",
					},
					two: {
						q: "Is there an API?",
						a: "The agent endpoint speaks the Model Context Protocol over HTTP, with bearer tokens minted in Settings.",
					},
				},
				closing: "Follow the projects you depend on",
			},
			research: {
				meta: {
					title: "Reader for research",
					description:
						"Follow journals, preprint servers and lab blogs by RSS, search everything you kept, label what matters and export it all.",
				},
				title: "A reading list {#strong}that is still there in two years{/strong}",
				description:
					"Follow the journals, preprint feeds and lab blogs in your field. Search everything you have kept with phrases and OR, label the posts you mean to cite, and take a ZIP of all of it when you need to.",
				heroAlt:
					"A research queue: a lab's survey results, two preprints and a saved reading list.",
				capabilitiesTitle: "For reading that compounds",
				spotlight: {
					eyebrow: "Search",
					title: "Search everything you kept",
					description:
						"Search reads the title, summary and author of every post, and says exactly how far back it looked.",
					checks: {
						one: "Phrases, OR, and minus or NOT",
						two: "Save up to 20 searches to the sidebar",
						three: "On Paid and Premium, search reaches everything you have kept",
					},
				},
				faqTitle: "Questions from researchers",
				faq: {
					one: {
						q: "How many posts can I keep?",
						a: "From {$freePosts} on Free to {$premiumPosts} on Premium, and nothing is deleted while you are inside those numbers.",
					},
					two: {
						q: "Can I export what I saved?",
						a: "Yes. The ZIP holds every saved post with its labels as CSV and JSON.",
					},
				},
				closing: "Start the list you will still be using",
			},
			podcasts: {
				meta: {
					title: "Reader for podcasts",
					description:
						"Follow podcasts by their RSS feed and play each episode in the post's own page, beside the blogs and news you read.",
				},
				title: "Episodes in the same queue {#strong}as everything else{/strong}",
				description:
					"A podcast is a feed. Follow it like any other, and each new episode arrives in your queue and plays in the post's own page, in your browser's own player.",
				heroAlt: "A podcast queue: new episodes from The Long Simmer and two other shows.",
				capabilitiesTitle: "Podcasts without another app",
				spotlight: {
					eyebrow: "Playback",
					title: "Play it where you found it",
					description:
						"An episode's audio or video plays in the post's page with the browser's own controls, and the file is a link away if you would rather download it.",
					checks: {
						one: "Audio and video attachments",
						two: "Your browser's own player",
						three: "Notifications for the shows you never miss",
					},
				},
				faqTitle: "Questions from listeners",
				faq: {
					one: {
						q: "Does it download episodes?",
						a: "It plays them from the show's own server. The file is linked if you want to keep it.",
					},
					two: {
						q: "Can I hear when a new episode is out?",
						a: "Yes. Turn notifications on for that show, on Paid and Premium.",
					},
				},
				closing: "Follow your shows beside your reading",
			},
		},
	},

	compare: {
		eyebrow: "Reader vs {$competitor}",
		cta: "Sign in to switch",
		tableLink: "See the comparison",
		tableEyebrow: "Side by side",
		tableLabel: "Reader compared with {$competitor}",
		column: "Compared",
		checked:
			"Read from each product's own pages on 31 October 2026. Rows we could not confirm are left out.",
		reasonsEyebrow: "Why switch",
		winsEyebrow: "Honestly",
		winsTitle: "When {$competitor} might be better",
		switchEyebrow: "Switching",
		switchTitle: "Move from {$competitor} in one file",
		faqTitle: "Questions about leaving {$competitor}",
		others: "Other comparisons",
		closing: "Bring your {$competitor} feeds",
		switch: {
			export: {
				title: "Export from {$competitor}",
				description: "Download your subscriptions as an OPML file.",
			},
			import: {
				title: "Import it in Reader",
				description:
					"Settings reads the file, follows every feed and reports what it could not reach.",
			},
			read: {
				title: "Read",
				description: "Your folders arrive with your feeds, and older posts come in behind them.",
			},
		},
		rows: {
			freePlan: "Free plan",
			history: "Posts kept",
			filters: "Keyword filters",
			fullText: "Full article in the reader",
			search: "Search",
			agents: "Agents and API",
			export: "Export",
			apps: "Apps",
			newsletters: "Newsletters by email",
			ai: "AI features",
			hosting: "Hosting",
		},
		reader: {
			freePlan: "{$freeFeeds} feeds, no ads",
			history: "Up to {$freePosts} posts on Free; you choose how long each feed's stay",
			filters: "Drop, mark read or flag; {$paidRules} filters on Paid",
			fullText: "On Paid and Premium",
			search: "Last {$freeSearchDays} days on Free; everything kept on Paid",
			agents: "MCP endpoint on Paid, with read or write tokens",
			export: "OPML with folders, and a ZIP of everything",
			apps: "Web app, installable, with push notifications",
			newsletters: "Not offered",
			ai: "None",
			hosting: "Hosted by us",
		},
		pages: {
			feedly: {
				meta: {
					title: "Reader vs Feedly",
					description:
						"An honest comparison of Reader and Feedly: free plans, filters, export, agents, apps and AI.",
				},
				title: "One queue, newest first, {#strong}without the sponsored posts{/strong}",
				description:
					"Feedly is a large platform with AI feeds and team features. Reader is a quiet RSS reader: one queue, no ads, filters that read like sentences, and everything exportable.",
				tableTitle: "Reader and Feedly, row by row",
				rows: {
					freePlan: "100 feeds in 3 folders, with sponsored ads",
					filters: "Mute filters on Pro+",
					agents: "API on Enterprise; community-built MCP servers",
					export: "OPML of public RSS feeds",
					apps: "iOS and Android",
					newsletters: "On Pro+",
					ai: "AI Feeds, mute and deduplication",
				},
				reasonsTitle: "What you gain leaving Feedly",
				reasons: {
					one: {
						title: "No ads, on any plan",
						description: "The Free plan's queue holds only what you follow.",
					},
					two: {
						title: "Filters before Pro+",
						description: "Drop, mark read or flag from the Paid plan up.",
					},
					three: {
						title: "Everything leaves with you",
						description: "OPML with folders and a ZIP of every post you kept.",
					},
				},
				wins: {
					one: {
						title: "AI that watches topics",
						description:
							"Feedly's AI Feeds follow subjects beyond your subscriptions. Reader reads only what you follow.",
					},
					two: {
						title: "Native mobile apps",
						description:
							"Feedly has iOS and Android apps. Reader is a web app you can add to your home screen.",
					},
					three: {
						title: "Teams",
						description:
							"Feedly offers team and enterprise features. Reader is for one person's reading.",
					},
				},
				faq: {
					one: {
						q: "Will my Feedly folders come across?",
						a: "Yes. Feedly's OPML export lists feeds under their folders, and Reader imports them as folders.",
					},
					two: {
						q: "Does Reader have AI summaries?",
						a: "No. An MCP client of your choosing can read your queue if you want an assistant to summarise it.",
					},
				},
			},
			inoreader: {
				meta: {
					title: "Reader vs Inoreader",
					description:
						"An honest comparison of Reader and Inoreader: free plans, rules and filters, full articles, search, agents and apps.",
				},
				title: "Fewer knobs, {#strong}one quiet queue{/strong}",
				description:
					"Inoreader is a power user's reader with rules, monitoring and many source types. Reader does less on purpose: one queue, newest first, filters as sentences, and an MCP endpoint for your assistant.",
				tableTitle: "Reader and Inoreader, row by row",
				rows: {
					freePlan: "150 feeds",
					filters: "30 rules and 50 filters on Pro",
					fullText: "Included on Free",
					search: "Included on Free",
					agents: "API on Pro; community-built MCP servers",
					apps: "iOS and Android",
					newsletters: "20 newsletters on Pro",
					ai: "AI summaries on Pro",
				},
				reasonsTitle: "What you gain leaving Inoreader",
				reasons: {
					one: {
						title: "One list instead of a dashboard",
						description: "Every post, newest first, with nothing promoted into it.",
					},
					two: {
						title: "An endpoint for your assistant",
						description:
							"Reader answers the Model Context Protocol directly, with tokens you mint and revoke.",
					},
					three: {
						title: "Logs that never name you",
						description: "Reader's telemetry can say which host was slow, never what you read.",
					},
				},
				wins: {
					one: {
						title: "A more generous free plan",
						description:
							"Inoreader's Free plan follows 150 feeds and loads full articles; Reader keeps full articles for Paid.",
					},
					two: {
						title: "More kinds of source",
						description:
							"Inoreader follows social accounts, pages without feeds and newsletters. Reader follows RSS and Atom.",
					},
					three: {
						title: "Apps with offline reading",
						description: "Inoreader's apps read offline and aloud. Reader is a web app.",
					},
				},
				faq: {
					one: {
						q: "Will my Inoreader rules come across?",
						a: "No. OPML carries feeds and folders, not rules. Reader's filters take a minute each to write again.",
					},
					two: {
						q: "Does Reader follow newsletters?",
						a: "Only those that publish a feed. Reader does not give you an email address to subscribe with.",
					},
				},
			},
			feedbin: {
				meta: {
					title: "Reader vs Feedbin",
					description:
						"An honest comparison of Reader and Feedbin: free plans, history, agents, apps and newsletters.",
				},
				title: "Keep years of posts, {#strong}start on a free plan{/strong}",
				description:
					"Feedbin is a respected, paid-only reader with newsletters and a large ecosystem of apps. Reader starts free, keeps far more history, and answers your assistant over MCP.",
				tableTitle: "Reader and Feedbin, row by row",
				rows: {
					freePlan: "None; a 30-day trial, then $7 a month",
					history: "The 400 most recent articles per feed",
					agents: "REST API; community-built MCP servers",
					apps: "iOS app, and third-party apps on other platforms",
					newsletters: "Included",
					ai: "None",
					hosting: "Hosted; open source under MIT",
				},
				reasonsTitle: "What you gain leaving Feedbin",
				reasons: {
					one: {
						title: "A free plan that lasts",
						description: "Follow your first feeds without a trial clock.",
					},
					two: {
						title: "History you choose",
						description:
							"Each feed keeps its posts from three hours to forever, within your plan's budget.",
					},
					three: {
						title: "Filters as sentences",
						description: "Drop, mark read or flag posts as they arrive.",
					},
				},
				wins: {
					one: {
						title: "Newsletters and more",
						description:
							"Feedbin turns newsletters, podcasts, YouTube and Mastodon into one list. Reader reads feeds.",
					},
					two: {
						title: "Apps that sync with it",
						description: "Many third-party readers sync with Feedbin. Reader is its own web app.",
					},
					three: {
						title: "Open source",
						description: "Feedbin's code is published under the MIT licence.",
					},
				},
				faq: {
					one: {
						q: "Will my starred items come across?",
						a: "OPML carries your feeds and folders. Saved posts start fresh in Reader.",
					},
					two: {
						q: "Does Reader have a third-party app API?",
						a: "Reader's agent endpoint speaks the Model Context Protocol; there is no sync API for other reading apps.",
					},
				},
			},
			newsblur: {
				meta: {
					title: "Reader vs NewsBlur",
					description:
						"An honest comparison of Reader and NewsBlur: free plans, full stories, search, agents, apps and self-hosting.",
				},
				title: "Search and agents {#strong}on the first paid plan{/strong}",
				description:
					"NewsBlur is an open-source reader with training and a permanent archive. Reader puts search of everything you kept and an MCP endpoint on its first paid plan.",
				tableTitle: "Reader and NewsBlur, row by row",
				rows: {
					freePlan: "64 sites",
					fullText: "On Premium",
					search: "On Premium",
					agents: "Official MCP server on Archive or Pro",
					apps: "iOS, Android and macOS, open source",
					ai: "On Archive",
					hosting: "Hosted, or self-hosted for free",
				},
				reasonsTitle: "What you gain leaving NewsBlur",
				reasons: {
					one: {
						title: "More feeds for free",
						description: "Follow up to {$freeFeeds} feeds without paying, newest first.",
					},
					two: {
						title: "Agents without the archive tier",
						description: "Reader's MCP endpoint comes with its first paid plan.",
					},
					three: {
						title: "A quieter screen",
						description: "One list, no training to set up, filters you write as sentences.",
					},
				},
				wins: {
					one: {
						title: "Training",
						description:
							"NewsBlur learns from authors, tags and titles you like or dislike. Reader only does what your filters say.",
					},
					two: {
						title: "Self-hosting",
						description: "NewsBlur's server and apps are open source and run on your own machine.",
					},
					three: {
						title: "Native apps",
						description: "NewsBlur has iOS, Android and macOS apps. Reader is a web app.",
					},
				},
				faq: {
					one: {
						q: "Will my NewsBlur folders come across?",
						a: "Yes, if the export lists feeds under folders; Reader imports OPML outlines as folders.",
					},
					two: {
						q: "Does Reader learn what I like?",
						a: "No. The queue is in the order posts were written; filters are the only thing that changes it, and you write them.",
					},
				},
			},
		},
	},

	faq: {
		eyebrow: "FAQ",
		title: "Before you sign in",
		anyFeed: {
			q: "Does it work with any site?",
			a: "With any site that publishes RSS or Atom. Paste the site's address and Reader finds the feed it advertises.",
		},
		free: {
			q: "What is free?",
			a: "Following {$freeFeeds} feeds, the queue, search of the last {$freeSearchDays} days, saved posts and OPML import and export.",
		},
		over: {
			q: "What happens if I go over my plan?",
			a: "Nothing is deleted. New additions pause until you are back inside the numbers or on a larger plan.",
		},
		apps: {
			q: "Is there a phone app?",
			a: "Reader is a web app built for phones too: add it to your home screen, swipe a row to mark it read, and allow notifications.",
		},
		move: {
			q: "Can I bring my feeds from another reader?",
			a: "Yes. Import its OPML file in Settings, folders and all.",
		},
		privacy: {
			q: "Who sees what I read?",
			a: "Nobody. There are no ads and no tracking, and the app's logs are written so they cannot name a reader or a post.",
		},
	},

	closing: {
		title: "Bring your OPML and start reading",
		description: "Sign in, import your list or follow a feed, and read newest first.",
	},
};
