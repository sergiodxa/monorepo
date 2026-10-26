/**
 * The résumé's writers: the checked-in LaTeX sources must match what the content generates,
 * so the PDFs never drift from the page, and TeX's special characters must typeset literally.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { PROJECT_ROOT } from "~/app/initializers/local-database";
import { PAGE_LOCALES } from "~/app/services/page-locale";
import { resumeFor, resumeLatex, resumeMarkdown, texSourcePath } from "~/app/services/resume";
import { PROFILE } from "~/config/profile";

describe("resumeLatex", () => {
	test.each(PAGE_LOCALES)("the checked-in %s source matches the content", async (locale) => {
		let checkedIn = await readFile(join(PROJECT_ROOT, texSourcePath(locale)), "utf8");

		expect(checkedIn, "run `sdxc run resume pdf` in apps/blog").toBe(
			resumeLatex(resumeFor(locale), PROFILE.canonical.origin),
		);
	});

	test("escapes TeX's special characters in prose and URLs", () => {
		let resume = resumeFor("en");
		let source = resumeLatex(
			{
				...resume,
				summary: "50% of R&D at #1, costing $5_000 {approx}",
				speaking: [{ title: "Talk", event: "Event", date: "2026", href: "https://a.com/x#y" }],
			},
			"https://sergiodxa.com",
		);

		expect(source).toContain("50\\% of R\\&D at \\#1, costing \\$5\\_000 \\{approx\\}");
		expect(source).toContain("\\href{https://a.com/x\\#y}{Talk}");
	});
});

describe("resumeMarkdown", () => {
	test("lists every role with its dates", () => {
		let body = resumeMarkdown(resumeFor("en"), "https://sergiodxa.com");

		expect(body).toMatch(/^# Sergio Xalambrí\n/);
		expect(body).toContain("### Support Engineer, [ZEIT](https://vercel.com) (now Vercel)");
		expect(body).toContain("_2015 – 2017_");
	});

	test("links the PDF absolutely only once it is published", () => {
		let resume = resumeFor("en");
		let link = "[Download PDF](https://sergiodxa.com/resume/sergio-xalambri-resume-en.pdf)";
		let unpublished = { ...resume, pdf: { ...resume.pdf, published: false } };
		let published = { ...resume, pdf: { ...resume.pdf, published: true } };

		expect(resumeMarkdown(unpublished, "https://sergiodxa.com")).not.toContain(link);
		expect(resumeMarkdown(published, "https://sergiodxa.com")).toContain(link);
	});
});
