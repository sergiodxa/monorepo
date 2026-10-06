/**
 * `GET /docs/*slug.md`, `GET /api/:name.md` and the `@sdxc/ui` pages' twins — the same
 * pages as markdown. A guide or a package README is served as the file it already is; a
 * catalogue page is written from the records its HTML page draws, so the two agree.
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
import { readComponentMarkdown, readUiExportMarkdown } from "~/app/services/ui-pages";
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

/** Serves the theme contract or one `@sdxc/ui` component as markdown. */
export const componentMarkdownTwin = createAction(routes.markdown.component, async (ctx) => {
	let { component } = s.parse(s.object({ component: s.string() }), ctx.params);

	let source = await readComponentMarkdown(component);
	if (source === null) return missing();

	return await withBundleCache(ctx.request, markdown(source));
});

/** Serves one `@sdxc/ui` mixin, behavior, animation or style recipe as markdown. */
export const uiExportMarkdownTwin = createAction(routes.markdown.uiExport, async (ctx) => {
	let { slug, subpath } = s.parse(s.object({ subpath: s.string(), slug: s.string() }), ctx.params);

	let source = await readUiExportMarkdown(subpath, slug);
	if (source === null) return missing();

	return await withBundleCache(ctx.request, markdown(source));
});
