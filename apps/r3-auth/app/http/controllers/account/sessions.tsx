/**
 * `/account/sessions` — the device list and the two revocations it offers. Every session
 * row's id is a live refresh token, so the list and every revocation are scoped to the
 * subject the guard resolved, and the page is served no-store. Revoking the session this
 * request arrived on ends it here too, dropping this origin's cookies.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { inject } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";

import Session from "~/app/data/session";
import requireSubject from "~/app/http/middleware/require-subject";
import { destroySession, getRefreshToken, unsetTokens } from "~/app/http/middleware/session";
import { SessionsIntentSchema } from "~/app/http/validators/account";
import { accountChrome } from "~/app/http/view-models/account-chrome";
import { toSessionRow } from "~/app/http/view-models/account-session";
import AccountLayout from "~/resources/layouts/account";
import SessionsView from "~/resources/views/account/sessions";
import routes from "~/routes/web";

/**
 * Headers that end the session in the browser as well as in the database.
 *
 * Clearing cookies alone is enough: the person is being sent to sign in again, and this
 * origin's storage and caches hold nothing that outlives that.
 */
const CLEAR_COOKIES: HeadersInit = { "Clear-Site-Data": '"cookies"' };

/**
 * Each rendered row carries a live refresh token, as the value its revoke form posts
 * back, so this response stays private to the browser that asked for it.
 */
const NO_STORE: HeadersInit = { "Cache-Control": "no-store, private" };

async function sessionsPage(ctx: RequestContext, db: Database): Promise<Response> {
	let subject = ctx.subject;
	let sessions = await Session.findBySubjectId(db, subject.id);
	let currentSessionId = getRefreshToken();

	return await ctx.render(
		<AccountLayout
			{...accountChrome(ctx, {
				current: "sessions",
				heading: ctx.i18next.t("sessions.title"),
				documentTitle: ctx.i18next.t("sessions.title"),
				isAdmin: subject.role === "admin",
			})}
		>
			<SessionsView
				title={ctx.i18next.t("sessions.title")}
				description={ctx.i18next.t("sessions.description")}
				empty={ctx.i18next.t("sessions.empty")}
				columns={{
					device: ctx.i18next.t("sessions.columns.device"),
					ip: ctx.i18next.t("sessions.columns.ip"),
					client: ctx.i18next.t("sessions.columns.client"),
					status: ctx.i18next.t("sessions.columns.status"),
					lastAccessed: ctx.i18next.t("sessions.columns.lastAccessed"),
					expires: ctx.i18next.t("sessions.columns.expires"),
					actions: ctx.i18next.t("sessions.columns.actions"),
				}}
				labels={{
					current: ctx.i18next.t("sessions.current"),
					active: ctx.i18next.t("sessions.status.active"),
					stale: ctx.i18next.t("sessions.status.stale"),
					device: {
						desktop: ctx.i18next.t("sessions.device.desktop"),
						mobile: ctx.i18next.t("sessions.device.mobile"),
						tablet: ctx.i18next.t("sessions.device.tablet"),
						unknown: ctx.i18next.t("sessions.device.unknown"),
					},
					revoke: ctx.i18next.t("sessions.actions.revoke"),
					revokeAll: ctx.i18next.t("sessions.actions.revokeAll"),
					tableLabel: ctx.i18next.t("sessions.tableLabel"),
				}}
				confirmations={{
					revoke: {
						title: ctx.i18next.t("sessions.confirm.revoke.title"),
						description: ctx.i18next.t("sessions.confirm.revoke.description"),
						confirm: ctx.i18next.t("sessions.confirm.revoke.confirm"),
						cancel: ctx.i18next.t("sessions.confirm.cancel"),
					},
					revokeCurrent: {
						title: ctx.i18next.t("sessions.confirm.revoke.title"),
						description: ctx.i18next.t("sessions.confirm.revoke.descriptionCurrent"),
						confirm: ctx.i18next.t("sessions.confirm.revoke.confirm"),
						cancel: ctx.i18next.t("sessions.confirm.cancel"),
					},
					revokeAll: {
						title: ctx.i18next.t("sessions.confirm.revokeAll.title"),
						description: ctx.i18next.t("sessions.confirm.revokeAll.description"),
						confirm: ctx.i18next.t("sessions.confirm.revokeAll.confirm"),
						cancel: ctx.i18next.t("sessions.confirm.cancel"),
					},
				}}
				sessions={sessions.map((session) => toSessionRow(session, currentSessionId, ctx.locale))}
			/>
		</AccountLayout>,
		{ headers: NO_STORE },
	);
}

/** Sends the browser back to the list, so a refresh re-runs the GET. */
function backToList(): Response {
	return redirect(routes.account.sessions.index.href(), { status: redirect.Status.SeeOther });
}

/**
 * Signs the browser out and sends it to the authorization endpoint.
 *
 * `destroySession()` runs last, since a destroyed session throws on any further access.
 */
function signOut(): Response {
	unsetTokens();
	destroySession();

	return redirect(routes.authorize.index.href(), {
		status: redirect.Status.SeeOther,
		headers: CLEAR_COOKIES,
	});
}

export default createController(routes.account.sessions, {
	middleware: [requireSubject],
	actions: {
		/** GET /account/sessions — lists the subject's live sessions. */
		index: inject([Database] as const, async (db) => {
			return await sessionsPage(getContext(), db);
		}),

		/**
		 * POST /account/sessions — revokes one session, or every session but this one. Both
		 * branches touch only the guard's subject's rows; any other id gets the same answer
		 * a stale one does. The browser signs out once no row is left that can refresh.
		 */
		action: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let subject = ctx.subject;
			let currentSessionId = getRefreshToken();

			let result = await validate(ctx.formData, SessionsIntentSchema);

			if (isFailure(result)) {
				ctx.log.note("session.revoke_invalid");
				return backToList();
			}

			let submitted = result.data;
			let owned = await Session.findBySubjectId(db, subject.id);

			if (submitted.intent === "revoke-all") {
				let others = owned.filter((session) => session.id !== currentSessionId);
				for (let session of others) await Session.deleteById(db, session.id);

				ctx.log.set({ sessions: { revoked: others.length } });
				ctx.log.note("session.revoked_all");

				if (others.length === owned.length) return signOut();

				return backToList();
			}

			let target = owned.find((session) => session.id === submitted.sessionId);

			if (!target) {
				ctx.log.note("session.revoke_not_found");
				return backToList();
			}

			await Session.deleteById(db, target.id);
			ctx.log.set({ sessions: { revoked: 1 } });
			ctx.log.note("session.revoked");

			if (target.id === currentSessionId) return signOut();

			let remaining = await Session.findBySubjectId(db, subject.id);
			if (remaining.length === 0) return signOut();

			return backToList();
		}),
	},
});
