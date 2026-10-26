/**
 * The press kit an event or podcast receives: bios, photos, topics and past appearances, kept
 * as one structured document per language. The page renders it designed, and `/press.md`
 * writes the same document out as Markdown, so the two formats can never disagree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PageLocale } from "~/app/services/page-locale";

import EN from "~/resources/content/press/en";
import ES_AR from "~/resources/content/press/es-AR";

/** The kit's content and the copy around it, in one language. */
export interface PressKit {
	locale: PageLocale;
	title: string;
	description: string;
	/** Who the page is about, said in one sentence under the name. */
	tagline: string;
	/** What the kit offers and that it is free to use. */
	intro: string;
	/** The other language's name, written in that language, for the switcher. */
	otherLanguage: { locale: PageLocale; label: string };
	labels: PressKit.Labels;
	facts: ReadonlyArray<PressKit.Fact>;
	bios: ReadonlyArray<PressKit.Bio>;
	photos: ReadonlyArray<PressKit.Photo>;
	topics: ReadonlyArray<PressKit.Topic>;
	openSource: ReadonlyArray<PressKit.Project>;
	appearances: ReadonlyArray<PressKit.Appearance>;
	formats: ReadonlyArray<PressKit.Format>;
	links: ReadonlyArray<PressKit.Link>;
	contact: PressKit.Contact;
}

/** Types the press kit's sections are written in. */
export namespace PressKit {
	/** Section headings and small interface strings. */
	export interface Labels {
		facts: string;
		bios: string;
		biosNote: string;
		photos: string;
		photosNote: string;
		download: string;
		topics: string;
		openSource: string;
		appearances: string;
		formats: string;
		links: string;
		contact: string;
		viewMarkdown: string;
		copy: string;
		copied: string;
		words: string;
	}

	/** One line of quick facts, such as a name's pronunciation. */
	export interface Fact {
		label: string;
		value: string;
	}

	/** One bio, at one of the lengths organizers ask for. */
	export interface Bio {
		id: "one-line" | "short" | "medium" | "long" | "introduction";
		label: string;
		/** Where this length fits, such as a printed program. */
		use: string;
		text: string;
	}

	/** A photo cleared for event and editorial use, served from this site. */
	export interface Photo {
		src: string;
		alt: string;
		label: string;
		width: number;
		height: number;
		/** What the file is, such as `PNG`. */
		format: string;
	}

	/** A subject the author speaks about, with what a talk on it covers. */
	export interface Topic {
		name: string;
		detail: string;
	}

	/** An open-source project the author maintains or contributes to. */
	export interface Project {
		name: string;
		href: string;
		description: string;
	}

	/** A past talk, interview or podcast, newest first. */
	export interface Appearance {
		title: string;
		event: string;
		/** When it took place, as the page shows it, or `undefined` when unknown. */
		date?: string;
		language: string;
		href: string;
	}

	/** A talk format the author accepts, and on what terms. */
	export interface Format {
		name: string;
		detail: string;
	}

	/** A profile elsewhere. */
	export interface Link {
		label: string;
		href: string;
	}

	/** The contact form's copy, including the message each invalid field shows. */
	export interface Contact {
		intro: string;
		fields: {
			name: string;
			email: string;
			kind: string;
			kindPlaceholder: string;
			event: string;
			eventPlaceholder: string;
			message: string;
			messagePlaceholder: string;
		};
		/** Labels of the request kinds, in the order the validator lists them. */
		kinds: Record<"conference" | "meetup" | "podcast" | "workshop" | "other", string>;
		errors: Record<"name" | "email" | "kind" | "event" | "message", string>;
		submit: string;
		sending: string;
		sent: string;
		sendAnother: string;
		invalid: string;
		failed: string;
		rateLimited: string;
		resubmit: string;
		privacy: string;
	}
}

/** Every kit by language. */
const KITS: Record<PageLocale, PressKit> = { en: EN, "es-AR": ES_AR };

/**
 * The kit written in `locale`.
 *
 * @param locale The language to read it in.
 * @returns The kit.
 */
export function pressKitFor(locale: PageLocale): PressKit {
	return KITS[locale];
}

/**
 * Writes the kit as Markdown in the order the page shows it, with each bio as a quote so a
 * reader copying one never picks up its heading. Photo and project links are absolute, since
 * the text is pasted into forms outside this site.
 *
 * @param kit The kit to write.
 * @param origin The site's origin, which relative photo paths resolve against.
 * @returns The Markdown document.
 */
export function pressKitMarkdown(kit: PressKit, origin: string): string {
	let absolute = (href: string) => new URL(href, origin).href;
	let lines: string[] = [`# ${kit.title}`, "", kit.tagline, "", kit.intro, ""];

	lines.push(`## ${kit.labels.facts}`, "");
	for (let fact of kit.facts) lines.push(`- **${fact.label}:** ${fact.value}`);

	lines.push("", `## ${kit.labels.bios}`, "", kit.labels.biosNote, "");
	for (let bio of kit.bios) {
		lines.push(`### ${bio.label}`, "", `_${bio.use}_`, "");
		for (let paragraph of bio.text.split("\n\n")) lines.push(`> ${paragraph}`, ">");
		lines.pop();
		lines.push("");
	}

	lines.push(`## ${kit.labels.photos}`, "", kit.labels.photosNote, "");
	for (let photo of kit.photos) {
		lines.push(
			`- [${photo.label}](${absolute(photo.src)}): ${photo.width} × ${photo.height} ${photo.format}`,
		);
	}

	lines.push("", `## ${kit.labels.topics}`, "");
	for (let topic of kit.topics) lines.push(`- **${topic.name}:** ${topic.detail}`);

	lines.push("", `## ${kit.labels.openSource}`, "");
	for (let project of kit.openSource) {
		lines.push(`- [${project.name}](${project.href}): ${project.description}`);
	}

	lines.push("", `## ${kit.labels.appearances}`, "");
	for (let item of kit.appearances) {
		let when = item.date ? `, ${item.date}` : "";
		lines.push(`- [${item.title}](${item.href}): ${item.event}${when} (${item.language})`);
	}

	lines.push("", `## ${kit.labels.formats}`, "");
	for (let format of kit.formats) lines.push(`- **${format.name}:** ${format.detail}`);

	lines.push("", `## ${kit.labels.links}`, "");
	for (let link of kit.links) lines.push(`- [${link.label}](${link.href})`);

	lines.push("", `## ${kit.labels.contact}`, "", kit.contact.intro, "");
	lines.push(`[${kit.labels.contact}](${absolute(`/press?lang=${kit.locale}`)}#contact)`, "");

	return lines.join("\n");
}
