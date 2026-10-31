/**
 * `GET /sponsors` — the case for funding the work, with the people who fund it now named
 * in a window beside the pitch, and everyone who funded it before as a wall of avatars
 * that closes the page. Each list draws only when it names someone.
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
import { readContent } from "~/app/services/content";
import { readStoredSponsors, sponsorsTag } from "~/app/services/sponsors";
import { LANDING_COMPONENTS } from "~/resources/components/landing";
import SiteHeader from "~/resources/components/site-header";
import { PastSponsors, sponsorRosterTags } from "~/resources/components/sponsor-roster";
import source from "~/resources/content/sponsors.md?raw";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The one-sentence summary search results and link previews show. */
const DESCRIPTION =
	"Sponsor the packages, guides and releases of sdxc on GitHub, and meet the people who fund the work.";

export default createAction(routes.sponsors, async (ctx) => {
	let content = readContent(source);

	if (isFailure(content)) {
		ctx.log.fail(content.error, { line: content.error.position?.start.line ?? null });
		throw content.error;
	}

	let roster = await readStoredSponsors(siteCache());

	let response = ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title="Sponsors — sdxc"
			description={DESCRIPTION}
			canonical={ctx.url.href}
		>
			<SiteHeader activePath={routes.sponsors.href()} />

			<main mix={[vstack({ align: "center" }), is("100%")]}>
				{toRemix(content.data, {
					components: { ...LANDING_COMPONENTS, ...sponsorRosterTags(roster) },
				})}

				<PastSponsors sponsors={roster.past} />
			</main>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, sponsorsTag(roster));
});
