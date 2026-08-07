/**
 * GET/POST /admin/subjects/:subjectId — one account with its live sessions and provider
 * links, plus the three intents that act on it: delete the account, revoke one session,
 * or revoke them all. Every session id handled here is that session's refresh token, so
 * it is read from the form, used to delete by, and never logged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { badRequest } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createController } from "remix/fetch-router";

import Connection from "~/app/data/connection";
import Grant from "~/app/data/grant";
import Session from "~/app/data/session";
import Subject from "~/app/data/subject";
import defaultHandler from "~/app/http/controllers/default-handler";
import requireAdmin from "~/app/http/middleware/require-admin";
import { SubjectIntentSchema } from "~/app/http/validators/admin";
import {
	toChrome,
	toConnectionRow,
	toSessionRow,
	toSubjectDetail,
} from "~/app/http/view-models/admin";
import SubjectDetailView from "~/resources/views/admin/subject-detail";
import routes from "~/routes/web";

export default createController(routes.admin.subject, {
	middleware: [requireAdmin],
	actions: {
		/** GET /admin/subjects/:subjectId — renders the profile, sessions and links. */
		index: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let subjectId = ctx.params.subjectId!;

			let subject = await Subject.findById(db, subjectId);
			if (!subject) {
				ctx.logger.info("admin_subject_not_found", { subjectId });
				return defaultHandler(ctx);
			}

			let [sessions, connections] = await Promise.all([
				Session.findBySubjectId(db, subjectId),
				Connection.findBySubjectId(db, subjectId),
			]);

			ctx.logger.info("admin_subject_viewed", {
				subjectId,
				sessionsCount: sessions.length,
				connectionsCount: connections.length,
			});

			let unknown = ctx.i18next.t("admin.subjects.sessions.unknownDevice");

			let chrome = toChrome(ctx, {
				documentTitle: subject.display_name,
				heading: subject.display_name,
				section: "subjects",
				breadcrumbs: [
					{
						label: ctx.i18next.t("admin.nav.items.dashboard"),
						href: routes.admin.dashboard.href(),
					},
					{
						label: ctx.i18next.t("admin.subjects.title"),
						href: routes.admin.subjects.href(),
					},
				],
			});

			return ctx.render(
				<SubjectDetailView
					chrome={chrome}
					subject={toSubjectDetail(subject, ctx.locale)}
					sessions={sessions.map((session) => toSessionRow(session, unknown, ctx.locale))}
					connections={connections.map((connection) => toConnectionRow(connection, ctx.locale))}
					editHref={routes.admin.subjectEdit.index.href({ subjectId })}
					labels={{
						detail: {
							id: ctx.i18next.t("admin.subjects.detail.id"),
							email: ctx.i18next.t("admin.subjects.detail.email"),
							role: ctx.i18next.t("admin.subjects.detail.role"),
							emailVerifiedAt: ctx.i18next.t("admin.subjects.detail.emailVerifiedAt"),
							notVerified: ctx.i18next.t("admin.subjects.detail.notVerified"),
							createdAt: ctx.i18next.t("admin.subjects.detail.createdAt"),
						},
						roles: {
							user: ctx.i18next.t("admin.subjects.roles.user"),
							admin: ctx.i18next.t("admin.subjects.roles.admin"),
						},
						edit: ctx.i18next.t("admin.subjects.actions.edit"),
						delete: ctx.i18next.t("admin.subjects.actions.delete"),
						deleteConfirm: {
							title: ctx.i18next.t("admin.subjects.delete.title"),
							description: ctx.i18next.t("admin.subjects.delete.confirm"),
							confirm: ctx.i18next.t("admin.subjects.actions.delete"),
							cancel: ctx.i18next.t("admin.subjects.sessions.confirm.cancel"),
						},
						sessions: {
							title: ctx.i18next.t("admin.subjects.sessions.title"),
							description: ctx.i18next.t("admin.subjects.sessions.description"),
							empty: ctx.i18next.t("admin.subjects.sessions.empty"),
							lastAccessed: ctx.i18next.t("admin.subjects.sessions.lastAccessedLabel"),
							expires: ctx.i18next.t("admin.subjects.sessions.expiresLabel"),
							active: ctx.i18next.t("admin.subjects.sessions.status.active"),
							stale: ctx.i18next.t("admin.subjects.sessions.status.stale"),
							revoke: ctx.i18next.t("admin.subjects.sessions.actions.revoke"),
							revokeAll: ctx.i18next.t("admin.subjects.sessions.actions.revokeAll"),
							revokeConfirm: {
								title: ctx.i18next.t("admin.subjects.sessions.confirm.revoke.title"),
								description: ctx.i18next.t("admin.subjects.sessions.confirm.revoke.description"),
								confirm: ctx.i18next.t("admin.subjects.sessions.confirm.revoke.confirm"),
								cancel: ctx.i18next.t("admin.subjects.sessions.confirm.cancel"),
							},
							revokeAllConfirm: {
								title: ctx.i18next.t("admin.subjects.sessions.confirm.revokeAll.title"),
								description: ctx.i18next.t("admin.subjects.sessions.confirm.revokeAll.description"),
								confirm: ctx.i18next.t("admin.subjects.sessions.confirm.revokeAll.confirm"),
								cancel: ctx.i18next.t("admin.subjects.sessions.confirm.cancel"),
							},
						},
						connections: {
							title: ctx.i18next.t("admin.subjects.connections.title"),
							description: ctx.i18next.t("admin.subjects.connections.description"),
							empty: ctx.i18next.t("admin.subjects.connections.empty"),
							externalId: ctx.i18next.t("admin.subjects.connections.externalId"),
							linkedAt: ctx.i18next.t("admin.subjects.connections.linkedAt"),
						},
					}}
				/>,
			);
		}),

		/**
		 * POST /admin/subjects/:subjectId — deletes the account, or revokes one or all of
		 * its sessions.
		 *
		 * A revocation redirects back to this page rather than answering with a body, so
		 * the list the administrator is looking at is the list that now exists.
		 */
		action: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let subjectId = ctx.params.subjectId!;

			let result = await validate(ctx.formData, SubjectIntentSchema);
			if (isFailure(result)) {
				ctx.logger.error("admin_subject_invalid_intent", { subjectId });
				return badRequest({ error: "invalid_intent" });
			}

			let intent = result.data;
			let here = routes.admin.subject.index.href({ subjectId });

			if (intent.intent === "revoke-session") {
				await Session.deleteById(db, intent.sessionId);
				// The session id is the refresh token: the count is logged, never the value.
				ctx.logger.info("admin_subject_session_revoked", { subjectId });
				return redirect(here, { status: redirect.Status.SeeOther });
			}

			if (intent.intent === "revoke-all-sessions") {
				let revoked = await Session.deleteBySubjectId(db, subjectId);
				ctx.logger.info("admin_subject_all_sessions_revoked", { subjectId, revoked });
				return redirect(here, { status: redirect.Status.SeeOther });
			}

			// Sessions and grants first: with no transactions, a deletion interrupted
			// halfway must never leave rows pointing at a subject that is gone.
			await Session.deleteBySubjectId(db, subjectId);
			await Grant.deleteBySubjectId(db, subjectId);
			await Subject.delete(db, subjectId);

			ctx.logger.info("admin_subject_deleted", { subjectId });

			return redirect(routes.admin.subjects.href(), { status: redirect.Status.SeeOther });
		}),
	},
});
