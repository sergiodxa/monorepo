/**
 * `GET /philosophy` — the argument for why the packages look the way they do. It sits
 * at the root rather than under `/docs` because it is an argument rather than a
 * reference, and filing an argument under documentation tells a reader it is optional.
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
import { siteCache } from "~/app/initializers/cache";
import { contentVariables } from "~/app/services/article";
import { readContent } from "~/app/services/content";
import { readStoredSponsors, sponsorsTag } from "~/app/services/sponsors";
import { LANDING_COMPONENTS } from "~/resources/components/landing";
import SiteHeader from "~/resources/components/site-header";
import { sponsorTags } from "~/resources/components/sponsors";
import philosophySource from "~/resources/content/philosophy.md?raw";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The one-sentence summary search results and link previews show, quoting the counted total. */
function describe(packageCount: string): string {
	return `Six habits that recur across ${packageCount} packages, each one argued out in a decision the repository still carries — including the ones that were reversed.`;
}

export default createAction(routes.philosophy, async (ctx) => {
	let content = readContent(philosophySource);

	if (isFailure(content)) {
		ctx.log.fail(content.error, { line: content.error.position?.start.line ?? null });
		throw content.error;
	}

	let roster = await readStoredSponsors(siteCache());

	let response = ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title="Philosophy — sdxc"
			description={describe(contentVariables().packageCount ?? "")}
			canonical={ctx.url.href}
		>
			<SiteHeader activePath={routes.philosophy.href()} />

			<main mix={[vstack({ align: "center" }), is("100%")]}>
				{toRemix(content.data, {
					components: { ...LANDING_COMPONENTS, ...sponsorTags(roster.current) },
				})}
			</main>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, sponsorsTag(roster));
});
