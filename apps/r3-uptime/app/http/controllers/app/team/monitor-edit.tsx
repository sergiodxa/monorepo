/**
 * Edit HTTP monitor page controller. Requires `requireUser` + `requireTeam`; 404s
 * when the monitor doesn't belong to the current team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/http/response/html";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import ContentCheck from "~/app/data/content-check";
import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import EditMonitorView from "~/resources/views/monitors/edit";
import routes from "~/routes/web";

/** GET /app/:team/monitors/:monitorId/edit — a monitor's edit form. */
export default createAction(
	routes.app.team.monitorEdit,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await Monitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		let contentChecks = await ContentCheck.listByMonitor(db, monitor.id);

		let renderDocument = DocumentLayout();
		return ctx.render(
			renderDocument({
				title: `${ctx.team.name} · Edit ${monitor.name}`,
				children: (
					<AppShell team={ctx.team} viewer={viewer}>
						<EditMonitorView team={ctx.team} monitor={monitor} contentChecks={contentChecks} />
					</AppShell>
				),
			}),
		);
	}),
);
