/**
 * `GET /demo/:slug` — a complete sample landing built only from `@sdxc/ui`'s marketing
 * parts, each with its own invented product and palette. Marked `noindex, nofollow`, since
 * the page is a specimen of the components rather than a page about sdxc.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import defaultHandler from "~/app/http/controllers/default-handler";
import DocumentLayout from "~/resources/layouts/document";
import { findDemoLanding } from "~/resources/views/demos";
import routes from "~/routes/web";

/** The directive every demo carries, which keeps it out of results and its links unfollowed. */
const DEMO_ROBOTS = "noindex, nofollow";

export default createAction(routes.demo, async (ctx) => {
	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);
	let demo = await findDemoLanding(slug);
	if (demo === null) return defaultHandler(ctx);

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={demo.title}
			description={demo.description}
			robots={DEMO_ROBOTS}
			siteFooter={false}
		>
			{demo.render()}
		</DocumentLayout>,
	);
});
