/**
 * Inkwell's fixtures: the authors, posts, media and activity of Lantern Review, the invented
 * quarterly the CMS demo edits. Times are offsets from the request, so "Edited 2m ago" stays
 * true whenever a visitor opens the demo.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Where a post stands with readers: live, still being written, or queued for a date. */
export type PostStatus = "published" | "draft" | "scheduled";

/** One person who writes for the publication. */
export interface Author {
	id: string;
	name: string;
	initials: string;
	role: string;
	email: string;
	/** Minutes since they last opened Inkwell. */
	activeMinutesAgo: number;
}

/** One post, with its times as minute offsets from the moment the screen renders. */
export interface Post {
	id: string;
	title: string;
	slug: string;
	excerpt: string;
	body: string[];
	authorId: string;
	status: PostStatus;
	/** A published post edited since it went live, so the site still shows the older copy. */
	changed: boolean;
	tags: string[];
	editedMinutesAgo: number;
	/** Minutes since it went live; published posts only. */
	publishedMinutesAgo?: number;
	/** Minutes until it goes live; scheduled posts only. */
	scheduledInMinutes?: number;
}

/** How a media swatch is drawn: two inks and the motif laid over them. */
export interface Swatch {
	from: string;
	to: string;
	motif: "sun" | "waves" | "grid" | "hills" | "rings" | "stripes";
}

/** One uploaded file in the media library. */
export interface MediaItem {
	id: string;
	name: string;
	type: string;
	width: number;
	height: number;
	bytes: number;
	authorId: string;
	uploadedMinutesAgo: number;
	alt: string;
	caption: string;
	/** The post the file appears in, when one uses it. */
	postId?: string;
	swatch: Swatch;
}

/** One line of the publication's recent history. */
export interface Activity {
	id: string;
	authorId: string;
	verb: string;
	postId: string;
	minutesAgo: number;
	tone: "neutral" | "brand" | "success" | "warning";
	kind: "published" | "edited" | "scheduled" | "created" | "commented";
}

/** One minute, in milliseconds. */
const MINUTE = 60 * 1000;

/** One hour, in minutes. */
const HOUR = 60;

/** One day, in minutes. */
const DAY = 24 * HOUR;

/** The publication Inkwell edits in this demo. */
export const PUBLICATION = {
	name: "Lantern Review",
	tagline: "Essays on reading slowly, making things and the craft of attention.",
	url: "lanternreview.example",
} as const;

/** The masthead, editor-in-chief first; she is the signed-in user. */
export const AUTHORS: Author[] = [
	{
		id: "maya",
		name: "Maya Okafor",
		initials: "MO",
		role: "Editor-in-chief",
		email: "maya@lanternreview.example",
		activeMinutesAgo: 0,
	},
	{
		id: "tomas",
		name: "Tomás Ferreira",
		initials: "TF",
		role: "Senior editor",
		email: "tomas@lanternreview.example",
		activeMinutesAgo: 14,
	},
	{
		id: "ingrid",
		name: "Ingrid Halvorsen",
		initials: "IH",
		role: "Contributor",
		email: "ingrid@lanternreview.example",
		activeMinutesAgo: 3 * HOUR,
	},
	{
		id: "priya",
		name: "Priya Raman",
		initials: "PR",
		role: "Contributor",
		email: "priya@lanternreview.example",
		activeMinutesAgo: 2 * DAY,
	},
	{
		id: "jules",
		name: "Jules Moreau",
		initials: "JM",
		role: "Copy editor",
		email: "jules@lanternreview.example",
		activeMinutesAgo: 40,
	},
];

/** Every tag a post can carry, in the order the editor lists them. */
export const TAGS = ["Essays", "Craft", "Reading", "Notebook", "Interviews", "Field notes"];

/** The posts, newest edit first. */
export const POSTS: Post[] = [
	{
		id: "on-slow-reading",
		title: "On slow reading",
		slug: "on-slow-reading",
		excerpt: "What a book asks of us when we stop counting pages.",
		body: [
			"There is a kind of reading that refuses to be measured. It does not count pages or chase the end of a chapter; it lingers on a sentence until the sentence starts to answer back.",
			"I learned it by accident, on a winter train with one book and no signal. By the third hour I had read eleven pages and could have recited most of them.",
			"Slow reading is not a technique so much as a permission: to reread, to look up, to leave the margin full of questions you never answer.",
		],
		authorId: "maya",
		status: "draft",
		changed: false,
		tags: ["Essays", "Reading"],
		editedMinutesAgo: 2,
	},
	{
		id: "the-letterpress-year",
		title: "The letterpress year",
		slug: "the-letterpress-year",
		excerpt: "Twelve months, one Adana press and a drawer of wooden type.",
		body: [
			"The press arrived in January, wrapped in a blanket that smelled of machine oil and someone else's garage.",
			"Setting type by hand teaches patience the way a language teaches grammar: by making every mistake visible, one letter at a time.",
		],
		authorId: "tomas",
		status: "published",
		changed: true,
		tags: ["Craft", "Notebook"],
		editedMinutesAgo: 38,
		publishedMinutesAgo: 6 * DAY,
	},
	{
		id: "margins-and-marginalia",
		title: "Margins and marginalia",
		slug: "margins-and-marginalia",
		excerpt: "A short history of writing in the books we love.",
		body: [
			"Medieval readers wrote in their books without apology. The margin was a conversation, and the page expected company.",
			"Somewhere along the way we learned to keep books clean, as if the reading were the book's business and not ours.",
		],
		authorId: "ingrid",
		status: "scheduled",
		changed: false,
		tags: ["Reading", "Essays"],
		editedMinutesAgo: 5 * HOUR,
		scheduledInMinutes: 2 * DAY + 3 * HOUR,
	},
	{
		id: "a-conversation-with-a-bookbinder",
		title: "A conversation with a bookbinder",
		slug: "a-conversation-with-a-bookbinder",
		excerpt: "Hana Ito on thread, glue and why a book should open flat.",
		body: [
			"Hana Ito's studio is a converted bakery, and the ovens still hold her paper stock, warm and dry through the winter.",
			"“A book that will not lie open is a book that does not trust its reader,” she says, and then shows me how to fix one.",
		],
		authorId: "priya",
		status: "published",
		changed: false,
		tags: ["Interviews", "Craft"],
		editedMinutesAgo: 3 * DAY,
		publishedMinutesAgo: 3 * DAY,
	},
	{
		id: "field-notes-from-the-coast",
		title: "Field notes from the coast",
		slug: "field-notes-from-the-coast",
		excerpt: "Tide tables, a borrowed notebook and the birds no one could name.",
		body: [
			"Every morning the tide rewrote the beach, and every morning I tried to copy it into the notebook before it changed its mind.",
		],
		authorId: "jules",
		status: "draft",
		changed: false,
		tags: ["Field notes", "Notebook"],
		editedMinutesAgo: 70,
	},
	{
		id: "the-case-for-paper-notebooks",
		title: "The case for paper notebooks",
		slug: "the-case-for-paper-notebooks",
		excerpt: "Why the slowest tool on the desk keeps winning.",
		body: [
			"A paper notebook has no notifications, no sync conflicts and no opinion about what you should write next.",
		],
		authorId: "tomas",
		status: "published",
		changed: false,
		tags: ["Craft", "Essays"],
		editedMinutesAgo: 9 * DAY,
		publishedMinutesAgo: 9 * DAY,
	},
	{
		id: "reading-in-translation",
		title: "Reading in translation",
		slug: "reading-in-translation",
		excerpt: "Three translators on the sentences they could not carry across.",
		body: [
			"Every translation is a set of losses chosen carefully. The translators I spoke with keep lists of theirs.",
		],
		authorId: "maya",
		status: "scheduled",
		changed: false,
		tags: ["Interviews", "Reading"],
		editedMinutesAgo: DAY,
		scheduledInMinutes: 5 * DAY,
	},
	{
		id: "how-we-edit",
		title: "How we edit",
		slug: "how-we-edit",
		excerpt: "Notes on the Review's house style, for new contributors.",
		body: [
			"We cut adverbs before adjectives and adjectives before ideas. When in doubt, we read the paragraph aloud.",
		],
		authorId: "jules",
		status: "published",
		changed: true,
		tags: ["Notebook"],
		editedMinutesAgo: 4 * HOUR,
		publishedMinutesAgo: 21 * DAY,
	},
	{
		id: "the-commonplace-book",
		title: "The commonplace book",
		slug: "the-commonplace-book",
		excerpt: "Keeping a book of other people's sentences.",
		body: [
			"For four centuries readers copied the lines they could not let go of into one book, and the book became a portrait of its keeper.",
		],
		authorId: "ingrid",
		status: "draft",
		changed: false,
		tags: ["Reading", "Notebook"],
		editedMinutesAgo: 2 * DAY,
	},
	{
		id: "winter-reading-list",
		title: "A winter reading list",
		slug: "winter-reading-list",
		excerpt: "Eleven books for long evenings, chosen by the masthead.",
		body: ["We each picked two books, argued about them for a week and kept eleven."],
		authorId: "priya",
		status: "published",
		changed: false,
		tags: ["Reading"],
		editedMinutesAgo: 34 * DAY,
		publishedMinutesAgo: 34 * DAY,
	},
];

/** The media library, newest upload first; each file drawn as a swatch rather than a photo. */
export const MEDIA: MediaItem[] = [
	{
		id: "winter-train",
		name: "winter-train.jpg",
		type: "JPEG image",
		width: 2400,
		height: 1600,
		bytes: 842_000,
		authorId: "maya",
		uploadedMinutesAgo: 25,
		alt: "A train window at dusk with snow on the fields outside",
		caption: "The 16:40 to Trondheim, somewhere past Dombås.",
		postId: "on-slow-reading",
		swatch: { from: "oklch(0.42 0.09 260)", to: "oklch(0.78 0.06 70)", motif: "hills" },
	},
	{
		id: "wooden-type",
		name: "wooden-type-drawer.jpg",
		type: "JPEG image",
		width: 3000,
		height: 2000,
		bytes: 1_310_000,
		authorId: "tomas",
		uploadedMinutesAgo: 6 * DAY,
		alt: "A shallow drawer of wooden letterpress type sorted by size",
		caption: "Most of the drawer is the letter e.",
		postId: "the-letterpress-year",
		swatch: { from: "oklch(0.55 0.11 55)", to: "oklch(0.86 0.05 80)", motif: "grid" },
	},
	{
		id: "tide-pool",
		name: "tide-pool.png",
		type: "PNG image",
		width: 1800,
		height: 1800,
		bytes: 2_040_000,
		authorId: "jules",
		uploadedMinutesAgo: 80,
		alt: "A tide pool ringed with dark rock and green weed",
		caption: "",
		postId: "field-notes-from-the-coast",
		swatch: { from: "oklch(0.5 0.08 200)", to: "oklch(0.85 0.05 180)", motif: "waves" },
	},
	{
		id: "bindery",
		name: "bindery-ovens.jpg",
		type: "JPEG image",
		width: 2400,
		height: 3000,
		bytes: 1_120_000,
		authorId: "priya",
		uploadedMinutesAgo: 3 * DAY,
		alt: "Paper stacked inside an old bakery oven",
		caption: "Hana keeps her paper in the old ovens.",
		postId: "a-conversation-with-a-bookbinder",
		swatch: { from: "oklch(0.48 0.1 30)", to: "oklch(0.88 0.04 60)", motif: "stripes" },
	},
	{
		id: "marginalia-page",
		name: "marginalia-page.jpg",
		type: "JPEG image",
		width: 2000,
		height: 2600,
		bytes: 960_000,
		authorId: "ingrid",
		uploadedMinutesAgo: 5 * HOUR,
		alt: "A printed page crowded with handwritten notes in the margins",
		caption: "",
		swatch: { from: "oklch(0.62 0.05 85)", to: "oklch(0.93 0.03 90)", motif: "rings" },
	},
	{
		id: "harbor-dusk",
		name: "harbor-at-dusk.jpg",
		type: "JPEG image",
		width: 2400,
		height: 1350,
		bytes: 780_000,
		authorId: "jules",
		uploadedMinutesAgo: 9 * DAY,
		alt: "Fishing boats moored in a small harbour under an orange sky",
		caption: "",
		swatch: { from: "oklch(0.45 0.12 300)", to: "oklch(0.8 0.1 50)", motif: "sun" },
	},
];

/** The publication's recent history, newest first. */
export const ACTIVITY: Activity[] = [
	{
		id: "a1",
		authorId: "maya",
		verb: "edited",
		postId: "on-slow-reading",
		minutesAgo: 2,
		tone: "neutral",
		kind: "edited",
	},
	{
		id: "a2",
		authorId: "tomas",
		verb: "edited the published",
		postId: "the-letterpress-year",
		minutesAgo: 38,
		tone: "warning",
		kind: "edited",
	},
	{
		id: "a3",
		authorId: "jules",
		verb: "started",
		postId: "field-notes-from-the-coast",
		minutesAgo: 70,
		tone: "brand",
		kind: "created",
	},
	{
		id: "a4",
		authorId: "ingrid",
		verb: "scheduled",
		postId: "margins-and-marginalia",
		minutesAgo: 5 * HOUR,
		tone: "brand",
		kind: "scheduled",
	},
	{
		id: "a5",
		authorId: "priya",
		verb: "published",
		postId: "a-conversation-with-a-bookbinder",
		minutesAgo: 3 * DAY,
		tone: "success",
		kind: "published",
	},
	{
		id: "a6",
		authorId: "maya",
		verb: "scheduled",
		postId: "reading-in-translation",
		minutesAgo: DAY,
		tone: "brand",
		kind: "scheduled",
	},
	{
		id: "a7",
		authorId: "tomas",
		verb: "published",
		postId: "the-case-for-paper-notebooks",
		minutesAgo: 9 * DAY,
		tone: "success",
		kind: "published",
	},
];

/**
 * The moment an offset in minutes points at, measured from `now`.
 *
 * @param now The render's reference moment.
 * @param minutes Minutes before `now`; negative for the future.
 * @returns The moment as a `Date`.
 */
export function minutesBefore(now: Date, minutes: number): Date {
	return new Date(now.getTime() - minutes * MINUTE);
}

/**
 * Looks up an author; every fixture names one that exists, so a miss is the first author.
 *
 * @param id The author's id.
 * @returns The author.
 */
export function findAuthor(id: string): Author {
	return AUTHORS.find((author) => author.id === id) ?? AUTHORS[0]!;
}

/**
 * The words a post runs to, for the list and the editor's footer.
 *
 * @param post The post to count.
 * @returns Its body's word count.
 */
export function wordCount(post: Pick<Post, "body">): number {
	return post.body.join(" ").split(/\s+/).filter(Boolean).length;
}

/**
 * The moment a list shows for a post: when it went live, when it will, or its last edit for a
 * draft, so one Date column means the right thing per status.
 *
 * @param post The post.
 * @param now The render's reference moment.
 * @returns The moment that matters for the post's status.
 */
export function postDate(post: Post, now: Date): Date {
	if (post.status === "published") return minutesBefore(now, post.publishedMinutesAgo ?? 0);
	if (post.status === "scheduled") return minutesBefore(now, -(post.scheduledInMinutes ?? 0));
	return minutesBefore(now, post.editedMinutesAgo);
}
