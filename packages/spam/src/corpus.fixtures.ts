/**
 * A hand-written, labelled corpus of submissions: the acceptance criterion the default rules are
 * tuned against. Every entry is invented, so no real submission or personal data ships here; the
 * hard ham cases are the ones a careless rule would hold.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Submission } from "./check.js";
import type { SpamFilter } from "./filter.js";

/** One labelled submission, with the verdict the default rules must reach and why. */
export interface CorpusEntry {
	name: string;
	expected: SpamFilter.Verdict;
	submission: Submission;
}

/** The moment every timed submission is rendered at. */
const RENDERED_AT = new Date("2026-09-28T12:00:00Z");

/** A submission sent `seconds` after {@link RENDERED_AT}. */
function after(seconds: number): Pick<Submission, "renderedAt" | "submittedAt"> {
	return {
		renderedAt: RENDERED_AT,
		submittedAt: new Date(RENDERED_AT.getTime() + seconds * 1000),
	};
}

/** Real people writing, including every shape a careless rule would mistake for spam. */
export const HAM: CorpusEntry[] = [
	{
		name: "a short thank-you",
		expected: "ham",
		submission: { content: "Thanks, this was exactly what I needed!", ...after(40) },
	},
	{
		name: "a reply with one reference link",
		expected: "ham",
		submission: {
			content:
				"I hit the same problem last week. The fix is described in the MDN article on AbortSignal: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static",
			...after(120),
		},
	},
	{
		name: "a Markdown comment with two links in a Markdown field",
		expected: "ham",
		submission: {
			format: "markdown",
			content:
				"Nice write-up. For anyone comparing, [the spec](https://www.w3.org/TR/webmention/) and [this test suite](https://webmention.rocks/) helped me more than any tutorial.",
			...after(95),
		},
	},
	{
		name: "an excited comment with exclamation marks and an emoji",
		expected: "ham",
		submission: {
			content: "This is AMAZING!!! Finally someone explains it properly 🎉",
			...after(30),
		},
	},
	{
		name: "a support request with a phone number",
		expected: "ham",
		submission: {
			content:
				"Hi, my order hasn't arrived and the tracking page shows nothing. You can reach me at +1 415 555 0134 during business hours. Order number 48213.",
			author: { name: "Dana Whitfield", email: "dana@example.com" },
			...after(180),
		},
	},
	{
		name: "a question with a code sample",
		expected: "ham",
		submission: {
			format: "markdown",
			content:
				"Does this still work if the handler is async?\n\n```ts\nlet response = await fetch(url, { signal: AbortSignal.timeout(5000) });\n```",
			...after(75),
		},
	},
	{
		name: "a Spanish comment on a site expecting Spanish",
		expected: "ham",
		submission: {
			content: "Muy buen artículo, me ayudó a entender cómo funcionan los Durable Objects.",
			languages: ["es", "en"],
			...after(60),
		},
	},
	{
		name: "a Russian comment on a site expecting Russian",
		expected: "ham",
		submission: {
			content: "Спасибо за статью, очень понятно объяснено, как работает кэширование.",
			languages: ["ru"],
			...after(50),
		},
	},
	{
		name: "a Japanese comment on a site expecting Japanese",
		expected: "ham",
		submission: {
			content: "とても分かりやすい記事でした。ありがとうございます。",
			languages: ["ja"],
			...after(45),
		},
	},
	{
		name: "a comment whose author entered a personal website",
		expected: "ham",
		submission: {
			content: "I wrote a follow-up on this with benchmarks, happy to hear what you think.",
			author: { name: "Priya N.", url: "https://priya.example.dev" },
			...after(90),
		},
	},
	{
		name: "a long, thoughtful comment",
		expected: "ham",
		submission: {
			content:
				"I disagree with the second point. Caching at the edge is great until you need per-user data, and then every cache key has to include the session, which kills the hit rate. What worked for us was splitting the page into a cached shell and a small personalized fragment fetched after load. It is more moving parts, but the shell is served from cache 98% of the time.",
			...after(400),
		},
	},
	{
		name: "a comment mentioning an Ethereum concept without a wallet",
		expected: "ham",
		submission: {
			content:
				"How does this compare to storing hashes on Ethereum? Genuinely curious about the trade-offs.",
			...after(70),
		},
	},
	{
		name: "a comment typed in all caps by a short word",
		expected: "ham",
		submission: { content: "OK, THANKS", ...after(20) },
	},
	{
		name: "a submission with no timing or author data",
		expected: "ham",
		submission: { content: "Could you add an RSS feed for the tutorials section?" },
	},
];

/** Spam as it arrives, from the crude to the careful. */
export const SPAM: CorpusEntry[] = [
	{
		name: "a link dump",
		expected: "spam",
		submission: {
			content:
				"cheap watches https://watches.example/a https://watches.example/b https://watches.example/c https://watches.example/d https://watches.example/e",
			...after(30),
		},
	},
	{
		name: "BBCode links in a plain-text field",
		expected: "spam",
		submission: {
			content:
				"Nice site! [url=https://pills.example]buy pills online[/url] [url=https://pills.example/2]discount[/url]",
			...after(30),
		},
	},
	{
		name: "HTML links pasted into a plain-text field",
		expected: "spam",
		submission: {
			content:
				'Very informative. <a href="https://loans.example">fast loans</a> and <a href="https://loans.example/b">no credit check</a>',
			...after(25),
		},
	},
	{
		name: "a submission sent a second after the form rendered",
		expected: "unsure",
		submission: { content: "Great article, thanks for writing it.", ...after(1) },
	},
	{
		name: "a crypto recovery scam with messaging handles",
		expected: "spam",
		submission: {
			content:
				"Lost your crypto? Our team recovers stolen funds in 24 hours. Contact us on Telegram @recover_fast_team or WhatsApp +44 7700 900123. Send a small fee to 0x52908400098527886E0F7030069857D2E4169EE7 to start.",
			...after(20),
		},
	},
	{
		name: "shortened links behind a vague compliment",
		expected: "spam",
		submission: {
			content:
				"Wow what a post, check this out https://bit.ly/3xYz12a and https://tinyurl.com/deal-now",
			...after(15),
		},
	},
	{
		name: "a link to a raw IP address",
		expected: "unsure",
		submission: {
			content: "Download the full version here: http://203.0.113.45/setup.exe",
			...after(30),
		},
	},
	{
		name: "Cyrillic homoglyphs disguising a brand",
		expected: "unsure",
		submission: {
			content: "Your Pаypаl account is on hold, verify now at the link in our profile.",
			...after(30),
		},
	},
	{
		name: "mathematical letters dodging keyword filters",
		expected: "unsure",
		submission: { content: "𝗙𝗥𝗘𝗘 𝗙𝗢𝗟𝗟𝗢𝗪𝗘𝗥𝗦 𝗡𝗢𝗪 click the link in bio", ...after(30) },
	},
	{
		name: "zero-width characters splitting keywords",
		expected: "unsure",
		submission: { content: "Get c​h​e​a​p v​i​a​g​r​a today", ...after(30) },
	},
	{
		name: "shouting and repetition",
		expected: "unsure",
		submission: {
			content:
				"BEST PRICES GUARANTEED BEST PRICES GUARANTEED BEST PRICES GUARANTEED ORDER TODAY!!!!!!!! $$$$$$$$",
			...after(30),
		},
	},
	{
		name: "Russian SEO spam on an English-only site",
		expected: "unsure",
		submission: {
			content: "Продвижение сайтов в топ поисковых систем недорого, пишите нам сегодня.",
			languages: ["en"],
			...after(30),
		},
	},
	{
		name: "an author name stuffed with keywords and a URL",
		expected: "spam",
		submission: {
			content: "Great content, keep it up. Visit us for the best deals https://casino.example",
			author: {
				name: "Best Online Casino Bonus 2026 casino.example",
				url: "https://bit.ly/casino-bonus",
			},
			...after(10),
		},
	},
	{
		name: "a fast link dump with emoji",
		expected: "spam",
		submission: {
			content:
				"🔥🔥🔥💰💰💰🚀🚀🚀✅ earn money https://earn.example/1 https://earn.example/2 https://earn.example/3",
			...after(2),
		},
	},
];
