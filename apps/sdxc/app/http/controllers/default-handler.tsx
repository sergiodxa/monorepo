/**
 * Default request handler. Renders the 404 document for any request that matches no
 * route, so an unmapped URL answers with the site's own page rather than a bare
 * framework error.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { LinkButton } from "@sdxc/ui";

import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** Renders the 404 document for unmatched routes. */
export default function defaultHandler(ctx: RequestContext) {
	return ctx.render(
		<DocumentLayout title="Not found — sdxc" description="The requested page does not exist.">
			<main mix={[vstack({ gap: 5, align: "center", justify: "center" }), p(24, 5)]}>
				<h1 mix={[m(0), text("3xl")]}>Not found</h1>
				<p mix={[m(0), text("base"), fg("neutral")]}>The requested page does not exist.</p>
				<LinkButton href={routes.home.href()}>Back to the start</LinkButton>
			</main>
		</DocumentLayout>,
		{ status: 404 },
	);
}
