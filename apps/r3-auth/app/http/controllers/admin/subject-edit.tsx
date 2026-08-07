/**
 * GET/POST /admin/subjects/:subjectId/edit — updates an account's profile, its role, and
 * whether its address counts as verified. The email address itself is not editable: it
 * is what a provider identity is matched against on first sign-in, so re-pointing it
 * from here would change who an account belongs to.
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

import Subject from "~/app/data/subject";
import defaultHandler from "~/app/http/controllers/default-handler";
import requireAdmin from "~/app/http/middleware/require-admin";
import { UpdateSubjectSchema } from "~/app/http/validators/admin";
import { toChrome, toSubjectDetail } from "~/app/http/view-models/admin";
import SubjectEditView from "~/resources/views/admin/subject-edit";
import routes from "~/routes/web";

/** The page's chrome, shared by the form and a failed submission. */
function chrome(ctx: RequestContext, displayName: string, subjectId: string) {
	return toChrome(ctx, {
		documentTitle: ctx.i18next.t("admin.subjects.edit.documentTitle", { name: displayName }),
		heading: ctx.i18next.t("admin.subjects.edit.title"),
		section: "subjects",
		breadcrumbs: [
			{ label: ctx.i18next.t("admin.nav.items.dashboard"), href: routes.admin.dashboard.href() },
			{ label: ctx.i18next.t("admin.subjects.title"), href: routes.admin.subjects.href() },
			{ label: displayName, href: routes.admin.subject.index.href({ subjectId }) },
		],
	});
}

/** Every string the edit page renders, resolved once per request. */
function labels(ctx: RequestContext) {
	return {
		title: ctx.i18next.t("admin.subjects.edit.title"),
		description: ctx.i18next.t("admin.subjects.edit.description"),
		fields: {
			displayName: {
				label: ctx.i18next.t("admin.subjects.form.displayName.label"),
				placeholder: ctx.i18next.t("admin.subjects.form.displayName.placeholder"),
			},
			username: {
				label: ctx.i18next.t("admin.subjects.form.username.label"),
				placeholder: ctx.i18next.t("admin.subjects.form.username.placeholder"),
			},
			avatar: {
				label: ctx.i18next.t("admin.subjects.form.avatar.label"),
				placeholder: ctx.i18next.t("admin.subjects.form.avatar.placeholder"),
			},
			email: {
				label: ctx.i18next.t("admin.subjects.form.email.label"),
				placeholder: ctx.i18next.t("admin.subjects.form.email.placeholder"),
			},
		},
		role: ctx.i18next.t("admin.subjects.form.role.label"),
		roles: {
			user: ctx.i18next.t("admin.subjects.roles.user"),
			admin: ctx.i18next.t("admin.subjects.roles.admin"),
		},
		emailVerified: ctx.i18next.t("admin.subjects.form.emailVerified.label"),
		submit: ctx.i18next.t("admin.subjects.form.submit"),
		cancel: ctx.i18next.t("admin.subjects.form.cancel"),
		invalid: ctx.i18next.t("admin.subjects.form.invalid"),
	};
}

export default createController(routes.admin.subjectEdit, {
	middleware: [requireAdmin],
	actions: {
		/** GET /admin/subjects/:subjectId/edit — renders the form filled from the stored row. */
		index: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let subjectId = ctx.params.subjectId!;

			let subject = await Subject.findById(db, subjectId);
			if (!subject) {
				ctx.logger.info("admin_subject_not_found", { subjectId });
				return defaultHandler(ctx);
			}

			return ctx.render(
				<SubjectEditView
					chrome={chrome(ctx, subject.display_name, subjectId)}
					labels={labels(ctx)}
					subject={toSubjectDetail(subject, ctx.locale)}
					detailHref={routes.admin.subject.index.href({ subjectId })}
				/>,
			);
		}),

		/** POST /admin/subjects/:subjectId/edit — persists the edit and returns to the detail page. */
		action: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let subjectId = ctx.params.subjectId!;

			let subject = await Subject.findById(db, subjectId);
			if (!subject) {
				ctx.logger.info("admin_subject_not_found", { subjectId });
				return defaultHandler(ctx);
			}

			let result = await validate(ctx.formData, UpdateSubjectSchema);
			if (isFailure(result)) {
				ctx.logger.info("admin_subject_update_invalid", { subjectId });
				return ctx.render(
					<SubjectEditView
						chrome={chrome(ctx, subject.display_name, subjectId)}
						labels={labels(ctx)}
						subject={toSubjectDetail(subject, ctx.locale)}
						detailHref={routes.admin.subject.index.href({ subjectId })}
						issues={result.error.issues}
					/>,
					{ status: 400 },
				);
			}

			let input = result.data;

			// Ticking the box stamps the verification now; clearing it removes the stamp,
			// which is what makes the checkbox a real round trip rather than one-way.
			await Subject.update(db, subjectId, {
				display_name: input.displayName,
				username: input.username,
				avatar: input.avatar,
				role: input.role,
				email_verified_at: input.emailVerified ? (subject.email_verified_at ?? Date.now()) : null,
			});

			ctx.logger.info("admin_subject_updated", { subjectId, role: input.role });

			return redirect(routes.admin.subject.index.href({ subjectId }), {
				status: redirect.Status.SeeOther,
			});
		}),
	},
});
