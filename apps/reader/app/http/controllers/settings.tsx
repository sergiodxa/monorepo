/**
 * Settings controller for `/settings`. It will show the reader's preferences on the GET and
 * save them on the POST; for now both render the page's heading alone, so the route, the
 * guard, and the layout are exercised end to end.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { vstack } from "@sdxc/u/layout";
import { maxIs, mi, p } from "@sdxc/u/size";
import { Heading } from "@sdxc/ui";
import { createController } from "remix/router";

import requireUser from "~/app/http/middleware/require-user";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** Renders the settings page, which both actions answer with while the form is unbuilt. */
function settingsPage(ctx: RequestContext) {
	let title = ctx.i18next.t("settings.title");

	return ctx.render(
		<DocumentLayout title={title} locale={ctx.locale}>
			<main mix={[vstack({ gap: 6 }), maxIs("48rem"), mi("auto"), p(8)]}>
				<Heading level={1}>{title}</Heading>
			</main>
		</DocumentLayout>,
	);
}

export default createController(routes.settings, {
	middleware: [requireUser],
	actions: {
		/** GET /settings — the preferences form. */
		index: settingsPage,
		/** POST /settings — saves the preferences. */
		action: settingsPage,
	},
});
