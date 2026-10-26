/**
 * The press kit in English: the bios, photos, topics and appearances an event or podcast
 * needs, plus the copy around them. The page and `/press.md` both read this document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PressKit } from "~/app/services/press-kit";

import {
	APPEARANCES,
	monthName,
	PHOTOS,
	PROFILE_LINKS,
	PROJECT_LINKS,
} from "~/resources/content/press/shared";

/** The kit an English-speaking organizer reads. */
const EN: PressKit = {
	locale: "en",
	title: "Press Kit",
	description:
		"Bios, photos, talk topics and past appearances for events, podcasts and anyone introducing Sergio Xalambrí.",
	tagline: "Web developer, open-source maintainer and Remix contributor.",
	intro:
		"Everything an event, podcast or publication needs to introduce me, free to use as is. If you need something that isn’t here, write to me with the form at the end of this page.",
	otherLanguage: { locale: "es-AR", label: "Español" },
	labels: {
		facts: "Quick facts",
		bios: "Bios",
		biosNote: "Written in the third person. Pick the length your program or form asks for.",
		photos: "Photos",
		photosNote: "Cleared for event promotion and editorial use. No credit required.",
		download: "Download",
		topics: "Topics",
		openSource: "Open source",
		appearances: "Talks and appearances",
		formats: "Formats",
		links: "Elsewhere",
		contact: "Invite me",
		viewMarkdown: "View as Markdown",
		copy: "Copy",
		copied: "Copied",
		words: "words",
	},
	facts: [
		{ label: "Name", value: "Sergio Xalambrí" },
		{ label: "Pronunciation", value: "SEHR-hyoh sah-lahm-BREE (the X sounds like an S)" },
		{ label: "Pronouns", value: "He/Him" },
		{ label: "Role", value: "Web Developer at Daffy" },
		{ label: "Based in", value: "Lima, Peru (PET, UTC−5)" },
		{ label: "From", value: "Argentina" },
		{ label: "Languages", value: "English, Spanish" },
		{ label: "Handle", value: "@sergiodxa" },
	],
	bios: [
		{
			id: "one-line",
			label: "One line",
			use: "Podcast show notes and social posts",
			text: "Sergio Xalambrí is an Argentinian web developer at Daffy and the maintainer of Remix Auth and Remix Utils.",
		},
		{
			id: "short",
			label: "Short",
			use: "Event apps and printed programs",
			text: "Sergio Xalambrí is an Argentinian web developer with more than a decade of experience. He works at Daffy and maintains open-source libraries around React Router, Remix, and OAuth 2.0. He enjoys building full-stack applications, designing libraries, and exploring the Web Platform.",
		},
		{
			id: "medium",
			label: "Medium",
			use: "Conference websites and speaker pages",
			text: "Sergio Xalambrí is an Argentinian web developer with more than a decade of experience, based in Lima, Peru. He works at Daffy, where he builds the web app that helps people give to the causes they care about. He maintains Remix Auth and Remix Utils, two of the most used libraries in the Remix and React Router ecosystem, contributes to Remix and React Router themselves, and publishes the @sdxc packages for building apps on the Web Platform. He writes articles and tutorials about web development at sergiodxa.com.",
		},
		{
			id: "long",
			label: "Long",
			use: "Brochures and detailed profiles",
			text: "Sergio Xalambrí is an Argentinian web developer with more than a decade of experience building for the web, now based in Lima, Peru. He works at Daffy, a donor-advised fund that helps people give to the causes they care about, where he builds the web app at the center of the product.\n\nHe is best known in the Remix community for Remix Auth, the authentication library many Remix and React Router apps sign their users in with, and Remix Utils, a collection of utilities for routes, responses, and the server. He contributes to Remix and React Router, and maintains the @sdxc packages, a set of libraries for building full-stack apps on Web Platform APIs, documented at sdxc.dev.\n\nSergio has spoken at Remix Conf Europe and Remix Jam, and on podcasts and meetups across Latin America, in English and Spanish. He has written hundreds of articles and tutorials at sergiodxa.com, focused on practical patterns for authentication, data loading, and designing libraries. He enjoys building full-stack applications, designing APIs other developers find obvious, and exploring what the Web Platform can do without a framework in the way.",
		},
		{
			id: "introduction",
			label: "Introduction for a host",
			use: "Read aloud on stage or at the start of an episode",
			text: "Our next speaker is Sergio Xalambrí. Sergio is a web developer at Daffy and the person behind Remix Auth and Remix Utils, two libraries you’ve probably used if you’ve built anything with Remix or React Router. He joins us from Lima, Peru. Please welcome Sergio!",
		},
	],
	photos: [
		{ ...PHOTOS.avatar, label: "Avatar", alt: "Sergio Xalambrí’s avatar" },
		{
			...PHOTOS.helmet,
			label: "Cover photo",
			alt: "An animated portrait of Sergio Xalambrí in a yellow racing helmet",
		},
	],
	topics: [
		{
			name: "Remix",
			detail: "Building full-stack apps with Remix v3, its router, middleware and components.",
		},
		{
			name: "React Router",
			detail: "Framework mode, data loading, actions, authentication and patterns that scale.",
		},
		{
			name: "The @sdxc packages",
			detail: "Libraries for authentication, jobs, mail, caching and more on Web Platform APIs.",
		},
		{
			name: "Authentication and OAuth 2.0",
			detail: "Signing users in safely: sessions, OAuth 2.0, OpenID Connect and passkeys.",
		},
		{
			name: "Maintaining open source",
			detail: "Designing APIs, versioning and supporting libraries thousands of apps rely on.",
		},
		{
			name: "Web development",
			detail: "The Web Platform, progressive enhancement, and designing libraries people enjoy.",
		},
	],
	openSource: [
		{
			name: "Remix Auth",
			href: PROJECT_LINKS.remixAuth,
			description: "Authentication for Remix and React Router apps, with dozens of strategies.",
		},
		{
			name: "Remix Utils",
			href: PROJECT_LINKS.remixUtils,
			description: "Utilities for routes, responses, server-sent events, CSRF and more.",
		},
		{
			name: "The @sdxc packages",
			href: PROJECT_LINKS.monorepo,
			description: "A monorepo of packages and apps built on Web Platform APIs, at sdxc.dev.",
		},
		{
			name: "Remix",
			href: PROJECT_LINKS.remix,
			description: "Contributor to the framework and its packages.",
		},
		{
			name: "React Router",
			href: PROJECT_LINKS.reactRouter,
			description: "Contributor to the router and its framework mode.",
		},
	],
	appearances: APPEARANCES.map((item) => ({
		...item,
		date: monthName(item.date, "en"),
		language: item.language === "en" ? "English" : "Spanish",
	})),
	formats: [
		{ name: "Lightning talks", detail: "Five to ten minutes on one idea." },
		{ name: "Talks", detail: "Around thirty minutes, with or without live coding." },
		{ name: "Keynotes", detail: "Opening or closing a conference." },
		{ name: "Workshops", detail: "Hands-on and paid, from half a day to a full day." },
		{ name: "Recording", detail: "Talks may be recorded and published." },
		{ name: "Travel", detail: "In-person events need travel and lodging covered." },
	],
	links: [
		{ label: "Website", href: PROFILE_LINKS.website },
		{ label: "GitHub", href: PROFILE_LINKS.github },
		{ label: "X", href: PROFILE_LINKS.x },
		{ label: "YouTube", href: PROFILE_LINKS.youtube },
		{ label: "Packages", href: PROFILE_LINKS.packages },
	],
	contact: {
		intro:
			"Organizing a conference, meetup, podcast or workshop? Tell me about it and I’ll reply by email.",
		fields: {
			name: "Your name",
			email: "Email",
			kind: "What is it?",
			kindPlaceholder: "Choose one",
			event: "Event or show (optional)",
			eventPlaceholder: "e.g. Remix Jam 2027",
			message: "Message",
			messagePlaceholder: "Dates, format, audience, and anything else I should know…",
		},
		kinds: {
			conference: "Conference",
			meetup: "Meetup",
			podcast: "Podcast or interview",
			workshop: "Workshop",
			other: "Something else",
		},
		errors: {
			name: "Enter your name.",
			email: "Enter a valid email address, like name@example.com.",
			kind: "Choose what you’re organizing.",
			event: "Keep the event name under 150 characters, on one line.",
			message: "Write a message of at least 10 characters.",
		},
		submit: "Send invitation",
		sending: "Sending…",
		sent: "Thanks! Your message is on its way, and I’ll reply to the email address you gave.",
		sendAnother: "Send another message",
		invalid: "Please correct the highlighted fields and send your message again.",
		failed: "Your message couldn’t be sent. It’s still here, so please try again.",
		rateLimited:
			"You’ve sent several messages in a short time. Your message is still here; please wait a minute and try again.",
		resubmit:
			"This form expired before it was sent. Your message is still here; please send it again.",
		privacy:
			"Your name and email are used only to reply to you. Please don’t include passwords or payment details.",
	},
};

export default EN;
