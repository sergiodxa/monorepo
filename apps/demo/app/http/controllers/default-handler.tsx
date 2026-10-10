/**
 * Default request handler. Renders the 404 document for any request that matches no route,
 * so an unmapped URL answers with the board's own page, and a way back to it, rather than a
 * bare framework error.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Empty, LinkButton } from "@sdxc/ui";

import type { AppContext } from "~/bootstrap/app";

import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** Renders the 404 document for unmatched routes. */
export default function defaultHandler(ctx: AppContext) {
	return ctx.render(
		<DocumentLayout title={ctx.intl.t("notFound.title")} locale={ctx.locale}>
			<Empty color="neutral">
				<Empty.Title>{ctx.intl.t("notFound.title")}</Empty.Title>
				<Empty.Description>{ctx.intl.t("notFound.description")}</Empty.Description>
				<Empty.Action>
					<LinkButton href={routes.board.index.href()} color="brand">
						{ctx.intl.t("notFound.back")}
					</LinkButton>
				</Empty.Action>
			</Empty>
		</DocumentLayout>,
		{ status: 404 },
	);
}
