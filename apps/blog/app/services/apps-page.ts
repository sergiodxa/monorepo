/**
 * The `/apps` showcase: each product the author ships, kept as one structured document per
 * language. The page renders it designed, and `/apps.md` writes the same document as
 * Markdown, so the two formats can never disagree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PageLocale } from "~/app/services/page-locale";

import EN from "~/resources/content/apps/en";
import ES_AR from "~/resources/content/apps/es-AR";

/** The showcase and the copy around it, in one language. */
export interface AppsPage {
	locale: PageLocale;
	title: string;
	description: string;
	/** The H1 a visitor reads first. */
	heading: string;
	/** What the page is, shown under the heading. */
	intro: string;
	/** The other language's name, written in that language, for the switcher. */
	otherLanguage: { locale: PageLocale; label: string };
	labels: AppsPage.Labels;
	apps: ReadonlyArray<AppsPage.App>;
}

/** Types the showcase's entries are written in. */
export namespace AppsPage {
	/** Small interface strings around the list. */
	export interface Labels {
		viewMarkdown: string;
		/** Accessible name for each app's screenshot stage. */
		stages: {
			wakaba: string;
			encore: string;
		};
		/** Pause control on each looping stage (WCAG 2.2.2). */
		pause: string;
	}

	/** One shipped product on the showcase. */
	export interface App {
		id: string;
		name: string;
		href: string;
		/** Where it runs, such as "Web" or "iPhone and iPad". */
		platform: string;
		blurb: string;
		/** Short claims under the pitch, shown as checks beside the media. */
		highlights: ReadonlyArray<string>;
		/** The button that opens the app from its band. */
		cta: string;
	}
}

/** Every page by language. */
const PAGES: Record<PageLocale, AppsPage> = { en: EN, "es-AR": ES_AR };

/**
 * The page written in `locale`.
 *
 * @param locale The language to read it in.
 * @returns The page's content.
 */
export function appsFor(locale: PageLocale): AppsPage {
	return PAGES[locale];
}

/**
 * Writes the showcase as Markdown in the order the page shows it, each app a heading with
 * its platform, pitch and link.
 *
 * @param page The content to write.
 * @returns The Markdown document.
 */
export function appsMarkdown(page: AppsPage): string {
	let lines: string[] = [`# ${page.heading}`, "", page.intro];

	for (let app of page.apps) {
		lines.push("", `## [${app.name}](${app.href})`, "", `_${app.platform}_`, "", app.blurb);
	}

	lines.push("");
	return lines.join("\n");
}
