/**
 * `/docs/*slug` controller. Resolves the wildcard slug to a doc file, parses its
 * Markdoc content and frontmatter, and renders it inside the shared `DocsLayout`
 * sidebar chrome. An unknown slug or a parse failure renders the same 404 the
 * router's `defaultHandler` uses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@pkg/result";
import * as s from "remix/data-schema";
import { createAction } from "remix/fetch-router";

import NotFoundViewModel from "~/app/http/view-models/not-found";
import { getDocLoader, listDocs, markdown } from "~/app/services/docs";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import DocShowView from "~/resources/views/docs/show";
import NotFoundView from "~/resources/views/not-found";
import routes from "~/routes/web";

/** GET /docs/*slug — an individual documentation page. */
export default createAction(routes.docs.show, async (ctx) => {
	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);
	let sections = await listDocs();

	let renderNotFound = () => {
		let props = NotFoundViewModel.default({ title: "Doc Not Found" });
		return ctx.render(
			<DocumentLayout title={props.title}>
				<NotFoundView {...props} />
			</DocumentLayout>,
			{ status: 404 },
		);
	};

	let docLoader = getDocLoader(slug);
	if (!docLoader) return renderNotFound();

	let content = await docLoader.loader();
	let result = markdown.parse(content);
	if (isFailure(result)) return renderNotFound();

	let { content: parsedContent, frontmatter } = result.data;

	return ctx.render(
		<DocumentLayout title={`${frontmatter.title} | Documentation | Uptime`}>
			<DocsLayout sections={sections}>
				<DocShowView content={parsedContent} frontmatter={frontmatter} />
			</DocsLayout>
		</DocumentLayout>,
	);
});
