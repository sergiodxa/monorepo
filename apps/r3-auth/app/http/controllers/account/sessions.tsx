/**
 * `/account/sessions` — the device list and the two revocations it offers. Every session
 * row's id is a live refresh token, so the list is scoped to the subject the guard
 * resolved, every revocation is scoped the same way, and the page is never cached.
 *
 * Revoking the session the request itself arrived on ends it here too: the tokens go, the
 * session record is destroyed, and the browser is asked to drop this origin's cookies.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/fetch-router";

import { redirect } from "@pkg/http/response";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createController } from "remix/fetch-router";

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
 * `"cookies"` rather than `"*"`: the person is being sent to sign in again, and clearing
 * their storage and caches for this origin would achieve nothing beyond that.
 */
const CLEAR_COOKIES: HeadersInit = { "Clear-Site-Data": '"cookies"' };

/**
 * The rendered page must not be stored by anything: it carries one live refresh token per
 * row, as the value each revoke form posts back.
 */
const NO_STORE: HeadersInit = { "Cache-Control": "no-store, private" };

/** Renders the device list for the subject the guard resolved. */
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

/** Sends the browser back to the list, so a refresh never re-posts the revocation. */
function backToList(): Response {
	return redirect(routes.account.sessions.index.href(), { status: redirect.Status.SeeOther });
}

/**
 * Signs the browser out and sends it to the authorization endpoint.
 *
 * `destroySession()` runs last, and nothing may touch the session after it: a destroyed
 * session throws on any further access.
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
		 * POST /account/sessions — revokes one session, or every session but this one.
		 *
		 * Both branches delete only rows belonging to the subject the guard resolved, so a
		 * forged `sessionId` naming somebody else's session deletes nothing.
		 */
		action: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let subject = ctx.subject;
			let currentSessionId = getRefreshToken();

			let result = await validate(ctx.formData, SessionsIntentSchema);

			if (isFailure(result)) {
				ctx.logger.info("session_revoke_invalid", { subjectId: subject.id });
				return backToList();
			}

			let submitted = result.data;
			let owned = await Session.findBySubjectId(db, subject.id);

			if (submitted.intent === "revoke-all") {
				// Every session but this one, which is what the control promises: booting every
				// other device is most useful precisely when the person wants to stay signed in
				// here and keep reading the list.
				let others = owned.filter((session) => session.id !== currentSessionId);
				for (let session of others) await Session.deleteById(db, session.id);

				ctx.logger.info("sessions_revoked_all", {
					subjectId: subject.id,
					count: others.length,
				});

				// Nothing was kept, which means the current session's own row was already gone,
				// so the tokens in the cookie no longer refresh anything.
				if (others.length === owned.length) return signOut();

				return backToList();
			}

			let target = owned.find((session) => session.id === submitted.sessionId);

			if (!target) {
				// Either already revoked, or never this subject's. Same answer either way, and
				// the submitted id is neither echoed back nor logged.
				ctx.logger.info("session_revoke_not_found", { subjectId: subject.id });
				return backToList();
			}

			await Session.deleteById(db, target.id);
			ctx.logger.info("session_revoked", { subjectId: subject.id });

			if (target.id === currentSessionId) return signOut();

			// A subject whose last session was just revoked has nothing left to refresh with,
			// even though the row removed was not the one this request arrived on.
			let remaining = await Session.findBySubjectId(db, subject.id);
			if (remaining.length === 0) return signOut();

			return backToList();
		}),
	},
});
