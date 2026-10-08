/**
 * GET/POST /admin/subjects/:subjectId — one account with its live sessions and provider
 * links, plus the three intents that act on it: delete the account, revoke one session,
 * or revoke them all. Every session id handled here is that session's refresh token, so
 * it travels from the form into a delete scoped to this subject while logs record counts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { badRequest } from "@sdxc/http/response/json";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import Connection from "~/app/data/connection";
import Grant from "~/app/data/grant";
import Session from "~/app/data/session";
import Subject from "~/app/data/subject";
import defaultHandler from "~/app/http/controllers/default-handler";
import subjectAccess, { requireAdminArea } from "~/app/http/middleware/access";
import requireSubject from "~/app/http/middleware/require-subject";
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
	middleware: [requireSubject, subjectAccess, requireAdminArea],
	actions: {
		/** GET /admin/subjects/:subjectId — renders the profile, sessions and links. */
		index: async (ctx) => {
			let subjectId = ctx.params.subjectId!;
			ctx.log.set({ admin: { subject_id: subjectId } });

			let subject = await Subject.findById(ctx.db, subjectId);
			if (!subject) {
				ctx.log.note("admin.subject.not_found");
				return defaultHandler(ctx);
			}

			let [sessions, connections] = await Promise.all([
				Session.findBySubjectId(ctx.db, subjectId),
				Connection.findBySubjectId(ctx.db, subjectId),
			]);

			ctx.log.set({
				sessions: { count: sessions.length },
				connections: { count: connections.length },
			});

			let unknown = ctx.intl.t("admin.subjects.sessions.unknownDevice");

			let chrome = toChrome(ctx, {
				documentTitle: subject.display_name,
				heading: subject.display_name,
				section: "subjects",
				breadcrumbs: [
					{
						label: ctx.intl.t("admin.nav.items.dashboard"),
						href: routes.admin.dashboard.href(),
					},
					{
						label: ctx.intl.t("admin.subjects.title"),
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
							id: ctx.intl.t("admin.subjects.detail.id"),
							email: ctx.intl.t("admin.subjects.detail.email"),
							role: ctx.intl.t("admin.subjects.detail.role"),
							emailVerifiedAt: ctx.intl.t("admin.subjects.detail.emailVerifiedAt"),
							notVerified: ctx.intl.t("admin.subjects.detail.notVerified"),
							createdAt: ctx.intl.t("admin.subjects.detail.createdAt"),
						},
						roles: {
							user: ctx.intl.t("admin.subjects.roles.user"),
							admin: ctx.intl.t("admin.subjects.roles.admin"),
						},
						edit: ctx.intl.t("admin.subjects.actions.edit"),
						delete: ctx.intl.t("admin.subjects.actions.delete"),
						deleteConfirm: {
							title: ctx.intl.t("admin.subjects.delete.title"),
							description: ctx.intl.t("admin.subjects.delete.confirm"),
							confirm: ctx.intl.t("admin.subjects.actions.delete"),
							cancel: ctx.intl.t("admin.subjects.sessions.confirm.cancel"),
						},
						sessions: {
							title: ctx.intl.t("admin.subjects.sessions.title"),
							description: ctx.intl.t("admin.subjects.sessions.description"),
							empty: ctx.intl.t("admin.subjects.sessions.empty"),
							lastAccessed: ctx.intl.t("admin.subjects.sessions.lastAccessedLabel"),
							expires: ctx.intl.t("admin.subjects.sessions.expiresLabel"),
							active: ctx.intl.t("admin.subjects.sessions.status.active"),
							stale: ctx.intl.t("admin.subjects.sessions.status.stale"),
							revoke: ctx.intl.t("admin.subjects.sessions.actions.revoke"),
							revokeAll: ctx.intl.t("admin.subjects.sessions.actions.revokeAll"),
							revokeConfirm: {
								title: ctx.intl.t("admin.subjects.sessions.confirm.revoke.title"),
								description: ctx.intl.t("admin.subjects.sessions.confirm.revoke.description"),
								confirm: ctx.intl.t("admin.subjects.sessions.confirm.revoke.confirm"),
								cancel: ctx.intl.t("admin.subjects.sessions.confirm.cancel"),
							},
							revokeAllConfirm: {
								title: ctx.intl.t("admin.subjects.sessions.confirm.revokeAll.title"),
								description: ctx.intl.t("admin.subjects.sessions.confirm.revokeAll.description"),
								confirm: ctx.intl.t("admin.subjects.sessions.confirm.revokeAll.confirm"),
								cancel: ctx.intl.t("admin.subjects.sessions.confirm.cancel"),
							},
						},
						connections: {
							title: ctx.intl.t("admin.subjects.connections.title"),
							description: ctx.intl.t("admin.subjects.connections.description"),
							empty: ctx.intl.t("admin.subjects.connections.empty"),
							externalId: ctx.intl.t("admin.subjects.connections.externalId"),
							linkedAt: ctx.intl.t("admin.subjects.connections.linkedAt"),
						},
					}}
				/>,
			);
		},

		/**
		 * POST /admin/subjects/:subjectId — deletes the account, or revokes one or all of
		 * its sessions. A delete removes sessions and grants first, so an interrupted run
		 * leaves every remaining row pointing at a subject that still exists.
		 */
		action: async (ctx) => {
			let subjectId = ctx.params.subjectId!;
			ctx.log.set({ admin: { subject_id: subjectId } });

			let result = await validate(ctx.formData, SubjectIntentSchema);
			if (isFailure(result)) {
				ctx.log.warn("admin.subject.intent_invalid");
				return badRequest({ error: "invalid_intent" });
			}

			let intent = result.data;
			let here = routes.admin.subject.index.href({ subjectId });

			if (intent.intent === "revoke-session") {
				let revoked = await Session.deleteBySubjectAndId(ctx.db, subjectId, intent.sessionId);
				ctx.log.set({ sessions: { revoked } });
				ctx.log.note(revoked ? "admin.subject.session_revoked" : "admin.subject.session_not_found");
				return redirect(here, { status: redirect.Status.SeeOther });
			}

			if (intent.intent === "revoke-all-sessions") {
				let revoked = await Session.deleteBySubjectId(ctx.db, subjectId);
				ctx.log.set({ sessions: { revoked } });
				ctx.log.note("admin.subject.sessions_revoked");
				return redirect(here, { status: redirect.Status.SeeOther });
			}

			await Session.deleteBySubjectId(ctx.db, subjectId);
			await Grant.deleteBySubjectId(ctx.db, subjectId);
			await Subject.delete(ctx.db, subjectId);

			ctx.log.note("admin.subject.deleted");

			return redirect(routes.admin.subjects.href(), { status: redirect.Status.SeeOther });
		},
	},
});
