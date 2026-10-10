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
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import abilities from "~/app/authz/abilities";
import subjectAccess from "~/app/http/middleware/access";
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

async function sessionsPage(ctx: RequestContext): Promise<Response> {
	let subject = ctx.subject;
	let sessions = await ctx.models.sessions.findBySubjectId(subject.id);
	let currentSessionId = getRefreshToken();

	return await ctx.render(
		<AccountLayout
			{...accountChrome(ctx, {
				current: "sessions",
				heading: ctx.intl.t("sessions.title"),
				documentTitle: ctx.intl.t("sessions.title"),
			})}
		>
			<SessionsView
				title={ctx.intl.t("sessions.title")}
				description={ctx.intl.t("sessions.description")}
				empty={ctx.intl.t("sessions.empty")}
				columns={{
					device: ctx.intl.t("sessions.columns.device"),
					ip: ctx.intl.t("sessions.columns.ip"),
					client: ctx.intl.t("sessions.columns.client"),
					status: ctx.intl.t("sessions.columns.status"),
					lastAccessed: ctx.intl.t("sessions.columns.lastAccessed"),
					expires: ctx.intl.t("sessions.columns.expires"),
					actions: ctx.intl.t("sessions.columns.actions"),
				}}
				labels={{
					current: ctx.intl.t("sessions.current"),
					active: ctx.intl.t("sessions.status.active"),
					stale: ctx.intl.t("sessions.status.stale"),
					device: {
						desktop: ctx.intl.t("sessions.device.desktop"),
						mobile: ctx.intl.t("sessions.device.mobile"),
						tablet: ctx.intl.t("sessions.device.tablet"),
						unknown: ctx.intl.t("sessions.device.unknown"),
					},
					revoke: ctx.intl.t("sessions.actions.revoke"),
					revokeAll: ctx.intl.t("sessions.actions.revokeAll"),
					tableLabel: ctx.intl.t("sessions.tableLabel"),
				}}
				confirmations={{
					revoke: {
						title: ctx.intl.t("sessions.confirm.revoke.title"),
						description: ctx.intl.t("sessions.confirm.revoke.description"),
						confirm: ctx.intl.t("sessions.confirm.revoke.confirm"),
						cancel: ctx.intl.t("sessions.confirm.cancel"),
					},
					revokeCurrent: {
						title: ctx.intl.t("sessions.confirm.revoke.title"),
						description: ctx.intl.t("sessions.confirm.revoke.descriptionCurrent"),
						confirm: ctx.intl.t("sessions.confirm.revoke.confirm"),
						cancel: ctx.intl.t("sessions.confirm.cancel"),
					},
					revokeAll: {
						title: ctx.intl.t("sessions.confirm.revokeAll.title"),
						description: ctx.intl.t("sessions.confirm.revokeAll.description"),
						confirm: ctx.intl.t("sessions.confirm.revokeAll.confirm"),
						cancel: ctx.intl.t("sessions.confirm.cancel"),
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
	middleware: [requireSubject, subjectAccess],
	actions: {
		/** GET /account/sessions — lists the subject's live sessions. */
		index: async (ctx) => {
			return await sessionsPage(ctx);
		},

		/**
		 * POST /account/sessions — revokes one session, or every session but this one. Both
		 * touch only the subject's own rows: the policy refuses another's session as not
		 * found, answered as a stale id is. The browser signs out once no row can refresh.
		 */
		action: async (ctx) => {
			let subject = ctx.subject;
			let currentSessionId = getRefreshToken();

			let result = await validate(ctx.formData, SessionsIntentSchema);

			if (isFailure(result)) {
				ctx.log.note("session.revoke_invalid");
				return backToList();
			}

			let submitted = result.data;

			if (submitted.intent === "revoke-all") {
				let owned = await ctx.models.sessions.findBySubjectId(subject.id);
				let others = owned.filter((session) => session.id !== currentSessionId);
				for (let session of others) await ctx.models.sessions.delete(session.id);

				ctx.log.set({ sessions: { revoked: others.length } });
				ctx.log.note("session.revoked_all");

				if (others.length === owned.length) return signOut();

				return backToList();
			}

			let target = await ctx.models.sessions.find(submitted.sessionId);

			if (
				!target ||
				isFailure(ctx.access.authorize(abilities.account.session.revoke, { session: target }))
			) {
				ctx.log.note("session.revoke_not_found");
				return backToList();
			}

			await ctx.models.sessions.delete(target.id);
			ctx.log.set({ sessions: { revoked: 1 } });
			ctx.log.note("session.revoked");

			if (target.id === currentSessionId) return signOut();

			let remaining = await ctx.models.sessions.findBySubjectId(subject.id);
			if (remaining.length === 0) return signOut();

			return backToList();
		},
	},
});
