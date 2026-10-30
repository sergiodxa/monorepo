/**
 * `GET /` — the landing page. The whole page is one markdown file rendered through the
 * site's tag components, so editing the pitch is editing that file. The parse runs per
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

import { siteCache } from "~/app/initializers/cache";
import { readOptionSelections } from "~/app/initializers/cookies";
import { readChangelog } from "~/app/services/changelog";
import { readContent } from "~/app/services/content";
import { readStoredSponsors } from "~/app/services/sponsors";
import { LANDING_COMPONENTS } from "~/resources/components/landing";
import { releaseTags } from "~/resources/components/release-pin";
import RuntimeShowcase from "~/resources/components/runtime-showcase";
import SiteHeader from "~/resources/components/site-header";
import { sponsorTags } from "~/resources/components/sponsors";
import homeSource from "~/resources/content/home.md?raw";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The one-sentence summary search results and link previews show. */
const DESCRIPTION =
	"Small TypeScript packages built on web standards: Request and Response in, typed values out, and no framework underneath unless you ask for one.";

export default createAction(routes.home, async (ctx) => {
	let content = readContent(homeSource);

	if (isFailure(content)) {
		ctx.log.fail(content.error, { line: content.error.position?.start.line ?? null });
		throw content.error;
	}

	let [roster, releases] = await Promise.all([
		readStoredSponsors(siteCache()),
		readChangelog(siteCache()),
	]);

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title="sdxc"
			description={DESCRIPTION}
			canonical={ctx.url.href}
			selections={await readOptionSelections(ctx.request)}
		>
			<SiteHeader activePath={routes.home.href()} />

			<main mix={[vstack({ align: "center" }), is("100%")]}>
				{toRemix(content.data, {
					components: {
						...LANDING_COMPONENTS,
						...sponsorTags(roster.current),
						...releaseTags(releases[0]),
						"runtime-showcase": RuntimeShowcase,
					},
				})}
			</main>
		</DocumentLayout>,
	);
});
