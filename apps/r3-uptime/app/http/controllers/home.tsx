/**
 * Home controller. Renders the minimal landing page: a sign-in call to action for
 * anonymous visitors, or a link into their team's dashboard for signed-in ones. It
 * exists as the placeholder for the marketing landing page ported in a later phase,
 * and as the redirect target for unauthenticated `requireUser` guards.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Team from "~/app/data/team";
import { getViewer } from "~/app/http/middleware/auth";
import DocumentLayout from "~/resources/layouts/document";
import HomeView from "~/resources/views/home";
import routes from "~/routes/web";

/** GET / — the app's landing page. */
export default createAction(
	routes.home,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		let teamSlug: string | null = null;

		if (viewer) {
			let teams = await Team.listBySubjectId(db, viewer.id);
			teamSlug = teams[0]?.slug ?? null;
		}

		return ctx.render(
			<DocumentLayout title="Uptime">
				<HomeView viewer={viewer} teamSlug={teamSlug} />
			</DocumentLayout>,
		);
	}),
);
