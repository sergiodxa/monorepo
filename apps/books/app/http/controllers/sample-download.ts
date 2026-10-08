/**
 * Serves the sample chapter as an EPUB to a reader holding a link the unlocked sample page
 * minted. The link is the gate: an expired, altered or missing one is sent back to the form,
 * where giving the address again mints a fresh link.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { CHAPTER_FILE, readSampleEpub } from "~/app/lib/sample-chapter";
import { verifySampleLink } from "~/app/lib/sample-link";
import routes from "~/routes/web";

/** The name a browser saves the file under. */
const FILENAME = "oauth2-handbook-sample.epub";

/**
 * GET /sample/download — the EPUB for a valid link, or a 303 to the form. A file that fails
 * to build is a fault in the bundled chapter, so it is logged with the file to open and the
 * reader is sent to the form, which still unlocks the chapter as a page.
 */
export const sampleDownload = createAction(routes.sampleDownload, async (ctx) => {
	let link = await verifySampleLink(ctx.url.searchParams);
	if (isFailure(link)) {
		ctx.log.set({ sample: { download: link.error.problem } });
		return redirect(routes.sample.index.href(), { status: redirect.Status.SeeOther });
	}

	let epub = readSampleEpub();
	if (isFailure(epub)) {
		ctx.log.fail(epub.error, { chapter: { file: CHAPTER_FILE } });
		return redirect(routes.sample.index.href(), { status: redirect.Status.SeeOther });
	}

	ctx.log.set({ sample: { download: "sent" } });
	return new Response(epub.data.stream(), {
		headers: {
			"content-type": "application/epub+zip",
			"content-disposition": `attachment; filename="${FILENAME}"`,
			"cache-control": "private, no-store",
			"x-robots-tag": "noindex",
		},
	});
});
