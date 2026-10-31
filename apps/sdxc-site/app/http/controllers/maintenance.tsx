/**
 * `GET /maintenance` — what support a dated release carries. A version here is a date,
 * so the question a version number usually answers is one this page answers instead,
 * drawn in the landing's bands at the root for the same reason the security page is.
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
import { readPolicy } from "~/app/services/policy";
import { LANDING_COMPONENTS } from "~/resources/components/landing";
import SiteHeader from "~/resources/components/site-header";
import source from "~/resources/content/maintenance.md?raw";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

export default createAction(routes.maintenance, async (ctx) => {
	let page = readPolicy(source);

	if (isFailure(page)) {
		ctx.log.fail(page.error, { line: page.error.position?.start.line ?? null });
		throw page.error;
	}

	let { document, frontmatter } = page.data;

	let response = ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={`${frontmatter.title} — sdxc`}
			description={frontmatter.description}
			canonical={ctx.url.href}
		>
			<SiteHeader activePath={routes.maintenance.href()} />

			<main mix={[vstack({ align: "center" }), is("100%")]}>
				{toRemix(document, { components: LANDING_COMPONENTS })}
			</main>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response);
});
