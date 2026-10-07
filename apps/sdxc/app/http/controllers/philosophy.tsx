/**
 * `GET /philosophy` — the argument for why the packages look the way they do. It sits
 * at the root rather than under `/docs` because it is an argument rather than a
 * reference, and filing an argument under documentation tells a reader it is optional.
 *
 * The page is one markdown file rendered through the site's own tags, parsed per
 * request: work in the worker's global scope fails upload validation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { toRemix } from "@sdxc/markdown/remix";
import { isFailure } from "@sdxc/result";
import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { createAction } from "remix/router";

import { withBundleCache } from "~/app/http/caching";
import { siteCache } from "~/app/services/cache";
import { readContent } from "~/app/services/content";
import { readStoredSponsors, sponsorsTag } from "~/app/services/sponsors";
import Band from "~/resources/components/band";
import { LANDING_COMPONENTS } from "~/resources/components/landing";
import SiteHeader from "~/resources/components/site-header";
import Sponsors from "~/resources/components/sponsors";
import philosophySource from "~/resources/content/philosophy.md?raw";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The one-sentence summary search results and link previews show. */
const DESCRIPTION =
	"Six habits that recur across sixty packages, each one argued out in a decision the repository still carries — including the ones that were reversed.";

export default createAction(routes.philosophy, async (ctx) => {
	let content = readContent(philosophySource);

	if (isFailure(content)) {
		ctx.log.fail(content.error, { line: content.error.position?.start.line ?? null });
		throw content.error;
	}

	let roster = await readStoredSponsors(siteCache());

	let response = await ctx.render(
		<DocumentLayout title="Philosophy — sdxc" description={DESCRIPTION} canonical={ctx.url.href}>
			<SiteHeader activePath={routes.philosophy.href()} />

			{/* Each band tints the full width, so the cap belongs on the content inside one. */}
			<main mix={[vstack({ align: "center" }), is("100%")]}>
				{toRemix(content.data, { components: LANDING_COMPONENTS })}

				{/*
				 * The people funding the work close the argument, since it is their argument too.
				 * With nobody to name, the page ends on the argument itself.
				 */}
				{roster.current.length > 0 ? (
					<Band>
						<Sponsors sponsors={roster.current} />
					</Band>
				) : null}
			</main>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, sponsorsTag(roster));
});
