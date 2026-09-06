/**
 * Default request handler. It renders the translated 404 document for any request that
 * matches no route, so an unmapped URL answers with the app's own page rather than a bare
 * framework error.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { maxIs, mi, minBs, p } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
import { textAlign, textDecoration } from "@sdxc/u/typography";
import { Heading, Text } from "@sdxc/ui";

import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** Renders the 404 document for unmatched routes. */
export default function defaultHandler(ctx: RequestContext) {
	let title = ctx.i18next.t("notFound.title");
	let description = ctx.i18next.t("notFound.description");

	return ctx.render(
		<DocumentLayout title={title} description={description} locale={ctx.locale}>
			<main
				mix={[
					vstack({ gap: 4, align: "center", justify: "center" }),
					minBs("100dvh"),
					maxIs("36rem"),
					mi("auto"),
					p(8),
					textAlign("center"),
				]}
			>
				<Heading level={1}>{title}</Heading>
				<Text mix={[fg("neutral.muted")]}>{description}</Text>
				<a
					href={routes.home.href()}
					mix={[fg("brand"), textDecoration("none"), hover(textDecoration("underline"))]}
				>
					{ctx.i18next.t("notFound.goBackHome")}
				</a>
			</main>
		</DocumentLayout>,
		{ status: 404 },
	);
}
