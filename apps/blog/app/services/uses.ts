/**
 * The `/uses` page: the hardware, editor, stack, apps and services the author works with,
 * kept as one structured document per language. The page renders it designed, and `/uses.md`
 * writes the same document out as Markdown, so the two formats can never disagree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PageLocale } from "~/app/services/page-locale";

import EN from "~/resources/content/uses/en";
import ES_AR from "~/resources/content/uses/es-AR";

/** The list and the copy around it, in one language. */
export interface UsesPage {
	locale: PageLocale;
	title: string;
	description: string;
	/** What the page is and how current it is, shown under the title. */
	intro: string;
	/** When the list was last reviewed, as the page shows it. */
	updated: string;
	/** The other language's name, written in that language, for the switcher. */
	otherLanguage: { locale: PageLocale; label: string };
	labels: UsesPage.Labels;
	sections: ReadonlyArray<UsesPage.Section>;
}

/** Types the page's sections are written in. */
export namespace UsesPage {
	/** Small interface strings around the sections. */
	export interface Labels {
		updated: string;
		viewMarkdown: string;
		contents: string;
	}

	/** A group of items, such as the desk or the editor, anchored on its `id`. */
	export interface Section {
		id: string;
		title: string;
		/** A line under the title saying what ties the items together. */
		note?: string;
		items: ReadonlyArray<Item>;
	}

	/** One thing in use, with a line on why. */
	export interface Item {
		name: string;
		/** Where to learn more about it; an item without one shows as plain text. */
		href?: string;
		note: string;
	}
}

/** Every page by language. */
const PAGES: Record<PageLocale, UsesPage> = { en: EN, "es-AR": ES_AR };

/**
 * The page written in `locale`.
 *
 * @param locale The language to read it in.
 * @returns The page's content.
 */
export function usesFor(locale: PageLocale): UsesPage {
	return PAGES[locale];
}

/**
 * Writes the page as Markdown in the order the page shows it, one list per section, each
 * item linked when it has somewhere to point.
 *
 * @param page The content to write.
 * @returns The Markdown document.
 */
export function usesMarkdown(page: UsesPage): string {
	let lines: string[] = [
		`# ${page.title}`,
		"",
		page.intro,
		"",
		`_${page.labels.updated}: ${page.updated}_`,
	];

	for (let section of page.sections) {
		lines.push("", `## ${section.title}`, "");
		if (section.note) lines.push(section.note, "");
		for (let item of section.items) {
			let name = item.href ? `[${item.name}](${item.href})` : `**${item.name}**`;
			lines.push(`- ${name}: ${item.note}`);
		}
	}

	lines.push("");
	return lines.join("\n");
}
