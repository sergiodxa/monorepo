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

import { vstack } from "@sdxc/u/layout";
import { LinkButton } from "@sdxc/ui";

import type { NavTree } from "~/app/services/navigation";

import PageTitle from "~/resources/components/page-title";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";

/**
 * Renders the documentation 404.
 *
 * @param ctx - The request being answered.
 * @param tree - The tree of the part of the site the address was under, so the shell
 * around the message still navigates and the way back leads to where the reader was.
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
				breadcrumbs={[{ label: tree.label, href: tree.href }, { label: "Not found" }]}
			>
				<div mix={[vstack({ gap: 4, align: "start" })]}>
					<PageTitle eyebrow="404" title="Not found">
						No documentation page answers to that address.
					</PageTitle>
					<LinkButton href={tree.href} variant="outline" color="neutral">
						Back to {tree.label}
					</LinkButton>
				</div>
			</DocsLayout>
		</DocumentLayout>,
		{ status: 404 },
	);
}
