/**
 * The one reading list every mockup on the public pages looks into: the feeds it follows,
 * the folders they sit in and the posts they published this morning. Sharing it makes the
 * hero, the scenes and the feature pages read as one account rather than as many drawings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * A feed in the sample account. Names and hosts are invented and every host sits under
 * `example.com`, so nothing on the page reads as a publisher endorsing the product.
 */
export interface SampleFeed {
	title: string;
	host: string;
	/** Unread posts the rail counts beside the name. */
	unread: number;
	/** Posts a day the feed has averaged, which decides how often it is fetched. */
	perDay: number;
	folder: "news" | "engineering" | "reading" | null;
	pinned?: boolean;
	/** A feed that publishes almost nothing, which the rail draws last, under Quiet. */
	quiet?: boolean;
}

/** A post in the sample account's queue. */
export interface SamplePost {
	title: string;
	/** The line under the title the feed gave, which the queue prints muted beside it. */
	summary: string;
	feed: string;
	/** Relative time as the queue prints it. */
	time: string;
	read: boolean;
	saved?: boolean;
	/** Picked out by one of the account's own filters as it arrived. */
	flagged?: boolean;
}

/** The sample account's feeds, in the order the rail draws them. */
export const SAMPLE_FEEDS: SampleFeed[] = [
	{
		title: "Field Notes",
		host: "fieldnotes.example.com",
		unread: 2,
		perDay: 0.4,
		folder: "reading",
		pinned: true,
	},
	{ title: "Harbor Daily", host: "harbordaily.example.com", unread: 9, perDay: 14, folder: "news" },
	{ title: "City Desk", host: "citydesk.example.com", unread: 4, perDay: 6, folder: "news" },
	{
		title: "Kettle releases",
		host: "kettle.example.com",
		unread: 1,
		perDay: 0.2,
		folder: "engineering",
	},
	{ title: "Margins", host: "margins.example.com", unread: 0, perDay: 0.3, folder: "reading" },
	{
		title: "The Long Simmer",
		host: "longsimmer.example.com",
		unread: 1,
		perDay: 0.15,
		folder: null,
	},
	{
		title: "Tidepool Lab",
		host: "tidepool.example.com",
		unread: 0,
		perDay: 0.02,
		folder: null,
		quiet: true,
	},
];

/** The sample account's queue this morning, newest first. */
export const SAMPLE_POSTS: SamplePost[] = [
	{
		title: "Ferry timetable changes for the winter season",
		summary: "Two crossings move earlier from 4 November.",
		feed: "Harbor Daily",
		time: "6m",
		read: false,
	},
	{
		title: "Kettle 4.2: a streaming parser and a smaller install",
		summary: "The parser now reads a document as it arrives.",
		feed: "Kettle releases",
		time: "41m",
		read: false,
		flagged: true,
	},
	{
		title: "Notes on walking the same route for a year",
		summary: "What changes when nothing does.",
		feed: "Field Notes",
		time: "2h",
		read: false,
		saved: true,
	},
	{
		title: "Council approves the harbour footbridge",
		summary: "Construction starts in spring.",
		feed: "City Desk",
		time: "3h",
		read: false,
	},
	{
		title: "Ep. 112 — Stock, slowly",
		summary: "Bones, water and eight hours.",
		feed: "The Long Simmer",
		time: "5h",
		read: false,
	},
	{
		title: "Why the measure matters more than the font",
		summary: "Sixty-six characters, give or take.",
		feed: "Margins",
		time: "9h",
		read: true,
	},
	{
		title: "Night buses return to the northern line",
		summary: "Every 20 minutes until 2 a.m.",
		feed: "Harbor Daily",
		time: "11h",
		read: true,
	},
	{
		title: "What the spring survey found in the rock pools",
		summary: "Fewer limpets, more anemones.",
		feed: "Tidepool Lab",
		time: "Yesterday",
		read: true,
		saved: true,
	},
];

/** The article the post page reads in place: the sample account's pinned essay. */
export const SAMPLE_ARTICLE = {
	feed: "Field Notes",
	host: "fieldnotes.example.com",
	title: "Notes on walking the same route for a year",
	byline: "Ana Ruiz",
	date: "31 Oct 2026",
	paragraphs: [
		"For a year I walked the same four kilometres every morning: down the hill, along the harbour wall, back through the market before it opened.",
		"The route never changed, so everything else did. The baker started on Tuesdays. A gull claimed the third bollard and kept it through the winter.",
		"Repetition is how you notice. A walk you take once is scenery; a walk you take three hundred times is a record of what moved.",
	],
} as const;
