/**
 * Relay's fixture data: the support team, the companies and contacts writing in, and every
 * conversation with its messages, frozen against one moment so each screen renders the same
 * relative times on every request and in every test.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The moment every screen renders against, so "2 hours ago" never drifts. */
export const NOW = "2026-11-01T16:00:00Z";

/** The plans a company can be on, cheapest first. */
export const PLANS = ["Free", "Pro", "Business", "Enterprise"] as const;

/** One plan name. */
export type Plan = (typeof PLANS)[number];

/** A person on Fernway's support team. */
export interface Teammate {
	id: string;
	name: string;
	initials: string;
}

/** A customer company; every contact belongs to one. */
export interface Company {
	id: string;
	name: string;
	plan: Plan;
	domain: string;
}

/** A person who writes to support. */
export interface Contact {
	id: string;
	name: string;
	email: string;
	title: string;
	companyId: string;
	location: string;
	/** When they became a customer. */
	since: string;
	/** Their last visit to the product; `null` when they never signed in. */
	lastSeen: string | null;
	/** Revenue from their seat over the account's life, in US dollars. */
	lifetimeValue: number;
}

/** Where a conversation sits: in the inbox, snoozed until later, or archived. */
export type ConversationStatus = "open" | "snoozed" | "archived";

/** The labels a conversation can carry, which the saved views filter by. */
export type Tag = "billing" | "bug" | "feature";

/** One message in a conversation: from the contact, a reply, or a note only the team sees. */
export interface Message {
	/** `"contact"` for the customer, otherwise the teammate's id. */
	from: string;
	at: string;
	/** Marks a note only teammates see. */
	note?: boolean;
	paragraphs: string[];
}

/** One support conversation, newest message last. */
export interface Conversation {
	id: string;
	subject: string;
	contactId: string;
	status: ConversationStatus;
	/** The teammate who owns it; `null` while nobody does. */
	assigneeId: string | null;
	unread: boolean;
	starred: boolean;
	tags: Tag[];
	/** When a snoozed conversation returns to the inbox. */
	snoozedUntil?: string;
	messages: Message[];
}

/** The person signed in, whose conversations "Assigned to me" lists. */
export const ME = "noor";

/** Fernway's support team. */
export const TEAMMATES: Teammate[] = [
	{ id: "noor", name: "Noor Haddad", initials: "NH" },
	{ id: "tomas", name: "Tomás Reyes", initials: "TR" },
	{ id: "mei", name: "Mei Lin", initials: "ML" },
	{ id: "jonah", name: "Jonah Brooks", initials: "JB" },
];

/** The companies Fernway sells to. */
export const COMPANIES: Company[] = [
	{ id: "northwind", name: "Northwind Labs", plan: "Business", domain: "northwindlabs.com" },
	{ id: "lumen", name: "Lumen Health", plan: "Enterprise", domain: "lumenhealth.io" },
	{ id: "arcadia", name: "Arcadia Freight", plan: "Enterprise", domain: "arcadiafreight.com" },
	{ id: "brightside", name: "Brightside Schools", plan: "Pro", domain: "brightside.edu" },
	{ id: "quill", name: "Quill & Co", plan: "Pro", domain: "quill.co" },
	{ id: "halcyon", name: "Halcyon Bank", plan: "Enterprise", domain: "halcyonbank.com" },
	{ id: "kestrel", name: "Kestrel Games", plan: "Pro", domain: "kestrelgames.gg" },
	{ id: "orchard", name: "Orchard Coffee", plan: "Free", domain: "orchard.coffee" },
];

/** Everyone who has written in, most recently seen first. */
export const CONTACTS: Contact[] = [
	{
		id: "maya-chen",
		name: "Maya Chen",
		email: "maya.chen@northwindlabs.com",
		title: "Head of Operations",
		companyId: "northwind",
		location: "Portland, OR",
		since: "2023-04-12T00:00:00Z",
		lastSeen: "2026-11-01T15:20:00Z",
		lifetimeValue: 18400,
	},
	{
		id: "leo-martins",
		name: "Leo Martins",
		email: "leo@lumenhealth.io",
		title: "IT Director",
		companyId: "lumen",
		location: "Lisbon",
		since: "2022-09-01T00:00:00Z",
		lastSeen: "2026-11-01T13:05:00Z",
		lifetimeValue: 96200,
	},
	{
		id: "priya-nair",
		name: "Priya Nair",
		email: "priya.nair@arcadiafreight.com",
		title: "Platform Engineer",
		companyId: "arcadia",
		location: "Rotterdam",
		since: "2021-11-15T00:00:00Z",
		lastSeen: "2026-11-01T11:42:00Z",
		lifetimeValue: 142800,
	},
	{
		id: "tom-becker",
		name: "Tom Becker",
		email: "tbecker@brightside.edu",
		title: "Data Coordinator",
		companyId: "brightside",
		location: "Denver, CO",
		since: "2024-08-20T00:00:00Z",
		lastSeen: "2026-10-31T19:10:00Z",
		lifetimeValue: 7200,
	},
	{
		id: "aiko-tanaka",
		name: "Aiko Tanaka",
		email: "aiko@quill.co",
		title: "Founder",
		companyId: "quill",
		location: "Osaka",
		since: "2024-02-03T00:00:00Z",
		lastSeen: "2026-10-31T09:30:00Z",
		lifetimeValue: 5400,
	},
	{
		id: "sam-okafor",
		name: "Sam Okafor",
		email: "sam.okafor@halcyonbank.com",
		title: "Security Lead",
		companyId: "halcyon",
		location: "Lagos",
		since: "2022-01-10T00:00:00Z",
		lastSeen: "2026-10-30T16:00:00Z",
		lifetimeValue: 210500,
	},
	{
		id: "ines-laurent",
		name: "Inès Laurent",
		email: "ines@kestrelgames.gg",
		title: "Producer",
		companyId: "kestrel",
		location: "Lyon",
		since: "2025-06-02T00:00:00Z",
		lastSeen: "2026-10-29T14:00:00Z",
		lifetimeValue: 1188,
	},
	{
		id: "hana-kim",
		name: "Hana Kim",
		email: "hana.kim@lumenhealth.io",
		title: "Compliance Manager",
		companyId: "lumen",
		location: "Seoul",
		since: "2023-01-18T00:00:00Z",
		lastSeen: "2026-10-28T08:15:00Z",
		lifetimeValue: 48100,
	},
	{
		id: "ravi-shah",
		name: "Ravi Shah",
		email: "ravi@orchard.coffee",
		title: "Owner",
		companyId: "orchard",
		location: "Austin, TX",
		since: "2026-07-21T00:00:00Z",
		lastSeen: "2026-10-24T17:40:00Z",
		lifetimeValue: 0,
	},
	{
		id: "diego-alvarez",
		name: "Diego Alvarez",
		email: "diego@northwindlabs.com",
		title: "Software Engineer",
		companyId: "northwind",
		location: "Mexico City",
		since: "2023-04-12T00:00:00Z",
		lastSeen: "2026-10-12T22:05:00Z",
		lifetimeValue: 9200,
	},
	{
		id: "ben-adler",
		name: "Ben Adler",
		email: "ben@quill.co",
		title: "Designer",
		companyId: "quill",
		location: "Berlin",
		since: "2024-02-03T00:00:00Z",
		lastSeen: "2026-09-30T10:00:00Z",
		lifetimeValue: 2700,
	},
	{
		id: "grace-liu",
		name: "Grace Liu",
		email: "grace.liu@halcyonbank.com",
		title: "Procurement",
		companyId: "halcyon",
		location: "Singapore",
		since: "2026-10-20T00:00:00Z",
		lastSeen: null,
		lifetimeValue: 0,
	},
];

/** Every conversation, newest first. */
export const CONVERSATIONS: Conversation[] = [
	{
		id: "2048",
		subject: "Invoice shows the wrong seat count",
		contactId: "maya-chen",
		status: "open",
		assigneeId: "noor",
		unread: true,
		starred: false,
		tags: ["billing"],
		messages: [
			{
				from: "contact",
				at: "2026-11-01T15:20:00Z",
				paragraphs: [
					"Hi there! Our October invoice bills us for 48 seats, but we removed six people on the 12th and the members page has shown 42 since then.",
					"Could you correct it before Friday? That is when finance pays the batch.",
				],
			},
		],
	},
	{
		id: "2047",
		subject: "Can we move to yearly billing?",
		contactId: "leo-martins",
		status: "open",
		assigneeId: "tomas",
		unread: true,
		starred: false,
		tags: ["billing"],
		messages: [
			{
				from: "contact",
				at: "2026-11-01T13:05:00Z",
				paragraphs: [
					"Our budget for next year is approved, and procurement prefers one annual invoice over twelve monthly ones.",
					"Can we switch at the December renewal and keep the current price per seat?",
				],
			},
		],
	},
	{
		id: "2046",
		subject: "SSO login loops back to the start",
		contactId: "priya-nair",
		status: "open",
		assigneeId: "noor",
		unread: true,
		starred: true,
		tags: ["bug"],
		messages: [
			{
				from: "contact",
				at: "2026-11-01T09:12:00Z",
				paragraphs: [
					"Since this morning, signing in with SSO sends half of our team back to the login page. Password sign-in still works for the admins.",
					"We changed nothing on our side as far as I know. Could you check the redirect URL Fernway expects?",
				],
			},
			{
				from: "noor",
				at: "2026-11-01T09:40:00Z",
				paragraphs: [
					"Thanks for the detail, Priya. Could you send the time of one failed attempt and the email of a person it happened to? I'll match it against our sign-in logs.",
				],
			},
			{
				from: "mei",
				at: "2026-11-01T10:05:00Z",
				note: true,
				paragraphs: [
					"Okta rotated their signing certificate overnight for a few tenants. Arcadia's metadata still points at the old one.",
				],
			},
			{
				from: "contact",
				at: "2026-11-01T11:42:00Z",
				paragraphs: [
					"It happened to jan.devries@arcadiafreight.com at 08:51 CET, and again at 09:03.",
				],
			},
		],
	},
	{
		id: "2045",
		subject: "Export to CSV drops the last row",
		contactId: "tom-becker",
		status: "open",
		assigneeId: "mei",
		unread: false,
		starred: false,
		tags: ["bug"],
		messages: [
			{
				from: "contact",
				at: "2026-10-31T17:30:00Z",
				paragraphs: [
					"When I export a board with 200 tasks to CSV, the file has 199 rows. It's always the last task on the board that goes missing.",
				],
			},
			{
				from: "mei",
				at: "2026-10-31T19:10:00Z",
				paragraphs: [
					"I can reproduce it, Tom, thank you. It happens when the last task has no due date. A fix is in review, and I'll write as soon as it ships.",
				],
			},
		],
	},
	{
		id: "2044",
		subject: "Feature request: a daily Slack digest",
		contactId: "aiko-tanaka",
		status: "open",
		assigneeId: "jonah",
		unread: false,
		starred: false,
		tags: ["feature"],
		messages: [
			{
				from: "contact",
				at: "2026-10-31T09:30:00Z",
				paragraphs: [
					"We live in Slack. A morning message listing what's due today on each board would save me opening Fernway just to check.",
				],
			},
		],
	},
	{
		id: "2043",
		subject: "Security questionnaire for our renewal",
		contactId: "sam-okafor",
		status: "open",
		assigneeId: "noor",
		unread: true,
		starred: true,
		tags: [],
		messages: [
			{
				from: "contact",
				at: "2026-10-30T16:00:00Z",
				paragraphs: [
					"Our vendor review asks for the attached questionnaire before we renew in January. Most of it should be in your SOC 2 report.",
					"Is there someone on your side who can fill in sections 4 and 7?",
				],
			},
		],
	},
	{
		id: "2042",
		subject: "Thanks for the quick fix!",
		contactId: "ines-laurent",
		status: "open",
		assigneeId: "mei",
		unread: false,
		starred: false,
		tags: [],
		messages: [
			{
				from: "contact",
				at: "2026-10-29T14:00:00Z",
				paragraphs: [
					"The timeline view loads in a second now, even on our biggest board. The whole team noticed. Thank you!",
				],
			},
		],
	},
	{
		id: "2041",
		subject: "Is the data processing agreement countersigned?",
		contactId: "hana-kim",
		status: "open",
		assigneeId: "tomas",
		unread: false,
		starred: false,
		tags: [],
		messages: [
			{
				from: "contact",
				at: "2026-10-27T10:20:00Z",
				paragraphs: [
					"We sent our signed DPA on the 20th. Our auditors need the countersigned copy by the end of the month.",
				],
			},
			{
				from: "tomas",
				at: "2026-10-28T08:15:00Z",
				paragraphs: [
					"Legal signed it yesterday, Hana. You'll find the PDF in Settings › Documents, and I've emailed a copy to your auditors' address too.",
				],
			},
		],
	},
	{
		id: "2040",
		subject: "Rate limit on the tasks API",
		contactId: "diego-alvarez",
		status: "snoozed",
		assigneeId: "noor",
		unread: false,
		starred: false,
		tags: ["bug"],
		snoozedUntil: "2026-11-03T09:00:00Z",
		messages: [
			{
				from: "contact",
				at: "2026-10-12T22:05:00Z",
				paragraphs: [
					"Our nightly sync gets 429s from /v2/tasks after about 300 requests. Is the limit per token or per workspace?",
				],
			},
			{
				from: "noor",
				at: "2026-10-13T08:30:00Z",
				paragraphs: [
					"It's per token, Diego: 300 requests a minute. Batching with the new bulk endpoint, shipping on November 3, will cut your sync to a dozen calls.",
				],
			},
		],
	},
	{
		id: "2039",
		subject: "Upgrading from Free to Pro",
		contactId: "ravi-shah",
		status: "snoozed",
		assigneeId: "jonah",
		unread: false,
		starred: false,
		tags: ["billing"],
		snoozedUntil: "2026-11-02T09:00:00Z",
		messages: [
			{
				from: "contact",
				at: "2026-10-24T17:40:00Z",
				paragraphs: [
					"If I upgrade halfway through the month, do I pay for the whole month or only the days left?",
				],
			},
		],
	},
	{
		id: "2038",
		subject: "Dark mode for the board view",
		contactId: "ben-adler",
		status: "archived",
		assigneeId: "jonah",
		unread: false,
		starred: false,
		tags: ["feature"],
		messages: [
			{
				from: "contact",
				at: "2026-09-30T10:00:00Z",
				paragraphs: ["Any plans for dark mode? The board is very bright at night."],
			},
			{
				from: "jonah",
				at: "2026-09-30T13:20:00Z",
				paragraphs: [
					"It's on the roadmap for the winter release, Ben. I've added your vote to the request.",
				],
			},
		],
	},
	{
		id: "2037",
		subject: "W-9 form for vendor setup",
		contactId: "grace-liu",
		status: "archived",
		assigneeId: "tomas",
		unread: false,
		starred: false,
		tags: ["billing"],
		messages: [
			{
				from: "contact",
				at: "2026-10-21T07:45:00Z",
				paragraphs: ["Could you send Fernway's W-9 so we can add you as a vendor?"],
			},
			{
				from: "tomas",
				at: "2026-10-21T09:10:00Z",
				paragraphs: ["Here it is, Grace. Let me know if procurement needs anything else."],
			},
		],
	},
	{
		id: "2036",
		subject: "Seat limit warning email",
		contactId: "maya-chen",
		status: "archived",
		assigneeId: "noor",
		unread: false,
		starred: false,
		tags: ["billing"],
		messages: [
			{
				from: "contact",
				at: "2026-10-02T12:00:00Z",
				paragraphs: [
					"We got a warning that we're at our seat limit. What happens when we add one more?",
				],
			},
		],
	},
];

/** Conversations opened per day over the last 14 days, oldest first. */
export const DAILY_CONVERSATIONS = [24, 31, 28, 35, 22, 12, 9, 29, 38, 33, 41, 30, 14, 11] as const;

/** The same 14 days one period earlier, for the comparison line. */
export const PREVIOUS_DAILY_CONVERSATIONS = [
	21, 26, 30, 27, 25, 10, 8, 27, 29, 31, 28, 26, 12, 9,
] as const;

/**
 * Finds a contact by id.
 *
 * @param id The contact's id.
 * @returns The contact, or `undefined` for an id nobody has.
 */
export function findContact(id: string): Contact | undefined {
	return CONTACTS.find((contact) => contact.id === id);
}

/**
 * Finds a company by id.
 *
 * @param id The company's id.
 * @returns The company, or `undefined` for an id no company has.
 */
export function findCompany(id: string): Company | undefined {
	return COMPANIES.find((company) => company.id === id);
}

/**
 * Finds a teammate by id.
 *
 * @param id The teammate's id.
 * @returns The teammate, or `undefined` for an id nobody on the team has.
 */
export function findTeammate(id: string): Teammate | undefined {
	return TEAMMATES.find((teammate) => teammate.id === id);
}

/**
 * Finds a conversation by id.
 *
 * @param id The conversation's id.
 * @returns The conversation, or `undefined` for an id no conversation has.
 */
export function findConversation(id: string): Conversation | undefined {
	return CONVERSATIONS.find((conversation) => conversation.id === id);
}

/**
 * The plan a contact's company is on, which the contacts table shows and filters by.
 *
 * @param contact The contact.
 * @returns The company's plan; `"Free"` when the company is unknown.
 */
export function planOf(contact: Contact): Plan {
	return findCompany(contact.companyId)?.plan ?? "Free";
}

/**
 * The conversations one contact started, newest first.
 *
 * @param contactId The contact's id.
 * @returns Their conversations, in every status.
 */
export function conversationsOf(contactId: string): Conversation[] {
	return CONVERSATIONS.filter((conversation) => conversation.contactId === contactId);
}

/**
 * The moment a conversation last moved: its newest message.
 *
 * @param conversation The conversation.
 * @returns The newest message's timestamp.
 */
export function updatedAt(conversation: Conversation): string {
	return conversation.messages.at(-1)?.at ?? NOW;
}
