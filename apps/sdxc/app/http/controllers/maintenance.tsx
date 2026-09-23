/**
 * `GET /maintenance` — what support a dated release carries. A version here is a date,
 * so the question a version number usually answers is one this page has to answer
 * instead, and it is a root route for the same reason the security page is.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { toRemix } from "@sdxc/markdown/remix";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { withBundleCache } from "~/app/http/caching";
import { sponsorsTag } from "~/app/http/middleware/sponsors";
import { readPolicy } from "~/app/services/policy";
import { POLICY_COMPONENTS } from "~/resources/components/markdown-components";
import source from "~/resources/content/maintenance.md?raw";
import DocumentLayout from "~/resources/layouts/document";
import PageLayout from "~/resources/layouts/page";
import routes from "~/routes/web";

export default createAction(routes.maintenance, async (ctx) => {
	let page = readPolicy(source);

	if (isFailure(page)) {
		ctx.log.fail(page.error, { line: page.error.position?.start.line ?? null });
		throw page.error;
	}

	let { document, frontmatter } = page.data;

	let response = await ctx.render(
		<DocumentLayout
			title={`${frontmatter.title} — sdxc`}
			description={frontmatter.description}
			canonical={ctx.url.href}
			sponsors={ctx.sponsors}
		>
			<PageLayout
				title={frontmatter.title}
				description={frontmatter.description}
				lastUpdated={frontmatter.lastUpdated}
				activePath={routes.maintenance.href()}
			>
				{toRemix(document, { components: POLICY_COMPONENTS })}
			</PageLayout>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, sponsorsTag(ctx.sponsors));
});
