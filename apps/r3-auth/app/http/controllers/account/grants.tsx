/**
 * `/account/grants` — the apps a subject has authorized, and the withdrawal of one. A
 * withdrawal removes the consent and the sessions that consent produced, so the person is
 * signed out of that app as well as no longer able to sign back in silently.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { redirect } from "@pkg/http/response";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";

import { AUTH_SERVER_CLIENT_ID } from "~/app/config";
import Grant from "~/app/data/grant";
import Session from "~/app/data/session";
import requireSubject from "~/app/http/middleware/require-subject";
import { GrantsIntentSchema } from "~/app/http/validators/account";
import { accountChrome } from "~/app/http/view-models/account-chrome";
import { toGrantRow } from "~/app/http/view-models/account-grant";
import AccountLayout from "~/resources/layouts/account";
import GrantsView from "~/resources/views/account/grants";
import routes from "~/routes/web";

/** Renders the authorized-apps list for the subject the guard resolved. */
async function grantsPage(ctx: RequestContext, db: Database): Promise<Response> {
	let subject = ctx.subject;
	let grants = await Grant.findBySubjectId(db, subject.id);

	return await ctx.render(
		<AccountLayout
			{...accountChrome(ctx, {
				current: "grants",
				heading: ctx.i18next.t("grants.title"),
				documentTitle: ctx.i18next.t("grants.title"),
				isAdmin: subject.role === "admin",
			})}
		>
			<GrantsView
				title={ctx.i18next.t("grants.title")}
				description={ctx.i18next.t("grants.description")}
				empty={ctx.i18next.t("grants.empty")}
				columns={{
					app: ctx.i18next.t("grants.columns.app"),
					authorizedOn: ctx.i18next.t("grants.columns.authorizedOn"),
					actions: ctx.i18next.t("grants.columns.actions"),
				}}
				labels={{
					revoke: ctx.i18next.t("grants.actions.revoke"),
					cannotRevoke: ctx.i18next.t("grants.cannotRevoke"),
					tableLabel: ctx.i18next.t("grants.tableLabel"),
				}}
				confirm={{
					title: ctx.i18next.t("grants.confirm.revoke.title"),
					confirm: ctx.i18next.t("grants.confirm.revoke.confirm"),
					cancel: ctx.i18next.t("grants.confirm.cancel"),
				}}
				grants={grants.map((grant) => {
					let row = toGrantRow(grant, AUTH_SERVER_CLIENT_ID, ctx.locale);
					return {
						...row,
						confirmDescription: ctx.i18next.t("grants.confirm.revoke.description", {
							client: row.clientName,
						}),
					};
				})}
			/>
		</AccountLayout>,
	);
}

export default createController(routes.account.grants, {
	middleware: [requireSubject],
	actions: {
		/** GET /account/grants — lists the clients this subject has authorized. */
		index: inject([Database] as const, async (db) => {
			return await grantsPage(getContext(), db);
		}),

		/**
		 * POST /account/grants — withdraws one consent and the sessions it produced.
		 *
		 * The two deletions are separate statements and this database has no interactive
		 * transactions, so the consent goes first: a failure in between leaves sessions that
		 * expire on their own, whereas the reverse order would leave a consent that silently
		 * re-authorizes the app on its next visit.
		 */
		action: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let subject = ctx.subject;

			let result = await validate(ctx.formData, GrantsIntentSchema);

			if (isFailure(result)) {
				ctx.logger.info("grant_revoke_invalid", { subjectId: subject.id });
				return backToList();
			}

			let clientId = result.data.clientId;

			// This server's own registration is what the browser reading the page is signed in
			// through: withdrawing it would delete this very session as a side effect of an
			// action that says nothing about signing out.
			if (clientId === AUTH_SERVER_CLIENT_ID) {
				ctx.logger.info("grant_revoke_refused_auth_server", { subjectId: subject.id });
				return backToList();
			}

			// Scoped to the guard's subject, so a forged client id can only ever remove this
			// person's own consent.
			let removed = await Grant.deleteBySubjectAndClient(db, subject.id, clientId);

			if (removed === 0) {
				ctx.logger.info("grant_revoke_not_found", { subjectId: subject.id, clientId });
				return backToList();
			}

			let sessions = await Session.deleteBySubjectAndClient(db, subject.id, clientId);

			ctx.logger.info("grant_revoked", { subjectId: subject.id, clientId, sessions });

			return backToList();
		}),
	},
});

/** Sends the browser back to the list, so a refresh never re-posts the withdrawal. */
function backToList(): Response {
	return redirect(routes.account.grants.index.href(), { status: redirect.Status.SeeOther });
}
