/**
 * `GET /security` — which releases get fixes, and how to report something privately.
 * It is the page a person looks for before depending on anything, so it is a root
 * route rather than a guide: a reader reaches it from the footer of whatever page
 * raised the question.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { toRemix } from "@sdxc/markdown/remix";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { withBundleCache } from "~/app/http/caching";
import { readPolicy } from "~/app/services/policy";
import { POLICY_COMPONENTS } from "~/resources/components/markdown-components";
import source from "~/resources/content/security.md?raw";
import DocumentLayout from "~/resources/layouts/document";
import PageLayout from "~/resources/layouts/page";
import routes from "~/routes/web";

export default createAction(routes.security, async (ctx) => {
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
		>
			<PageLayout
				eyebrow="Policy"
				title={frontmatter.title}
				description={frontmatter.description}
				lastUpdated={frontmatter.lastUpdated}
				activePath={routes.security.href()}
			>
				{toRemix(document, { components: POLICY_COMPONENTS })}
			</PageLayout>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response);
});
