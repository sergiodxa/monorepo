/**
 * The shape of every word Encore's pages print, one object per language, so the English,
 * Argentine Spanish and Japanese pages render from the same components and a missing
 * translation fails the type check instead of reaching a reader.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EncoreLocale } from "~/config/encore";
import type { BadgeLanguage } from "~/resources/views/app-pages/app-store-badge";
import type { SupportForm } from "~/resources/views/app-pages/support-form";

/** A title and the sentence under it, the unit most cards and steps are written in. */
export interface CopyItem {
	title: string;
	body: string;
}

/** A band's eyebrow, title and lead. */
export interface CopyBand {
	eyebrow: string;
	title: string;
	description: string;
}

/** One challenge card as the app prints it in this language: its uppercase title and prompt. */
export interface CardText {
	/** Generated challenges carry no title. */
	title?: string;
	prompt: string;
}

/** The cards the pages draw, by the app's own card id. */
export type CardId =
	| "a001"
	| "a002"
	| "a011"
	| "a015"
	| "a033"
	| "a045"
	| "a060"
	| "a080"
	| "a100"
	| "a104"
	| "generated";

/** The screens the pages frame, each still a placeholder until its capture is exported. */
export type ScreenName =
	| "card-back"
	| "challenge"
	| "swipe"
	| "shuffle"
	| "generated"
	| "watch-ready"
	| "watch-challenge";

/** Everything Encore's landing, header and footer print in one language. */
export interface EncoreCopy {
	locale: EncoreLocale;
	/** The language of Apple's App Store badge on these pages. */
	badge: BadgeLanguage;
	/** The language's own name, for the footer's language links. */
	languageName: string;
	meta: { title: string; description: string };
	header: { support: string; privacy: string; navLabel: string };
	footer: {
		tagline: string;
		columns: { encore: string; more: string; elsewhere: string };
		download: string;
		blog: string;
		madeBy: string;
		languages: string;
	};
	/** The badge's alt text, "Download on the App Store". */
	appStore: string;
	hero: {
		eyebrow: string;
		title: string;
		description: string;
		tour: string;
		note: string;
	};
	/** The playable card: a round of the game on the page, dealt from the real deck. */
	play: CopyBand & {
		draw: string;
		shuffle: string;
		sound: string;
		/** Where the reader is in the deck, with `{count}` and `{total}` where the numbers go. */
		left: string;
	};
	tour: CopyBand & { stageLabel: string; steps: [CopyItem, CopyItem, CopyItem, CopyItem] };
	deck: CopyBand & {
		listLabel: string;
		generated: string;
		/** The app's own hint on a face-down card, which names each card the reader can flip. */
		reveal: string;
	};
	cards: Record<CardId, CardText>;
	watch: CopyBand & { items: Array<string> };
	details: CopyBand & {
		items: Record<"karaoke" | "road" | "holiday" | "abroad" | "newYear" | "everyone", CopyItem>;
	};
	privacy: CopyBand & { checks: Array<string>; policy: string };
	faq: { eyebrow: string; title: string; columns: Array<Array<readonly [string, string]>> };
	closing: { title: string; description: string; support: string };
	/** Each screen's alt text, which also names the placeholder that holds its place. */
	screens: Record<ScreenName, string>;
	/** The label on a placeholder, over the screen's name. */
	placeholder: string;
}

/** Every word the privacy and support pages print in one language. */
export interface EncorePagesCopy {
	privacy: { forLine: string; viewMarkdown: string };
	support: SupportForm.Labels & {
		title: string;
		description: string;
		intro: [string, string];
		topics: Record<"Bug report" | "Question" | "Feature request" | "Other", string>;
		platforms: Record<"iPhone" | "iPad" | "Apple Watch" | "Mac" | "Other", string>;
	};
}
