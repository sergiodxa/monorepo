/**
 * `GET /dashboard` — lists the tenants the signed-in platform user can access, or
 * redirects to the create-first-tenant flow when they have none. Renders the tenant
 * list with `remix/ui` JSX via `ctx.render`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import Tenant from "~/app/models/tenant";
import { StatusBadge } from "~/app/views/components";
import { Document } from "~/app/views/document";
import * as s from "~/app/views/styles";
import routes from "~/routes/web";

/**
 * Loads the accessible tenants for the current platform session and renders them,
 * redirecting to the new-tenant page when the user has no tenants yet.
 *
 * @returns A rendered tenant-list document, or a 302 redirect to the new-tenant page.
 * @example
 * router.map(routes.dashboard.index, { middleware: dashboard, handler: dashboardIndex });
 */
export default createAction(
	routes.dashboard.index,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let { platformSession, logger } = ctx;
		let log = logger.loader("/dashboard");

		let tenants = await Tenant.listAccessibleBySubject(
			db,
			platformSession.subjectId,
			platformSession.email,
		);

		log.info("Dashboard loaded", {
			subjectId: platformSession.subjectId,
			tenantCount: tenants.length,
		});

		if (tenants.length === 0) {
			return new Response(null, {
				status: 302,
				headers: { Location: routes.dashboard.tenants.new.href() },
			});
		}

		return ctx.render(
			<Document title="Dashboard">
				<div mix={[s.header]}>
					<h2 mix={[s.pageTitle]} style="margin:0">
						Your Tenants
					</h2>
					<a mix={[s.button]} href={routes.dashboard.tenants.new.href()}>
						New Tenant
					</a>
				</div>

				<ul mix={[s.listSpaced]}>
					{tenants.map((t) => (
						<li mix={[s.listCard]} key={t.id}>
							<a mix={[s.linkPlain]} href={routes.dashboard.tenants.show.href({ id: t.id })}>
								<h3 mix={[s.cardTitle]}>{t.name}</h3>
								<p mix={[s.mutedSmall]}>{t.slug}</p>
								<StatusBadge status={t.status} />
							</a>
						</li>
					))}
				</ul>
			</Document>,
		);
	}),
);
