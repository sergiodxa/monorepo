/**
 * The shape of every word Wakaba's pages print, one object per language, so the English and
 * Spanish pages render from the same components and a missing translation fails the type
 * check instead of reaching a reader.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import type { PageLocale } from "~/app/services/page-locale";

/** A title and the sentence under it, the unit most cards and steps are written in. */
export interface CopyItem {
	title: string;
	body: string;
}

/** A band's eyebrow, title and lead. */
export interface CopyBand {
	eyebrow: string;
	title: string;
	description: RemixNode;
}

/** The screenshots the pages frame, by name, each with the alt text of its capture. */
export type ScreenAlts = Record<
	| "path-kitsune"
	| "flashcards-fish"
	| "practice"
	| "flashcards-water"
	| "conjugations"
	| "level-exam-path"
	| "listening"
	| "speaking"
	| "build-sentence"
	| "conjugation-practice"
	| "oni-correction"
	| "kana-tracing"
	| "stroke-guide"
	| "new-word"
	| "practice-feedback"
	| "oni-mistakes"
	| "widget-progress"
	| "widget-word",
	string
>;

/** Everything Wakaba's landing, header and footer print in one language. */
export interface WakabaCopy {
	locale: PageLocale;
	/** The folder of the captures shot in this language, under `screenshots/` and `widgets/`. */
	captures: "en" | "es";
	meta: { title: string; description: string; socialCard: string; socialCardAlt: string };
	header: { support: string; privacy: string; navLabel: string };
	footer: {
		tagline: string;
		columns: { wakaba: string; more: string; elsewhere: string };
		download: string;
		blog: string;
		madeBy: string;
	};
	appStore: { soon: string; available: string };
	hero: {
		eyebrow: string;
		title: RemixNode;
		description: RemixNode;
		watch: string;
		note: string;
		pause: string;
		/** The cards drifting beside the phones, drawn from the app's two widgets. */
		streak: { title: string; detail: string };
		word: { label: string; reading: string };
	};
	path: CopyBand & { stageLabel: string; steps: [CopyItem, CopyItem, CopyItem, CopyItem] };
	companions: CopyBand & {
		roles: Record<"kitsune" | "oni" | "tanuki" | "tengu", CopyItem & { alt: string }>;
	};
	flashcards: CopyBand & { items: Array<string> };
	exercises: CopyBand & {
		listLabel: string;
		items: [CopyItem, CopyItem, CopyItem, CopyItem, CopyItem];
	};
	writing: CopyBand & { items: Array<string> };
	details: CopyBand & {
		items: Record<
			"kanji-index" | "particle" | "phrases" | "practice-reminder" | "languages" | "add-word",
			CopyItem & { alt: string }
		>;
	};
	bonsai: CopyBand & {
		pause: string;
		grownAlt: string;
		timeline: string;
		weekend: {
			title: string;
			body: string;
			days: [string, string];
			rows: { day: string; streak: string; practised: string; bonsai: string };
			streaks: [string, string];
			stage: string;
		};
	};
	widgets: CopyBand & {
		progress: CopyItem & { sizes: string };
		word: CopyItem & { sizes: string };
	};
	privacy: CopyBand & { checks: Array<string> };
	faq: { eyebrow: string; title: string; columns: Array<Array<readonly [string, string]>> };
	closing: { title: string; description: string; support: string };
	screens: ScreenAlts;
}
