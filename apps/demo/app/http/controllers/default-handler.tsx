/**
 * Default request handler. Renders the 404 document for any request that matches no route,
 * so an unmapped URL answers with the board's own page rather than a bare framework error.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { vstack } from "@sdxc/u/layout";
import { text, weight } from "@sdxc/u/typography";

import DocumentLayout from "~/resources/layouts/document";

/** Renders the 404 document for unmatched routes. */
export default function defaultHandler(ctx: RequestContext) {
	return ctx.render(
		<DocumentLayout title={ctx.intl.t("notFound.title")} locale={ctx.locale}>
			<div mix={[vstack({ gap: 2 })]}>
				<h1 mix={[text("3xl"), weight("light")]}>{ctx.intl.t("notFound.title")}</h1>
				<p>{ctx.intl.t("notFound.description")}</p>
			</div>
		</DocumentLayout>,
		{ status: 404 },
	);
}
