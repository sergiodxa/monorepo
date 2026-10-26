/**
 * The about page in English: who Sergio is, what he works on today, how he learned to build
 * for the web, what he cares about and how to work with him. The page and `/about.md` both
 * read this document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AboutPage } from "~/app/services/about-page";

import {
	CONTACT,
	FIGURES,
	PHOTOS,
	PROFILE_LINKS,
	PROJECTS,
} from "~/resources/content/about/shared";
import routes from "~/routes/web";

/** The page an English-speaking reader gets. */
const EN: AboutPage = {
	locale: "en",
	title: "About",
	description:
		"Sergio Xalambrí is a web developer from Argentina, living in Lima, who works at Daffy and maintains Remix Auth and Remix Utils.",
	tagline: "Web developer at Daffy, open-source maintainer and Remix contributor.",
	intro: [
		"Hi, I’m Sergio. I build web apps for a living, maintain open-source libraries that thousands of Remix and React Router apps use, and write about what I learn along the way on this site.",
		"I’m from Argentina and live in Lima, Peru. I’ve been making web pages since I was ten, and working as a web developer for more than a decade.",
	],
	otherLanguage: { locale: "es-AR", label: "Español" },
	labels: {
		now: "What I do now",
		story: "How I got here",
		timeline: "Milestones",
		values: "What I care about",
		projects: "Open source",
		connect: "Work with me",
		connectNote: "I read everything that reaches me, in English or Spanish.",
		links: "Elsewhere",
		viewMarkdown: "View as Markdown",
		readPosts: "Read my articles",
		pressKit: "Press kit",
	},
	portrait: { ...PHOTOS.avatar, alt: "Sergio Xalambrí’s avatar" },
	feature: {
		...PHOTOS.helmet,
		alt: "An animated portrait of Sergio Xalambrí in a yellow racing helmet",
		caption: "The cover photo from my press kit, which events and podcasts are free to use.",
	},
	facts: [
		{ label: "Pronounced", value: "SEHR-hyoh sah-lahm-BREE (the X sounds like an S)" },
		{ label: "Based in", value: "Lima, Peru" },
		{ label: "Speaks", value: "Spanish and English" },
		{ label: "Handle", value: "@sergiodxa" },
	],
	stats: [
		{ value: FIGURES.firstPage, label: "the year I built my first web page" },
		{ value: FIGURES.years, label: "years working as a web developer" },
		{ value: FIGURES.posts, label: "articles and tutorials on this site" },
		{ value: FIGURES.downloads, label: "monthly downloads of Remix Utils and Remix Auth" },
	],
	now: [
		{
			title: "Daffy",
			detail:
				"I build the web app at the center of Daffy, a donor-advised fund that helps people give to the causes they care about.",
			href: "https://www.daffy.org",
		},
		{
			title: "Open source",
			detail:
				"I maintain Remix Auth, Remix Utils and remix-i18next, and contribute to Remix and React Router themselves.",
			href: PROFILE_LINKS.github,
		},
		{
			title: "The @sdxc packages",
			detail:
				"Libraries for building full-stack apps on Web Platform APIs. This site runs on them.",
			href: PROJECTS.packages,
		},
		{
			title: "Writing",
			detail:
				"Articles, tutorials, notes and TILs about web development, with patterns I use at work.",
			href: routes.articles.href(),
		},
	],
	story: [
		"In 2002, when I was about ten, I wondered how web pages were made. Someone I knew who was studying systems engineering answered my email with a few links about HTML. I built my first site in Microsoft Word, full of GIFs and tables with hidden borders, and uploaded it to GeoCities five files at a time.",
		"Learning to program took another eleven years. In 2013 I convinced my mom to lend me her credit card for a two-week online course at Mejorando.la, and I finally learned JavaScript. (I never paid her back.) I published my first open-source project, an electrical calculator, and found my first job by searching Google Maps for web design studios in Buenos Aires that I could walk to.",
		"In 2015 I dropped Angular for React and moved to Colombia to work at Platzi, the same school whose course got me started. There we open-sourced Pulse, a Markdown editor. In 2017 I joined ZEIT, now Vercel, to help people deploy their apps, and I started writing in English. At Able I led the frontend of an internal product and wrote the first frontend curriculum for Codeable, its bootcamp. Until the pandemic, I also organized the Tech Talks Peru meetups in Lima.",
		"I bought an early Remix license, built Remix Utils and Remix Auth on it in 2021, and have contributed to Remix since it went open source. In 2021 I joined Daffy, formerly Silverback Ventures, where I still build the web app, and I spend my spare time on the @sdxc packages and on this site.",
	],
	timeline: [
		{
			year: "2002",
			title: "First web page",
			detail: "Built in Microsoft Word and hosted on GeoCities.",
		},
		{
			year: "2013",
			title: "First job",
			detail: "Learned JavaScript and joined a web design studio in Buenos Aires.",
		},
		{
			year: "2015",
			title: "Platzi",
			detail: "Moved to Colombia as a frontend developer and switched to React.",
		},
		{
			year: "2017",
			title: "ZEIT, now Vercel",
			detail: "Support engineer, early Next.js contributor, and my first posts in English.",
		},
		{
			year: "2018",
			title: "Able and Codeable",
			detail: "Frontend lead, and teacher at the bootcamp whose frontend curriculum I wrote.",
		},
		{
			year: "2021",
			title: "Daffy",
			detail: "Joined Daffy, formerly Silverback Ventures, to build its web app.",
		},
		{
			year: "2021",
			title: "Remix Utils and Remix Auth",
			detail: "Two libraries that grew into some of the most used in the Remix ecosystem.",
		},
		{
			year: "2022",
			title: "Remix Conf Europe",
			detail: "“Remixing How We Give”, my talk at the European Remix conference.",
		},
		{
			year: "2026",
			title: "Remix Jam",
			detail: "“The Remix Way”, a talk at the Remix conference in Toronto.",
		},
	],
	values: [
		{
			title: "Share what I learn",
			detail:
				"I learned from free books and community sites, so I write down what I figure out. I wrote only in Spanish for years, to give back to the community that taught me.",
		},
		{
			title: "APIs that feel obvious",
			detail:
				"I enjoy designing libraries other developers find obvious, so the code they write on a first try is the code that works.",
		},
		{
			title: "Build on the platform",
			detail:
				"I like exploring what the Web Platform can do without a framework in the way, and building pages that work before their JavaScript loads.",
		},
	],
	projects: [
		{
			name: "Remix Auth",
			href: PROJECTS.remixAuth,
			since: "2021",
			description: "Authentication for Remix and React Router apps, with dozens of strategies.",
		},
		{
			name: "Remix Utils",
			href: PROJECTS.remixUtils,
			since: "2021",
			description: "Utilities for routes, responses, server-sent events, CSRF and more.",
		},
		{
			name: "remix-i18next",
			href: PROJECTS.remixI18next,
			since: "2021",
			description: "The easiest way to translate React Router framework-mode apps.",
		},
		{
			name: "remix-hono",
			href: PROJECTS.remixHono,
			since: "2023",
			description: "Hono middleware for Remix and React Router apps.",
		},
		{
			name: "The @sdxc packages",
			href: PROJECTS.monorepo,
			since: "2026",
			description: "A monorepo of packages and apps built on Web Platform APIs, at sdxc.dev.",
		},
	],
	connect: [
		{
			title: "Invite me to speak",
			detail: "Conferences, meetups, podcasts and workshops, in English or Spanish.",
			action: "Open the press kit",
			href: routes.press.index.href() + "?lang=en",
		},
		{
			title: "Sponsor my open source",
			detail: "Sponsorships pay for the time I spend maintaining the libraries you use.",
			action: "Sponsor on GitHub",
			href: CONTACT.sponsor,
		},
		{
			title: "Say hello",
			detail: "Questions about a post, a library or anything else.",
			action: "Send me an email",
			href: CONTACT.email,
		},
	],
	links: [
		{ label: "GitHub", href: PROFILE_LINKS.github },
		{ label: "X", href: PROFILE_LINKS.x },
		{ label: "YouTube", href: PROFILE_LINKS.youtube },
		{ label: "Packages", href: PROFILE_LINKS.packages },
	],
};

export default EN;
