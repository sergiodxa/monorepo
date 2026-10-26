/**
 * The about page: who the author is, what he works on, how he got here and how to reach him,
 * kept as one structured document per language. The page renders it designed, and `/about.md`
 * writes the same document out as Markdown, so the two formats can never disagree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PageLocale } from "~/app/services/page-locale";

import EN from "~/resources/content/about/en";
import ES_AR from "~/resources/content/about/es-AR";

/** The about page's content and the copy around it, in one language. */
export interface AboutPage {
	locale: PageLocale;
	title: string;
	description: string;
	/** Who the author is, in one sentence under the name. */
	tagline: string;
	/** The greeting paragraphs the hero opens with. */
	intro: ReadonlyArray<string>;
	/** The other language's name, written in that language, for the switcher. */
	otherLanguage: { locale: PageLocale; label: string };
	labels: AboutPage.Labels;
	portrait: AboutPage.Photo;
	/** The wide photo between the story and the values, with its caption. */
	feature: AboutPage.Photo & { caption: string };
	facts: ReadonlyArray<AboutPage.Fact>;
	stats: ReadonlyArray<AboutPage.Stat>;
	now: ReadonlyArray<AboutPage.Focus>;
	/** The story as paragraphs, oldest first. */
	story: ReadonlyArray<string>;
	timeline: ReadonlyArray<AboutPage.Milestone>;
	values: ReadonlyArray<AboutPage.Value>;
	projects: ReadonlyArray<AboutPage.Project>;
	connect: ReadonlyArray<AboutPage.Invitation>;
	links: ReadonlyArray<AboutPage.Link>;
}

/** Types the about page's sections are written in. */
export namespace AboutPage {
	/** Section headings and small interface strings. */
	export interface Labels {
		now: string;
		story: string;
		timeline: string;
		values: string;
		projects: string;
		connect: string;
		connectNote: string;
		links: string;
		viewMarkdown: string;
		readPosts: string;
		pressKit: string;
	}

	/** A photo served from this site, with its real dimensions. */
	export interface Photo {
		src: string;
		alt: string;
		width: number;
		height: number;
	}

	/** One labeled detail, such as how to pronounce the name. */
	export interface Fact {
		label: string;
		value: string;
	}

	/** A number worth stating, with what it counts. */
	export interface Stat {
		value: string;
		label: string;
	}

	/** One thing the author spends his time on today. */
	export interface Focus {
		title: string;
		detail: string;
		href?: string;
	}

	/** A point in the story, with the year it happened. */
	export interface Milestone {
		year: string;
		title: string;
		detail: string;
	}

	/** A principle the author works by, with where it comes from. */
	export interface Value {
		title: string;
		detail: string;
	}

	/** An open-source project the author maintains, with the year he started it. */
	export interface Project {
		name: string;
		href: string;
		since: string;
		description: string;
	}

	/** A way to work with the author, and the link that starts it. */
	export interface Invitation {
		title: string;
		detail: string;
		action: string;
		href: string;
	}

	/** A profile elsewhere. */
	export interface Link {
		label: string;
		href: string;
	}
}

/** Every page by language. */
const PAGES: Record<PageLocale, AboutPage> = { en: EN, "es-AR": ES_AR };

/**
 * The about page written in `locale`.
 *
 * @param locale The language to read it in.
 * @returns The page's content.
 */
export function aboutPageFor(locale: PageLocale): AboutPage {
	return PAGES[locale];
}

/**
 * Writes the page as Markdown in the order the page shows it. Site paths become absolute
 * links, since the text is read and quoted outside this site.
 *
 * @param page The page to write.
 * @param origin The site's origin, which relative paths resolve against.
 * @returns The Markdown document.
 */
export function aboutPageMarkdown(page: AboutPage, origin: string): string {
	let absolute = (href: string) => new URL(href, origin).href;
	let lines: string[] = [`# ${page.title}`, "", `_${page.tagline}_`, ""];
	for (let paragraph of page.intro) lines.push(paragraph, "");
	lines.push(`![${page.portrait.alt}](${absolute(page.portrait.src)})`, "");

	for (let fact of page.facts) lines.push(`- **${fact.label}:** ${fact.value}`);
	lines.push("");
	for (let stat of page.stats) lines.push(`- **${stat.value}** ${stat.label}`);

	lines.push("", `## ${page.labels.now}`, "");
	for (let focus of page.now) {
		let title = focus.href ? `[${focus.title}](${absolute(focus.href)})` : focus.title;
		lines.push(`- **${title}:** ${focus.detail}`);
	}

	lines.push("", `## ${page.labels.story}`, "");
	for (let paragraph of page.story) lines.push(paragraph, "");

	lines.push(`### ${page.labels.timeline}`, "");
	for (let milestone of page.timeline) {
		lines.push(`- **${milestone.year}: ${milestone.title}.** ${milestone.detail}`);
	}

	lines.push("", `## ${page.labels.values}`, "");
	for (let value of page.values) lines.push(`- **${value.title}:** ${value.detail}`);

	lines.push("", `## ${page.labels.projects}`, "");
	for (let project of page.projects) {
		lines.push(`- [${project.name}](${project.href}) (${project.since}): ${project.description}`);
	}

	lines.push("", `## ${page.labels.connect}`, "", page.labels.connectNote, "");
	for (let invitation of page.connect) {
		lines.push(
			`- **${invitation.title}:** ${invitation.detail} [${invitation.action}](${absolute(invitation.href)})`,
		);
	}

	lines.push("", `## ${page.labels.links}`, "");
	for (let link of page.links) lines.push(`- [${link.label}](${link.href})`);
	lines.push("");

	return lines.join("\n");
}
