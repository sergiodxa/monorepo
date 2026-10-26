/**
 * `resume pdf`: writes the résumé's LaTeX source in each language from its structured content,
 * then typesets each with tectonic into `public/resume/`, where the page's download links point.
 * Safe to run twice; the sources and PDFs are rewritten from the same content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import commandset from "~/app/commands";
import { PROJECT_ROOT } from "~/app/initializers/local-database";
import { PAGE_LOCALES } from "~/app/services/page-locale";
import { resumeFor, resumeLatex, texSourcePath } from "~/app/services/resume";
import { PROFILE } from "~/config/profile";

/** Where tectonic writes the PDFs, relative to the project root; `public/` is served as is. */
const PDF_DIRECTORY = "public/resume";

/**
 * Writes every language's source before typesetting any, so a missing tectonic still leaves
 * the sources current; each PDF takes its source's file name.
 */
export default createCommand(commandset.resume.pdf, async (ctx) => {
	let tectonic = ctx.flags.tectonic ?? "tectonic";
	let sources = PAGE_LOCALES.map((locale) => texSourcePath(locale));

	await mkdir(join(PROJECT_ROOT, PDF_DIRECTORY), { recursive: true });
	for (let [index, locale] of PAGE_LOCALES.entries()) {
		let source = join(PROJECT_ROOT, sources[index] ?? "");
		await mkdir(dirname(source), { recursive: true });
		await writeFile(source, resumeLatex(resumeFor(locale), PROFILE.canonical.origin));
		ctx.stdout(`Wrote ${sources[index]}\n`);
	}
	if (ctx.flags.texOnly) return success();

	for (let source of sources) {
		let typeset = await ctx.exec([tectonic, "--outdir", PDF_DIRECTORY, source], {
			cwd: PROJECT_ROOT,
		});
		if (isFailure(typeset)) return typeset;
		ctx.stdout(`Typeset ${source}\n`);
	}
	return success();
});
