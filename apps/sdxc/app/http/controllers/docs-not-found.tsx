/**
 * The 404 a documentation route answers with. It keeps the shell, because a reader
 * who mistyped a slug is one click from the tree they wanted, and it carries no
 * canonical link, since telling a crawler this URL is real content is exactly the
 * claim a 404 denies.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { text, tracking, weight } from "@sdxc/u/typography";
import { LinkButton } from "@sdxc/ui";

import type { NavTree } from "~/app/services/navigation";

import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/**
 * Renders the documentation 404.
 *
 * @param ctx - The request being answered.
 * @param tree - The documentation tree, so the shell around the message still navigates.
 * @returns The rendered 404 document.
 */
export default function docsNotFound(ctx: RequestContext, tree: NavTree) {
	return ctx.render(
		<DocumentLayout
			title="Not found — sdxc"
			description="No documentation page answers to that address."
			sponsors={ctx.sponsors}
		>
			<DocsLayout
				tree={tree}
				activePath=""
				breadcrumbs={[
					{ label: "Documentation", href: routes.docs.index.href() },
					{ label: "Not found" },
				]}
			>
				<div mix={[vstack({ gap: 4, align: "start" })]}>
					<h1 mix={[m(0), text("3xl"), weight("bold"), tracking("tight")]}>Not found</h1>
					<p mix={[m(0), text("base"), fg("neutral")]}>
						No documentation page answers to that address.
					</p>
					<LinkButton href={routes.docs.index.href()} variant="outline" color="neutral">
						Back to the documentation
					</LinkButton>
				</div>
			</DocsLayout>
		</DocumentLayout>,
		{ status: 404 },
	);
}
