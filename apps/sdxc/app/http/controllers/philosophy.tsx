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
import { is, maxIs, p } from "@sdxc/u/size";
import { createAction } from "remix/router";

import { withBundleCache } from "~/app/http/caching";
import { sponsorsTag } from "~/app/http/middleware/sponsors";
import { readContent } from "~/app/services/content";
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

	let response = await ctx.render(
		<DocumentLayout
			title="Philosophy — sdxc"
			description={DESCRIPTION}
			canonical={ctx.url.href}
			/* This page names them itself, below the argument they fund, so the closing bar leaves them out. */
			sponsors={[]}
		>
			<SiteHeader activePath={routes.philosophy.href()} />

			{/* Each band tints the full width, so the cap belongs on the content inside one. */}
			<main mix={[vstack({ align: "center" }), is("100%")]}>
				{toRemix(content.data, { components: LANDING_COMPONENTS })}

				{/* The people funding the work close the argument, since it is their argument too. */}
				<div mix={[is("100%"), maxIs("64rem"), p(0, 5, 16, 5)]}>
					<Sponsors sponsors={ctx.sponsors} />
				</div>
			</main>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, sponsorsTag(ctx.sponsors));
});
