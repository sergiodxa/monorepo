/**
 * The sales page's frequently asked questions, grouped into the two columns the page
 * renders them in. They live here as data because the copy changes far more often
 * than the layout, and answers about licensing, team seats, and purchasing-power-parity
 * pricing are commitments to a buyer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One question and its answer, as the page renders the pair. */
export interface FrequentQuestion {
	/** The question, phrased the way a reader would ask it. */
	question: string;
	/** The answer. A `\n\n` starts a new paragraph, preserved by the view's white space. */
	answer: string;
}

/**
 * The questions, one array per rendered column. The grouping is the layout: the page lays
 * the two arrays out side by side from the large breakpoint up, so moving a question
 * between arrays moves it between columns.
 */
export const FREQUENT_QUESTIONS: FrequentQuestion[][] = [
	[
		{
			question: "What do I need to know before reading this book?",
			answer:
				"You should be comfortable with React Router. While the concepts are framework-agnostic, the example app uses React Router v7 in framework mode. If you know another framework, you’ll still be able to follow along — just expect some differences in routing.",
		},
		{
			question: "Does this work with Remix or other frameworks?",
			answer:
				"Yes. The patterns and flows described are not tied to any specific framework. While the example app uses React Router, the principles apply to Remix, Next.js, SvelteKit, and others",
		},
		{
			question: "Does it cover login with Google, GitHub, etc.?",
			answer:
				"The book focuses on the Authorization Code flow with PKCE, which underpins most third-party logins. Once you understand that, adapting it to use providers like Google or GitHub is straightforward",
		},
		{
			question: "What’s the difference between the book and the complete package?",
			answer:
				"The book includes the full 46-page guide in PDF and EPUB formats. The Complete Package adds a working example app (web, API, auth server, and tests) plus private Discord access for questions and support.",
		},
		{
			question: "Can I use the example app in production?",
			answer:
				"The example app is designed for learning purposes. While it reflects real-world practices, I only recommend using the web app portion as a starting point. The API and Authorization Server are simplified and meant to illustrate concepts — not for production use.",
		},
	],
	[
		{
			question: "What am I allowed to do with the example codebase?",
			answer:
				"The example app is provided for educational purposes only. You're welcome to explore, adapt, and learn from it — but please don’t redistribute or repackage it commercially.",
		},
		{
			question: "Can I purchase multiple licenses for my team at a reduced price?",
			answer:
				"Yes! Reach out to me at hello@sergiodxa.com with the number of seats you need, and I’ll send you a custom team offer.",
		},
		{
			question: "What if I get stuck or have questions?",
			answer:
				"If you buy the Complete Package, you’ll be invited to a private Discord server where you can ask questions and get support directly from me and the community.",
		},
		{
			question:
				"Does the book or package include support for purchasing power parity (PPP) pricing?",
			answer:
				'Support for PPP pricing will be available after the early access period. If you’re in a country with lower purchasing power, you’ll be able to use a discount code to get "The Book" package at a reduced price.\n\nDuring early access, the "Complete" package is offered at the highest discount it will ever receive. Other discounts may be available later, but none will be as generous — and PPP will not apply to it.',
		},
	],
];
