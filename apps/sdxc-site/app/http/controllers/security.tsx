/**
 * `GET /security` — which releases get fixes, and how to report something privately.
 * It is the page a person looks for before depending on anything, so it is a root
 * route drawn in the landing's bands, reached from the footer of every page.
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
import source from "~/resources/content/security.md?raw";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

export default createAction(routes.security, async (ctx) => {
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
			<SiteHeader activePath={routes.security.href()} />

			<main mix={[vstack({ align: "center" }), is("100%")]}>
				{toRemix(document, { components: LANDING_COMPONENTS })}
			</main>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response);
});
