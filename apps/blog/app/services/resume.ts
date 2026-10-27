/**
 * The author's résumé, kept as one structured document per language. The page renders it
 * designed, `/resume.md` writes it as Markdown, and `resumePdf` typesets it as the one-page PDF,
 * so the three formats can never disagree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { PDF } from "@sdxc/pdf";
import { failure, isFailure, success } from "@sdxc/result";

import type { PageLocale } from "~/app/services/page-locale";

import EN from "~/resources/content/resume/en";
import ES_AR from "~/resources/content/resume/es-AR";

/** The résumé's content and the copy around it, in one language. */
export interface Resume {
	locale: PageLocale;
	title: string;
	description: string;
	name: string;
	headline: string;
	location: string;
	/** Who the author is and what he is best at, in two or three sentences. */
	summary: string;
	/** The other language's name, written in that language, for the switcher. */
	otherLanguage: { locale: PageLocale; label: string };
	labels: Resume.Labels;
	contact: ReadonlyArray<Resume.Contact>;
	experience: ReadonlyArray<Resume.Role>;
	openSource: ReadonlyArray<Resume.Project>;
	speaking: ReadonlyArray<Resume.Talk>;
	skills: ReadonlyArray<Resume.SkillGroup>;
	education: ReadonlyArray<Resume.Entry>;
	languages: ReadonlyArray<Resume.Language>;
	/** The typeset PDF in this language, written to `public/` by `sdxc run resume pdf`. */
	pdf: { href: string; filename: string };
}

/** Types the résumé's sections are written in. */
export namespace Resume {
	/** Section headings and small interface strings. */
	export interface Labels {
		experience: string;
		openSource: string;
		speaking: string;
		skills: string;
		education: string;
		languages: string;
		present: string;
		downloadPdf: string;
		viewMarkdown: string;
		contact: string;
		/** When the open-source figures were read, since downloads and stars keep changing. */
		metricsNote: string;
		/** Introduces the page's address at the foot of the PDF, which is always current. */
		latestVersion: string;
	}

	/** A way to reach the author, as the page prints it. */
	export interface Contact {
		label: string;
		text: string;
		href: string;
	}

	/** One position, newest first, with what it achieved rather than what it involved. */
	export interface Role {
		company: string;
		href: string;
		/** The company's earlier name, when the author joined it under that name. */
		formerly?: string;
		role: string;
		start: string;
		/** `undefined` while the author still holds the position. */
		end?: string;
		highlights: ReadonlyArray<string>;
	}

	/** An open-source project, with a figure that shows its reach when one exists. */
	export interface Project {
		name: string;
		href: string;
		detail: string;
		metric?: string;
	}

	/** A conference talk, newest first. */
	export interface Talk {
		title: string;
		event: string;
		date: string;
		href: string;
	}

	/** Skills of one kind, written as one comma-separated line. */
	export interface SkillGroup {
		label: string;
		items: string;
	}

	/** A line of education. */
	export interface Entry {
		title: string;
		detail: string;
	}

	/** A spoken language and how well the author speaks it. */
	export interface Language {
		name: string;
		level: string;
	}
}

/** Every résumé by language. */
const RESUMES: Record<PageLocale, Resume> = { en: EN, "es-AR": ES_AR };

/**
 * The résumé written in `locale`.
 *
 * @param locale The language to read it in.
 * @returns The résumé.
 */
export function resumeFor(locale: PageLocale): Resume {
	return RESUMES[locale];
}

/**
 * A role's dates as one range, with the localized word for an open end.
 *
 * @param role The position.
 * @param present What an ongoing position ends in, such as "Present".
 * @returns The range, such as "2015 – 2017".
 */
export function period(role: Resume.Role, present: string): string {
	return `${role.start} – ${role.end ?? present}`;
}

/**
 * Writes the résumé as Markdown in the order the page shows it. Links are absolute, since the
 * text is pasted into application forms outside this site.
 *
 * @param resume The résumé to write.
 * @param origin The site's origin, which the PDF's path resolves against.
 * @returns The Markdown document.
 */
export function resumeMarkdown(resume: Resume, origin: string): string {
	let { labels } = resume;
	let lines: string[] = [`# ${resume.name}`, "", `${resume.headline} · ${resume.location}`, ""];

	lines.push(resume.contact.map((item) => `[${item.text}](${item.href})`).join(" · "), "");
	lines.push(`[${labels.downloadPdf}](${new URL(resume.pdf.href, origin).href})`, "");
	lines.push(resume.summary, "");

	lines.push(`## ${labels.experience}`, "");
	for (let role of resume.experience) {
		let formerly = role.formerly ? ` (${role.formerly})` : "";
		lines.push(`### ${role.role}, [${role.company}](${role.href})${formerly}`, "");
		lines.push(`_${period(role, labels.present)}_`, "");
		for (let highlight of role.highlights) lines.push(`- ${highlight}`);
		lines.push("");
	}

	lines.push(`## ${labels.openSource}`, "");
	for (let project of resume.openSource) {
		let metric = project.metric ? ` (${project.metric})` : "";
		lines.push(`- [${project.name}](${project.href}): ${project.detail}${metric}`);
	}
	lines.push("", `_${labels.metricsNote}_`, "");

	lines.push(`## ${labels.speaking}`, "");
	for (let talk of resume.speaking) {
		lines.push(`- [${talk.title}](${talk.href}): ${talk.event}, ${talk.date}`);
	}

	lines.push("", `## ${labels.skills}`, "");
	for (let group of resume.skills) lines.push(`- **${group.label}:** ${group.items}`);

	lines.push("", `## ${labels.education}`, "");
	for (let entry of resume.education) lines.push(`- **${entry.title}:** ${entry.detail}`);

	lines.push("", `## ${labels.languages}`, "");
	for (let language of resume.languages) lines.push(`- **${language.name}:** ${language.level}`);
	lines.push("");

	return lines.join("\n");
}

/** The résumé's two faces as `.ttf` bytes: the roman text and the bold extended headings. */
export interface ResumeFonts {
	regular: Uint8Array;
	bold: Uint8Array;
}

/**
 * Where the CMU Serif faces the PDF embeds are checked in, relative to the app's root: the
 * Computer Modern design LaTeX typesets with, as TrueType under the SIL Open Font License.
 */
export const RESUME_FONT_PATHS: Record<keyof ResumeFonts, string> = {
	regular: "resources/fonts/cmu-serif/cmunrm.ttf",
	bold: "resources/fonts/cmu-serif/cmunbx.ttf",
};

/** The page margin on every side, 0.55in in points. */
const MARGIN = 39.6;
/** The width of the text block on a US Letter page. */
const TEXT_WIDTH = 612 - 2 * MARGIN;
/** The baseline of the last line on the page, where the footnote sits. */
const BOTTOM_BASELINE = 792 - MARGIN;
/**
 * Text size of the body, the section headings, the name, the contact line and the footnote.
 * The body is 9.5pt rather than LaTeX's 10pt so the Spanish résumé, the longer one, fits a page.
 */
const SIZE = { body: 9.5, section: 12, name: 17.28, small: 8.5, footnote: 8 } as const;
/** Lines sit 1.2 times their text size apart, as LaTeX sets them. */
const LINE_HEIGHT = 1.2;
/** Points between baselines of body text. */
const LEADING = SIZE.body * LINE_HEIGHT;
/** The color of dates, earlier company names, figures and the footnote. */
const MUTED = "#595959";
/** How far bulleted text is indented, and where the bullet's right edge sits. */
const LIST_INDENT = 11;
const BULLET_EDGE = 6;
/** The smallest gap between a line's text and the date set flush right on it. */
const DATE_GAP = 12;

/**
 * Vertical spacing between elements, in points beyond one line of leading: before and after a
 * section heading, around a list, and between its items.
 */
const SPACE = { sectionBefore: 6, sectionAfter: 3, listAround: 2, itemSep: 1 } as const;

/** The page being set and the baseline of its last line, which the next element counts from. */
interface Sheet {
	pdf: PDF;
	page: PDF.Page;
	regular: PDF.Font;
	bold: PDF.Font;
	baseline: number;
}

/** Where a block of text goes and how it is set. */
interface Block {
	/** Points from the previous baseline to this block's first. */
	gap: number;
	/** Left indent within the text block. */
	indent?: number;
	/** Width taken from the right, for a date set flush right on the first line. */
	reserve?: number;
	size?: number;
	color?: PDF.Color;
	align?: "left" | "center" | "justify";
}

/**
 * Typesets the résumé on one US Letter page, the format most applicant tracking systems parse:
 * one column, no images, real text with live links, and the footnote pinned to the page's foot.
 * The same résumé and fonts always produce the same bytes.
 *
 * @param resume The résumé to typeset.
 * @param fonts The regular and bold faces to embed.
 * @param origin The site's origin, which the footnote's link to the page resolves against.
 * @returns The PDF, or a failure when a font cannot be embedded or the content outgrows a page.
 */
export async function resumePdf(
	resume: Resume,
	fonts: ResumeFonts,
	origin: string,
): Promise<Result<Uint8Array, Error>> {
	let pdf = new PDF({
		size: "letter",
		title: `${resume.name} — ${resume.title}`,
		author: resume.name,
		lang: resume.locale,
	});
	let regular = pdf.font(fonts.regular);
	if (isFailure(regular)) return regular;
	let bold = pdf.font(fonts.bold);
	if (isFailure(bold)) return bold;

	let sheet: Sheet = { pdf, page: pdf.page(), regular: regular.data, bold: bold.data, baseline: 0 };
	setHeader(sheet, resume);
	setExperience(sheet, resume);
	setOpenSource(sheet, resume);
	setSpeaking(sheet, resume);
	setSkills(sheet, resume);
	let footnote = layFootnote(sheet, resume, origin);
	let footnoteBaseline = BOTTOM_BASELINE - baselineSpan(footnote);
	if (sheet.baseline + LEADING > footnoteBaseline) {
		return failure(new Error(`The ${resume.locale} résumé runs past one page`));
	}
	place(sheet, footnote, 0, footnoteBaseline - sheet.baseline);
	return success(await pdf.bytes());
}

/**
 * Draws a laid-out paragraph with its first baseline `gap` below the sheet's, and moves the
 * sheet's baseline to the paragraph's last line.
 *
 * @returns The baseline of the paragraph's first line, which a flush-right date shares.
 */
function place(sheet: Sheet, paragraph: PDF.Paragraph, indent: number, gap: number): number {
	let first = paragraph.lines[0];
	let last = paragraph.lines.at(-1);
	if (!first || !last) return sheet.baseline;
	let baseline = sheet.baseline + gap;
	let top = baseline - first.baseline;
	sheet.page.paragraph(paragraph, { x: MARGIN + indent, y: top });
	sheet.baseline = top + last.y + last.baseline;
	return baseline;
}

/** Points from a paragraph's first baseline to its last. */
function baselineSpan(paragraph: PDF.Paragraph): number {
	let first = paragraph.lines[0];
	let last = paragraph.lines.at(-1);
	if (!first || !last) return 0;
	return last.y + last.baseline - (first.y + first.baseline);
}

/**
 * Wraps runs into the text block and places them as `block` says.
 *
 * @returns The baseline of the first line.
 */
function setRuns(sheet: Sheet, runs: PDF.Run[], block: Block): number {
	let indent = block.indent ?? 0;
	let paragraph = sheet.pdf.paragraph(runs, {
		width: TEXT_WIDTH - indent - (block.reserve ?? 0),
		font: sheet.regular,
		size: block.size ?? SIZE.body,
		color: block.color,
		lineHeight: LINE_HEIGHT,
		align: block.align ?? "justify",
	});
	return place(sheet, paragraph, indent, block.gap);
}

/** Draws one line of text with its baseline at `baseline`. */
function setLine(
	sheet: Sheet,
	text: string,
	options: {
		x: number;
		baseline: number;
		font: PDF.Font;
		size: number;
		color?: PDF.Color;
		align?: "left" | "center" | "right";
	},
): void {
	sheet.page.text(text, { ...options, y: options.baseline - options.font.ascent(options.size) });
}

/** The centered name, headline and contact links, then the summary. */
function setHeader(sheet: Sheet, resume: Resume): void {
	let center = MARGIN + TEXT_WIDTH / 2;
	sheet.baseline = MARGIN + 12;
	setLine(sheet, resume.name, {
		x: center,
		baseline: sheet.baseline,
		font: sheet.bold,
		size: SIZE.name,
		align: "center",
	});
	sheet.baseline += LEADING + 3;
	setLine(sheet, `${resume.headline} · ${resume.location}`, {
		x: center,
		baseline: sheet.baseline,
		font: sheet.regular,
		size: SIZE.body,
		align: "center",
	});
	let contact = resume.contact.flatMap((item, index): PDF.Run[] => [
		...(index === 0 ? [] : [{ text: " · " }]),
		{ text: item.text, href: item.href },
	]);
	setRuns(sheet, contact, { gap: LEADING + 2, size: SIZE.small, align: "center" });
	setRuns(sheet, [{ text: resume.summary }], { gap: LEADING + 8 });
}

/**
 * A section heading in large bold with a rule under it. The rule's baseline becomes the
 * sheet's, so the section's first line follows at `LEADING + SPACE.sectionAfter`.
 */
function setSection(sheet: Sheet, title: string): void {
	sheet.baseline += SPACE.sectionBefore + SIZE.section * LINE_HEIGHT;
	setLine(sheet, title, {
		x: MARGIN,
		baseline: sheet.baseline,
		font: sheet.bold,
		size: SIZE.section,
	});
	sheet.baseline += 8;
	sheet.page.line({
		from: [MARGIN, sheet.baseline - 0.2],
		to: [MARGIN + TEXT_WIDTH, sheet.baseline - 0.2],
		width: 0.4,
	});
}

/** A muted date set flush right on the line whose baseline is `baseline`. */
function setDate(sheet: Sheet, date: string, baseline: number): void {
	setLine(sheet, date, {
		x: MARGIN + TEXT_WIDTH,
		baseline,
		font: sheet.regular,
		size: SIZE.body,
		color: MUTED,
		align: "right",
	});
}

/** The room a flush-right date takes from the line it sits on. */
function dateReserve(sheet: Sheet, date: string): number {
	return sheet.regular.measure(date, SIZE.body) + DATE_GAP;
}

/**
 * A bulleted list item; the first item of a list sits `SPACE.listAround` below the line
 * before it and the rest `SPACE.itemSep` below the previous item.
 *
 * @returns The baseline of the item's first line.
 */
function setItem(sheet: Sheet, runs: PDF.Run[], first: boolean, reserve = 0): number {
	let gap = LEADING + (first ? SPACE.listAround : SPACE.itemSep);
	let baseline = setRuns(sheet, runs, { gap, indent: LIST_INDENT, reserve });
	setLine(sheet, "•", {
		x: MARGIN + BULLET_EDGE,
		baseline,
		font: sheet.regular,
		size: SIZE.body,
		align: "right",
	});
	return baseline;
}

/** Each role's line, with its dates flush right, and its highlights as a list. */
function setExperience(sheet: Sheet, resume: Resume): void {
	setSection(sheet, resume.labels.experience);
	for (let [index, role] of resume.experience.entries()) {
		let date = period(role, resume.labels.present);
		let runs: PDF.Run[] = [
			{ text: role.role, font: sheet.bold },
			{ text: ", " },
			{ text: role.company, href: role.href },
		];
		if (role.formerly) runs.push({ text: ` (${role.formerly})`, color: MUTED });
		let gap = LEADING + (index === 0 ? SPACE.sectionAfter : SPACE.listAround);
		let baseline = setRuns(sheet, runs, { gap, reserve: dateReserve(sheet, date), align: "left" });
		setDate(sheet, date, baseline);
		for (let [item, highlight] of role.highlights.entries()) {
			setItem(sheet, [{ text: highlight }], item === 0);
		}
	}
}

/** Each project as a list item: its linked name in bold, what it does, and its reach. */
function setOpenSource(sheet: Sheet, resume: Resume): void {
	setSection(sheet, resume.labels.openSource);
	for (let [index, project] of resume.openSource.entries()) {
		let runs: PDF.Run[] = [
			{ text: project.name, href: project.href, font: sheet.bold },
			{ text: `: ${project.detail}` },
		];
		if (project.metric) runs.push({ text: ` (${project.metric})`, color: MUTED });
		setItem(sheet, runs, index === 0);
	}
}

/** Each talk as a list item, linked, with its date flush right. */
function setSpeaking(sheet: Sheet, resume: Resume): void {
	setSection(sheet, resume.labels.speaking);
	for (let [index, talk] of resume.speaking.entries()) {
		let runs: PDF.Run[] = [{ text: talk.title, href: talk.href }, { text: `, ${talk.event}` }];
		let baseline = setItem(sheet, runs, index === 0, dateReserve(sheet, talk.date));
		setDate(sheet, talk.date, baseline);
	}
}

/** Skills, education and languages, each a line led by its label in bold. */
function setSkills(sheet: Sheet, resume: Resume): void {
	let { labels } = resume;
	setSection(sheet, labels.skills);
	for (let [index, group] of resume.skills.entries()) {
		setLabeled(sheet, group.label, group.items, index === 0);
	}
	setSection(sheet, `${labels.education} · ${labels.languages}`);
	for (let [index, entry] of resume.education.entries()) {
		setLabeled(sheet, entry.title, entry.detail, index === 0);
	}
	let languages = resume.languages.map((item) => `${item.name} (${item.level})`).join(", ");
	setLabeled(sheet, labels.languages, languages, resume.education.length === 0);
}

/** One line led by a bold label, the first of a section `SPACE.sectionAfter` below its rule. */
function setLabeled(sheet: Sheet, label: string, text: string, first: boolean): void {
	let gap = LEADING + (first ? SPACE.sectionAfter : 0);
	setRuns(sheet, [{ text: `${label}:`, font: sheet.bold }, { text: ` ${text}` }], { gap });
}

/**
 * The muted footnote: when the figures were read, and a link to the page, which always holds
 * the latest version.
 */
function layFootnote(sheet: Sheet, resume: Resume, origin: string): PDF.Paragraph {
	let page = new URL(`/resume?lang=${resume.locale}`, origin).href;
	let { labels } = resume;
	return sheet.pdf.paragraph(
		[
			{ text: `${labels.metricsNote} ${labels.latestVersion} ` },
			{ text: page.replace(/^https:\/\//, ""), href: page },
		],
		{ width: TEXT_WIDTH, font: sheet.regular, size: SIZE.footnote, color: MUTED, align: "justify" },
	);
}
