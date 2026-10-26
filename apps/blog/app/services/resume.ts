/**
 * The author's résumé, kept as one structured document per language. The page renders it
 * designed, `/resume.md` writes it as Markdown, and `resumeLatex` typesets it for the PDF, so
 * the three formats can never disagree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
	/** The typeset PDF in this language, served from `public/` once `published`. */
	pdf: { href: string; filename: string; published: boolean };
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
	if (resume.pdf.published) {
		lines.push(`[${labels.downloadPdf}](${new URL(resume.pdf.href, origin).href})`, "");
	}
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

/**
 * Where a language's LaTeX source is checked in, relative to the app's root; tectonic names the
 * PDF after it, so it matches the file the page links to.
 *
 * @param locale The résumé's language.
 * @returns The `.tex` path.
 */
export function texSourcePath(locale: PageLocale): string {
	return `resources/content/resume/latex/${resumeFor(locale).pdf.filename.replace(/\.pdf$/, ".tex")}`;
}

/** Characters TeX reads as commands, each with the text that typesets it literally. */
const TEX_ESCAPES: Record<string, string> = {
	"\\": "\\textbackslash{}",
	"&": "\\&",
	"%": "\\%",
	$: "\\$",
	"#": "\\#",
	_: "\\_",
	"{": "\\{",
	"}": "\\}",
	"~": "\\textasciitilde{}",
	"^": "\\textasciicircum{}",
};

/** Escapes prose for TeX, so a résumé string typesets exactly as written. */
function tex(value: string): string {
	return value.replace(/[\\&%$#_{}~^]/g, (char) => TEX_ESCAPES[char] ?? char);
}

/** Escapes a URL for `\href`, which reads `#` and `%` as TeX even inside its argument. */
function texUrl(href: string): string {
	return href.replace(/[#%]/g, (char) => `\\${char}`);
}

/** A link in TeX, its visible text escaped as prose. */
function texLink(href: string, text: string): string {
	return `\\href{${texUrl(href)}}{${tex(text)}}`;
}

/**
 * Typesets the résumé as a XeTeX document sized for one US Letter page, the format most
 * applicant tracking systems parse: one column, no images, real text with live links.
 *
 * @param resume The résumé to typeset.
 * @param origin The site's origin, which the page's own links resolve against.
 * @returns The `.tex` source.
 */
export function resumeLatex(resume: Resume, origin: string): string {
	let { labels } = resume;
	let page = new URL(`/resume?lang=${resume.locale}`, origin).href;
	let lines: string[] = [
		"% Generated from the résumé's structured content by `sdxc run resume pdf`; edit the",
		"% content in resources/content/resume/ and regenerate rather than editing this file.",
		"\\documentclass[10pt,letterpaper]{article}",
		"\\usepackage[margin=0.55in]{geometry}",
		"\\usepackage{fontspec}",
		"\\usepackage{xcolor}",
		"\\usepackage{enumitem}",
		"\\usepackage{titlesec}",
		"\\usepackage[hidelinks]{hyperref}",
		`\\hypersetup{pdftitle={${tex(`${resume.name} — ${resume.title}`)}},pdfauthor={${tex(resume.name)}},pdflang={${resume.locale}}}`,
		"\\definecolor{muted}{gray}{0.35}",
		"\\pagestyle{empty}",
		"\\setlength{\\parindent}{0pt}",
		"\\titleformat{\\section}{\\large\\bfseries}{}{0em}{}[\\vspace{-4pt}\\rule{\\linewidth}{0.4pt}]",
		"\\titlespacing*{\\section}{0pt}{9pt}{4pt}",
		"\\setlist[itemize]{leftmargin=1.1em,itemsep=1pt,topsep=2pt,parsep=0pt}",
		"\\begin{document}",
		"",
		"\\begin{center}",
		`{\\LARGE\\bfseries ${tex(resume.name)}}\\\\[3pt]`,
		`${tex(resume.headline)} · ${tex(resume.location)}\\\\[2pt]`,
		`{\\small ${resume.contact.map((item) => texLink(item.href, item.text)).join(" · ")}}`,
		"\\end{center}",
		"",
		tex(resume.summary),
		"",
		`\\section*{${tex(labels.experience)}}`,
	];

	for (let role of resume.experience) {
		let formerly = role.formerly ? ` {\\color{muted}(${tex(role.formerly)})}` : "";
		lines.push(
			`\\textbf{${tex(role.role)}}, ${texLink(role.href, role.company)}${formerly} \\hfill {\\color{muted}${tex(period(role, labels.present))}}`,
			"\\begin{itemize}",
			...role.highlights.map((highlight) => `\\item ${tex(highlight)}`),
			"\\end{itemize}",
			"",
		);
	}

	lines.push(`\\section*{${tex(labels.openSource)}}`, "\\begin{itemize}");
	for (let project of resume.openSource) {
		let metric = project.metric ? ` {\\color{muted}(${tex(project.metric)})}` : "";
		lines.push(
			`\\item \\textbf{${texLink(project.href, project.name)}}: ${tex(project.detail)}${metric}`,
		);
	}
	lines.push("\\end{itemize}", "");

	lines.push(`\\section*{${tex(labels.speaking)}}`, "\\begin{itemize}");
	for (let talk of resume.speaking) {
		lines.push(
			`\\item ${texLink(talk.href, talk.title)}, ${tex(talk.event)} \\hfill {\\color{muted}${tex(talk.date)}}`,
		);
	}
	lines.push("\\end{itemize}", "");

	lines.push(`\\section*{${tex(labels.skills)}}`);
	for (let group of resume.skills) {
		lines.push(`\\textbf{${tex(group.label)}:} ${tex(group.items)}\\\\`);
	}

	let education = resume.education.map(
		(entry) => `\\textbf{${tex(entry.title)}:} ${tex(entry.detail)}`,
	);
	let languages = resume.languages
		.map((item) => `${tex(item.name)} (${tex(item.level)})`)
		.join(", ");
	lines.push(
		"",
		`\\section*{${tex(labels.education)} · ${tex(labels.languages)}}`,
		...education.map((entry) => `${entry}\\\\`),
		`\\textbf{${tex(labels.languages)}:} ${languages}`,
		"",
		"\\vfill",
		`{\\footnotesize\\color{muted}${tex(labels.metricsNote)} ${tex(labels.latestVersion)} ${texLink(page, page.replace(/^https:\/\//, ""))}}`,
		"\\end{document}",
		"",
	);

	return lines.join("\n");
}
