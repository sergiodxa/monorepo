/**
 * The sales page's marketing copy: the hero, the "what's inside" blocks, the testimonial,
 * the two package descriptions, the upgrade call-out, and the footer line. It lives here
 * as data so the copy can be rewritten — which happens far more often than the layout
 * changes — without reading a single line of markup.
 *
 * Prose carrying inline links stays in the view: a sentence with an anchor inside it is
 * markup, and flattening it into strings here would only move the markup somewhere it
 * cannot be read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One "what's inside" block: a titled feature and its paragraph. */
export interface DescriptionBlock {
	/** The feature's name, emoji included — the emoji is part of the design. */
	title: string;
	/** The paragraph describing it. */
	description: string;
}

/** One bullet in a package's contents list: a bolded name and what it is. */
export interface PackageItem {
	/** The emoji leading the bullet. */
	icon: string;
	/** The bolded item name. */
	name: string;
	/** The rest of the bullet, following an em dash. */
	description: string;
}

/** Everything the page says about one purchasable package, aside from its live price. */
export interface PackageCopy {
	/** The package's name, emoji included. */
	title: string;
	/** The checkout `:type` this package is bought through. */
	type: "complete" | "essentials";
	/** Paragraphs shown before the contents list. */
	lead: string[];
	/** The line introducing the contents list, when the package has one. */
	includesLabel?: string;
	/** The contents list, when the package has one. */
	includes?: PackageItem[];
	/** Paragraphs shown after the contents list. */
	trailing?: string[];
	/** Whether an active launch discount applies to this package's price. */
	discountable: boolean;
}

/** The hero: the handbook's title, its pitch, and the link down to the packages. */
export const HERO = {
	title: "React Router OAuth2 Handbook",
	/** Split so "OAuth2 authentication" can be emphasized without markup in a string. */
	pitchBefore: "A practical, modern guide to implementing ",
	pitchStrong: "OAuth2 authentication",
	pitchAfter:
		" in React Router and Remix apps—built on patterns you can apply to any web application.",
	packagesLink: "⬇️ View the packages",
};

/** The "what's inside" section: its heading and the four feature blocks. */
export const DESCRIPTION = {
	title: "What’s inside",
	blocks: [
		{
			title: "📘 47-page handbook",
			description:
				"A concise, no-fluff guide that walks you through the core concepts of OAuth2 and OpenID Connect using React Router v7 in framework mode. Learn how to implement secure auth flows, refresh tokens, and introspection endpoints — all in a modern full-stack app context.",
		},
		{
			title: "🧪 Real World Example Application",
			description:
				"You’ll get access to a complete React Router + OAuth2 example app that mirrors production use cases. From login screens to token storage strategies, it shows how everything fits together — with code you can run, read, and reuse.",
		},
		{
			title: "🔒 Security-First Approach",
			description:
				"OAuth2 is easy to get wrong. This book emphasizes the why behind each step, helping you avoid common pitfalls like insecure token handling or incorrect client configuration. Whether you're new to OAuth or want to level up, this will sharpen your instincts.",
		},
		{
			title: "🚀 Fast, Framework-Ready Setup",
			description:
				"Built for devs using React Router in framework mode (like Remix), the patterns you’ll learn are ready to drop into your stack. No boilerplate. No guessing. Just a focused, modern approach to authentication that respects both DX and security.",
		},
	] satisfies DescriptionBlock[],
};

/** The sample-chapter section's heading and its one line of copy. */
export const SAMPLE = {
	title: "Get a Free Sample",
	description: "Get a peek at the content. Enter your email address and access a sample chapter.",
	submitLabel: "Read free sample",
};

/** The one testimonial, with the quotation marks left to the view's pseudo-elements. */
export const TESTIMONIAL = {
	/** Split so "OAuth2" can be emphasized inside the quote. */
	quoteBefore: "I always learned enough of ",
	quoteStrong: "OAuth2",
	quoteAfter: " to get the job done, after reading this I finally understand how it works.",
	name: "Alem Tuzlak",
	profileUrl: "https://x.com/AlemTuzlak",
	roleBefore: "Co-founder of ",
	company: "Forge 42",
	companyUrl: "https://x.com/forge42dev",
	photo: "/alem.png",
	photoAlt: "Alem Tuzlak",
};

/** The pricing section's heading, lead paragraph, and button label. */
export const PRICING = {
	title: "Get React Router OAuth2 Handbook",
	description:
		"Choose the option that fits your needs — whether you're just looking to understand the core concepts or want the full experience with hands-on code and private support.",
	/** The label preceding the price on each package's button. */
	purchaseLabel: "Purchase for",
};

/**
 * The two packages, in the order the page lists them: the flagship first, because it is
 * the one the launch discount applies to and the one most readers should buy.
 *
 * Annotated rather than inferred so every package is the same type — the two differ in
 * which optional fields they carry, and an inferred tuple would make the shared fields the
 * only ones a loop can read.
 */
export const PACKAGES: PackageCopy[] = [
	{
		title: "🚀 Complete Package",
		type: "complete",
		lead: [
			"Everything you need to master OAuth2 with React Router in production-ready environments.",
		],
		includesLabel: "Includes:",
		includes: [
			{
				icon: "📘",
				name: "The Book",
				description: "47-page guide in PDF and EPUB formats",
			},
			{
				icon: "🧪",
				name: "Example App",
				description: "Web App, API, Authorization Server, and E2E tests",
			},
			{
				icon: "💬",
				name: "Private Discord Access",
				description: "Get support, ask questions, and connect with other devs",
			},
		],
		trailing: [
			"Whether you're building an internal tool, a SaaS product, or integrating with a third-party identity provider, this package gives you the confidence and code to ship it right.",
		],
		/** The launch campaigns are scoped to Complete, so only this price is ever struck through. */
		discountable: true,
	},
	{
		title: "📘 The Book",
		type: "essentials",
		lead: [
			"Just the essentials. The complete 47-page guide in PDF and EPUB formats",
			"If you want a clear, hands-on explanation of how to implement secure OAuth2 flows using React Router v7 — from login to token refresh and everything in between — this is your starting point.",
		],
		discountable: false,
	},
];

/** The call-out offering an existing reader the difference-only upgrade. */
export const UPGRADE_CALLOUT = {
	eyebrow: "Do you already have The Book?",
	/** Split so "Complete Package" can be emphasized inside the heading. */
	titleBefore: "Upgrade to the ",
	titleStrong: "Complete Package",
	description: "You only pay the difference and get access to the app + community.",
	action: "Upgrade now →",
};

/** The author section's heading and portrait. Its prose carries links, so it stays in the view. */
export const AUTHOR = {
	title: "About the Author",
	photo: "/avatar.png",
	photoAlt: "Sergio Xalambrí",
	profileUrl: "https://x.com/sergiodxa",
	blogUrl: "https://sergiodxa.com",
};

/** The FAQ section's heading; the questions themselves live in `frequent-questions.ts`. */
export const FAQ_TITLE = "Frequently Asked Questions";

/** The footer line, carried over verbatim including its year. */
export const FOOTER = "© 2025 Sergio Xalambrí. All Rights Reserved.";
