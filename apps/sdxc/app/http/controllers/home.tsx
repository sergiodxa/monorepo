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

import { readOptionSelections } from "~/app/http/cookies";
import { readContent } from "~/app/services/content";
import { LANDING_COMPONENTS } from "~/resources/components/landing";
import SiteHeader from "~/resources/components/site-header";
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

	return ctx.render(
		<DocumentLayout
			title="sdxc"
			description={DESCRIPTION}
			canonical={ctx.url.href}
			selections={await readOptionSelections(ctx.request)}
		>
			<SiteHeader activePath={routes.home.href()} />

			{/* Each band tints the full width, so the cap belongs on the content inside one. */}
			<main mix={[vstack({ align: "center" }), is("100%")]}>
				{toRemix(content.data, { components: LANDING_COMPONENTS })}
			</main>
		</DocumentLayout>,
	);
});
