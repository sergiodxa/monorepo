/**
 * `resume pdf`: typesets the résumé in each language from its structured content with the
 * checked-in CMU Serif faces, writing each PDF to `public/resume/`, where the page's download
 * links point. The output depends only on the content, so a rerun rewrites identical files.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import commandset from "~/app/commands";
import { PROJECT_ROOT } from "~/app/initializers/local-database";
import { PAGE_LOCALES } from "~/app/services/page-locale";
import { RESUME_FONT_PATHS, resumeFor, resumePdf } from "~/app/services/resume";
import { PROFILE } from "~/config/profile";

/** Where the PDFs go by default, relative to the project root; `public/` is served as is. */
const PDF_DIRECTORY = "public/resume";

/** Fails before writing anything when a language's résumé outgrows its page; `--out` writes elsewhere. */
export default createCommand(commandset.resume.pdf, async (ctx) => {
	let fonts = {
		regular: new Uint8Array(await readFile(join(PROJECT_ROOT, RESUME_FONT_PATHS.regular))),
		bold: new Uint8Array(await readFile(join(PROJECT_ROOT, RESUME_FONT_PATHS.bold))),
	};
	let directory = ctx.flags.out ?? PDF_DIRECTORY;
	let files: Array<{ path: string; bytes: Uint8Array }> = [];
	for (let locale of PAGE_LOCALES) {
		let resume = resumeFor(locale);
		let pdf = await resumePdf(resume, fonts, PROFILE.canonical.origin);
		if (isFailure(pdf)) return pdf;
		files.push({ path: join(directory, resume.pdf.filename), bytes: pdf.data });
	}

	await mkdir(resolve(PROJECT_ROOT, directory), { recursive: true });
	for (let file of files) {
		await writeFile(resolve(PROJECT_ROOT, file.path), file.bytes);
		ctx.stdout(`Wrote ${file.path}\n`);
	}
	return success();
});
