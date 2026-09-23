/**
 * `/account/grants` — the apps a subject has authorized, and the withdrawal of one. A
 * withdrawal removes the consent and the sessions it produced, so the person is signed
 * out of that app and must consent again to return. Every withdrawal is scoped to the
 * subject the guard resolved, so a forged client id reaches only their own rows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
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

async function grantsPage(ctx: RequestContext): Promise<Response> {
	let subject = ctx.subject;
	let grants = await Grant.findBySubjectId(ctx.db, subject.id);

	return await ctx.render(
		<AccountLayout
			{...accountChrome(ctx, {
				current: "grants",
				heading: ctx.intl.t("grants.title"),
				documentTitle: ctx.intl.t("grants.title"),
				isAdmin: subject.role === "admin",
			})}
		>
			<GrantsView
				title={ctx.intl.t("grants.title")}
				description={ctx.intl.t("grants.description")}
				empty={ctx.intl.t("grants.empty")}
				columns={{
					app: ctx.intl.t("grants.columns.app"),
					authorizedOn: ctx.intl.t("grants.columns.authorizedOn"),
					actions: ctx.intl.t("grants.columns.actions"),
				}}
				labels={{
					revoke: ctx.intl.t("grants.actions.revoke"),
					cannotRevoke: ctx.intl.t("grants.cannotRevoke"),
					tableLabel: ctx.intl.t("grants.tableLabel"),
				}}
				confirm={{
					title: ctx.intl.t("grants.confirm.revoke.title"),
					confirm: ctx.intl.t("grants.confirm.revoke.confirm"),
					cancel: ctx.intl.t("grants.confirm.cancel"),
				}}
				grants={grants.map((grant) => {
					let row = toGrantRow(grant, AUTH_SERVER_CLIENT_ID, ctx.locale);
					return {
						...row,
						confirmDescription: ctx.intl.t("grants.confirm.revoke.description", {
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
		index: async (ctx) => {
			return await grantsPage(ctx);
		},

		/**
		 * POST /account/grants — withdraws one consent, then the sessions it produced; with
		 * no interactive transactions, that order leaves at worst sessions that expire on
		 * their own. This server's own registration stays: it carries the current session.
		 */
		action: async (ctx) => {
			let subject = ctx.subject;

			let result = await validate(ctx.formData, GrantsIntentSchema);

			if (isFailure(result)) {
				ctx.log.note("grant.revoke_invalid");
				return backToList();
			}

			let clientId = result.data.clientId;
			ctx.log.set({ client: { id: clientId } });

			if (clientId === AUTH_SERVER_CLIENT_ID) {
				ctx.log.note("grant.revoke_refused");
				return backToList();
			}

			let removed = await Grant.deleteBySubjectAndClient(ctx.db, subject.id, clientId);

			if (removed === 0) {
				ctx.log.note("grant.not_found");
				return backToList();
			}

			let sessions = await Session.deleteBySubjectAndClient(ctx.db, subject.id, clientId);

			ctx.log.set({ sessions: { revoked: sessions } });
			ctx.log.note("grant.revoked");

			return backToList();
		},
	},
});

/** Sends the browser back to the list, so a refresh re-runs the GET. */
function backToList(): Response {
	return redirect(routes.account.grants.index.href(), { status: redirect.Status.SeeOther });
}
