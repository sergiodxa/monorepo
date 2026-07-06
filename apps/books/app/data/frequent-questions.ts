/**
 * Static content data for the site's FAQ section, exporting the frequently asked
 * questions and answers grouped into two columns covering prerequisites, framework
 * support, package differences, licensing, team pricing, support, and PPP pricing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export default [
	[
		{
			q: "What do I need to know before reading this book?",
			a: "You should be comfortable with React Router. While the concepts are framework-agnostic, the example app uses React Router v7 in framework mode. If you know another framework, you’ll still be able to follow along — just expect some differences in routing.",
		},
		{
			q: "Does this work with Remix or other frameworks?",
			a: "Yes. The patterns and flows described are not tied to any specific framework. While the example app uses React Router, the principles apply to Remix, Next.js, SvelteKit, and others",
		},
		{
			q: "Does it cover login with Google, GitHub, etc.?",
			a: "The book focuses on the Authorization Code flow with PKCE, which underpins most third-party logins. Once you understand that, adapting it to use providers like Google or GitHub is straightforward",
		},
		{
			q: "What’s the difference between the book and the complete package?",
			a: "The book includes the full 46-page guide in PDF and EPUB formats. The Complete Package adds a working example app (web, API, auth server, and tests) plus private Discord access for questions and support.",
		},
		{
			q: "Can I use the example app in production?",
			a: "The example app is designed for learning purposes. While it reflects real-world practices, I only recommend using the web app portion as a starting point. The API and Authorization Server are simplified and meant to illustrate concepts — not for production use.",
		},
	],
	[
		{
			q: "What am I allowed to do with the example codebase?",
			a: "The example app is provided for educational purposes only. You're welcome to explore, adapt, and learn from it — but please don’t redistribute or repackage it commercially.",
		},
		{
			q: "Can I purchase multiple licenses for my team at a reduced price?",
			a: "Yes! Reach out to me at hello@sergiodxa.com with the number of seats you need, and I’ll send you a custom team offer.",
		},
		{
			q: "What if I get stuck or have questions?",
			a: "If you buy the Complete Package, you’ll be invited to a private Discord server where you can ask questions and get support directly from me and the community.",
		},
		{
			q: "Does the book or package include support for purchasing power parity (PPP) pricing?",
			a: 'Support for PPP pricing will be available after the early access period. If you’re in a country with lower purchasing power, you’ll be able to use a discount code to get "The Book" package at a reduced price.\n\nDuring early access, the "Complete" package is offered at the highest discount it will ever receive. Other discounts may be available later, but none will be as generous — and PPP will not apply to it.',
		},
	],
];
