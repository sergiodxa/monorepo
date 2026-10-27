/**
 * The résumé's writers: each language typesets to one page carrying its text, links and
 * metadata, the checked-in PDFs match what the content typesets, and the Markdown lists every
 * role and links the PDF.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { PROJECT_ROOT } from "~/app/initializers/local-database";
import { PAGE_LOCALES } from "~/app/services/page-locale";
import { RESUME_FONT_PATHS, resumeFor, resumeMarkdown, resumePdf } from "~/app/services/resume";
import { readPdf } from "~/app/test/pdf";
import { PROFILE } from "~/config/profile";

/** The checked-in faces the command typesets with. */
async function fonts() {
	return {
		regular: new Uint8Array(await readFile(join(PROJECT_ROOT, RESUME_FONT_PATHS.regular))),
		bold: new Uint8Array(await readFile(join(PROJECT_ROOT, RESUME_FONT_PATHS.bold))),
	};
}

describe("resumePdf", () => {
	test.each(PAGE_LOCALES)("typesets the %s résumé on one page", async (locale) => {
		let resume = resumeFor(locale);
		let pdf = await resumePdf(resume, await fonts(), PROFILE.canonical.origin);
		if (isFailure(pdf)) throw pdf.error;
		let read = await readPdf(pdf.data);

		expect(read.pages).toBe(1);
		expect(read.title).toBe(`Sergio Xalambrí — ${resume.title}`);
		expect(read.author).toBe("Sergio Xalambrí");
		expect(read.lang).toBe(locale);
		expect(read.text).toContain("Sergio Xalambrí");
		expect(read.text).toContain(`${resume.headline} · ${resume.location}`);
		expect(read.text).toContain(resume.labels.experience);
		expect(read.text).toContain(resume.labels.metricsNote);
		expect(read.text).toContain(`sergiodxa.com/resume?lang=${locale}`);
		for (let role of resume.experience) expect(read.text).toContain(role.role);
		let hrefs = [
			...resume.contact.map((item) => item.href),
			...resume.experience.map((role) => role.href),
			...resume.openSource.map((project) => project.href),
			...resume.speaking.map((talk) => talk.href),
			`https://sergiodxa.com/resume?lang=${locale}`,
		];
		expect(read.links).toEqual(hrefs.map((href) => new URL(href).href));
	});

	test.each(PAGE_LOCALES)("the checked-in %s PDF matches the content", async (locale) => {
		let resume = resumeFor(locale);
		let pdf = await resumePdf(resume, await fonts(), PROFILE.canonical.origin);
		if (isFailure(pdf)) throw pdf.error;
		let checkedIn = await readFile(join(PROJECT_ROOT, "public", resume.pdf.href));

		expect(
			await readPdf(new Uint8Array(checkedIn)),
			"run `sdxc run resume pdf` in apps/blog",
		).toEqual(await readPdf(pdf.data));
	});

	test("fails when the content outgrows the page", async () => {
		let resume = resumeFor("en");
		let long = { ...resume, experience: [...resume.experience, ...resume.experience] };

		let pdf = await resumePdf(long, await fonts(), PROFILE.canonical.origin);

		expect(isFailure(pdf)).toBe(true);
	});
});

describe("resumeMarkdown", () => {
	test("lists every role with its dates", () => {
		let body = resumeMarkdown(resumeFor("en"), "https://sergiodxa.com");

		expect(body).toMatch(/^# Sergio Xalambrí\n/);
		expect(body).toContain("### Support Engineer, [ZEIT](https://vercel.com) (now Vercel)");
		expect(body).toContain("_2015 – 2017_");
	});

	test("links the PDF absolutely", () => {
		let body = resumeMarkdown(resumeFor("en"), "https://sergiodxa.com");

		expect(body).toContain(
			"[Download PDF](https://sergiodxa.com/resume/sergio-xalambri-resume-en.pdf)",
		);
	});
});
