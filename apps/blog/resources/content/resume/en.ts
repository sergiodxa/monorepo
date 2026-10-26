/**
 * The résumé in English: experience, open source, talks and skills, each bullet leading with
 * what it achieved. The page, `/resume.md` and the English PDF all read this document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Resume } from "~/app/services/resume";

import {
	CONTACT_LINKS,
	EMPLOYERS,
	PROJECT_FIGURES,
	PROJECT_LINKS,
	TALKS,
	pdfFor,
} from "~/resources/content/resume/shared";

/** The résumé an English-speaking recruiter or hiring manager reads. */
const EN: Resume = {
	locale: "en",
	title: "Résumé",
	description:
		"Sergio Xalambrí’s résumé: web developer at Daffy, maintainer of Remix Auth and Remix Utils, with a downloadable PDF.",
	name: "Sergio Xalambrí",
	headline: "Full-Stack Web Developer",
	location: "Lima, Peru (UTC−5) · Remote",
	summary: `Full-stack web developer since 2013, building with TypeScript, React, Remix and React Router. I build the web app at Daffy and maintain open-source libraries with ${PROJECT_FIGURES.combinedMonthlyDownloads}+ npm downloads a month combined, used across the Remix and React Router ecosystem. I care about the Web Platform, progressive enhancement and APIs other developers find obvious.`,
	otherLanguage: { locale: "es-AR", label: "Español" },
	labels: {
		experience: "Experience",
		openSource: "Open source",
		speaking: "Talks and writing",
		skills: "Skills",
		education: "Education",
		languages: "Languages",
		present: "Present",
		downloadPdf: "Download PDF",
		viewMarkdown: "View as Markdown",
		contact: "Contact",
		metricsNote: "Figures from GitHub and npm, October 2026.",
		latestVersion: "Latest version:",
	},
	contact: [
		{ label: "Email", ...CONTACT_LINKS.email },
		{ label: "Website", ...CONTACT_LINKS.website },
		{ label: "GitHub", ...CONTACT_LINKS.github },
		{ label: "LinkedIn", ...CONTACT_LINKS.linkedin },
	],
	experience: [
		{
			...EMPLOYERS.daffy,
			formerly: "formerly Silverback Ventures",
			role: "Web Developer",
			highlights: [
				"Build the web app of Daffy, a donor-advised fund that grew into a top-10 DAF in the U.S. with more than 16,000 accounts.",
				"Migrated the app from Next.js to Remix in nine months with no feature freeze, running both in one server with shared sessions while routes moved over one at a time.",
				"Designed a Remix backend-for-frontend over the Rails API, with a schema-validated API client, generated PDF donation reports and Open Graph images.",
				"Extracted the patterns into Remix Utils, Remix Auth strategies and remix-i18next, now open-source libraries other teams build on.",
			],
		},
		{
			...EMPLOYERS.able,
			role: "Frontend Lead",
			highlights: [
				"Led the frontend architecture of an internal product being prepared for public launch, building with React against a Rails backend.",
				"Wrote the initial frontend curriculum for Codeable, Able’s full-stack bootcamp, and taught its React course.",
			],
		},
		{
			...EMPLOYERS.zeit,
			formerly: "now Vercel",
			role: "Support Engineer",
			highlights: [
				"Helped customers deploy to Now and adopt Next.js, building sample apps for their use cases.",
				"Worked on the documentation of ZEIT’s API, so customers could learn the platform without a support ticket.",
			],
		},
		{
			...EMPLOYERS.platzi,
			role: "Frontend Developer",
			highlights: [
				"Built the live classes system, discussions, the video player and React server rendering on the Django platform of a YC-backed online school.",
				"Open-sourced Pulse Editor, Platzi’s Markdown editor, and Pulse, its Electron desktop app; taught web development courses.",
			],
		},
	],
	openSource: [
		{
			name: "Remix Utils",
			href: PROJECT_LINKS.remixUtils,
			detail: "Utilities for routes, responses, server-sent events, CSRF and more.",
			metric: `${PROJECT_FIGURES.remixUtils.monthlyDownloads} downloads a month, ${PROJECT_FIGURES.remixUtils.stars} stars`,
		},
		{
			name: "Remix Auth",
			href: PROJECT_LINKS.remixAuth,
			detail: "Authentication for Remix and React Router apps, with dozens of strategies.",
			metric: `${PROJECT_FIGURES.remixAuth.monthlyDownloads} downloads a month, ${PROJECT_FIGURES.remixAuth.stars} stars`,
		},
		{
			name: "remix-i18next",
			href: PROJECT_LINKS.remixI18next,
			detail: "Translations for Remix and React Router apps with i18next.",
			metric: `${PROJECT_FIGURES.remixI18next.monthlyDownloads} downloads a month`,
		},
		{
			name: "The @sdxc packages",
			href: PROJECT_LINKS.sdxc,
			detail: `${PROJECT_FIGURES.sdxcPackages} packages and a CLI for full-stack apps on Web Platform APIs and Cloudflare Workers.`,
		},
		{
			name: "Contributor",
			href: "https://github.com/sergiodxa",
			detail: "Remix, React Router, Next.js, SWR and micro.",
		},
	],
	speaking: [
		{ ...TALKS.remixJam },
		{ ...TALKS.remixConfEurope },
		{
			title: "Hundreds of articles and tutorials",
			event: "sergiodxa.com",
			date: "2013 – Present",
			href: "https://sergiodxa.com",
		},
	],
	skills: [
		{
			label: "Languages and frameworks",
			items: "TypeScript, JavaScript, React, Remix, React Router, Next.js, Node.js, Bun",
		},
		{
			label: "Platform",
			items: "Cloudflare Workers, D1, KV, Durable Objects, Express, Rails APIs, SQL",
		},
		{
			label: "Practices",
			items:
				"Authentication (OAuth 2.0, OpenID Connect, passkeys), testing with Vitest, accessibility, progressive enhancement, library and API design, technical writing",
		},
	],
	education: [
		{
			title: "Self-taught",
			detail: "Web development courses at Mejorando.la, now Platzi (2013 – 2015).",
		},
	],
	languages: [
		{ name: "Spanish", level: "native" },
		{ name: "English", level: "fluent" },
	],
	pdf: pdfFor("en"),
};

export default EN;
