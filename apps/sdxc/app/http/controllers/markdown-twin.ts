/**
 * `GET /docs/*slug.md` and `GET /api/:name.md` — the same pages as markdown.
 * Both sources are markdown files already in the bundle, so each route is a lookup and a
 * `text/markdown` response rather than a render: what a reader sees is built from this
 * file, and what an agent reads is this file.
 *
 * A package answers with its README unchanged, because that is the document published on
 * npm and read on GitHub, and an agent comparing the three should find one text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { markdown, text } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { withBundleCache } from "~/app/http/caching";
import { readGuide } from "~/app/services/docs";
import { findPackage, readPackageReadme } from "~/app/services/packages";
import routes from "~/routes/web";

/** What a machine surface answers with when nothing is filed under the path asked for. */
function missing(): Response {
	return text("Not found\n", { status: 404 });
}

/** Serves one guide's own markdown source. */
export default createAction(routes.markdown.docs, async (ctx) => {
	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);

	let source = await readGuide(slug);
	if (source === null) return missing();

	return await withBundleCache(ctx.request, markdown(source));
});

/** Serves one package's README, the document npm and GitHub show too. */
export const packageMarkdown = createAction(routes.markdown.package, async (ctx) => {
	let { name } = s.parse(s.object({ name: s.string() }), ctx.params);

	/* A directory that publishes nothing has no page here, so its README has no twin. */
	if (findPackage(name) === null) return missing();

	let source = await readPackageReadme(name);
	if (source === null) return missing();

	return await withBundleCache(ctx.request, markdown(source));
});
