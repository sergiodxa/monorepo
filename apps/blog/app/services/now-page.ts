/**
 * The `/now` page: what the author is focused on at this point in his life, kept as one
 * structured document per language. The page renders it designed, and `/now.md` writes the
 * same document out as Markdown, so the two formats can never disagree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PageLocale } from "~/app/services/page-locale";

import EN from "~/resources/content/now/en";
import ES_AR from "~/resources/content/now/es-AR";

/** The page's content and the copy around it, in one language. */
export interface NowPage {
	locale: PageLocale;
	title: string;
	description: string;
	/** The page's heading, said the way a friend would ask. */
	heading: string;
	intro: string;
	/** The day the page was last rewritten, as `YYYY-MM-DD`; every language shares it. */
	updatedAt: string;
	location: string;
	/** The other language's name, written in that language, for the switcher. */
	otherLanguage: { locale: PageLocale; label: string };
	labels: NowPage.Labels;
	sections: ReadonlyArray<NowPage.Section>;
	/** What a now page is, ending in the link to nownownow.com. */
	explainer: NowPage.Explainer;
}

/** Types the now page's sections are written in. */
export namespace NowPage {
	/** Small interface strings around the content. */
	export interface Labels {
		updated: string;
		location: string;
		viewMarkdown: string;
	}

	/** One area of focus, such as work or writing. */
	export interface Section {
		/** The anchor the section answers at, the same in every language. */
		id: string;
		title: string;
		items: ReadonlyArray<Item>;
	}

	/** One thing the author is doing, linked when it lives somewhere a reader can visit. */
	export interface Item {
		title: string;
		href?: string;
		text: string;
	}

	/** The note on what a now page is, with the words that link to nownownow.com. */
	export interface Explainer {
		title: string;
		text: string;
		linkLabel: string;
		href: string;
	}
}

/** Every page by language. */
const PAGES: Record<PageLocale, NowPage> = { en: EN, "es-AR": ES_AR };

/**
 * The page written in `locale`.
 *
 * @param locale The language to read it in.
 * @returns The page.
 */
export function nowPageFor(locale: PageLocale): NowPage {
	return PAGES[locale];
}

/**
 * Writes the day the page was last rewritten the way a reader of its language says it, in
 * UTC so the day never shifts with the server's zone.
 *
 * @param page The page whose date to write.
 * @returns The date, such as "October 26, 2026".
 */
export function nowUpdatedLabel(page: NowPage): string {
	return new Intl.DateTimeFormat(page.locale, {
		day: "numeric",
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	}).format(new Date(`${page.updatedAt}T00:00:00Z`));
}

/**
 * Writes the page as Markdown in the order the page shows it, with the update line first,
 * the way now pages state their freshness. Links are absolute, so the text keeps working
 * when it is read or pasted outside this site.
 *
 * @param page The page to write.
 * @param origin The site's origin, which relative links resolve against.
 * @returns The Markdown document.
 */
export function nowPageMarkdown(page: NowPage, origin: string): string {
	let absolute = (href: string) => new URL(href, origin).href;
	let lines: string[] = [
		`# ${page.heading}`,
		"",
		`_${page.labels.updated} ${nowUpdatedLabel(page)} · ${page.labels.location} ${page.location}_`,
		"",
		page.intro,
		"",
	];

	for (let section of page.sections) {
		lines.push(`## ${section.title}`, "");
		for (let item of section.items) {
			let title = item.href ? `[${item.title}](${absolute(item.href)})` : item.title;
			lines.push(`- **${title}:** ${item.text}`);
		}
		lines.push("");
	}

	let { explainer } = page;
	lines.push(
		`## ${explainer.title}`,
		"",
		`${explainer.text} [${explainer.linkLabel}](${explainer.href}).`,
		"",
	);

	return lines.join("\n");
}
