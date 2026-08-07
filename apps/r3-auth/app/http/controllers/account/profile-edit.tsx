/**
 * `/account/profile/edit` — the form that changes a subject's display name, username and
 * avatar, and the update it posts. The email address is deliberately not editable: it is
 * the claim every relying party keys on, and changing it here would silently re-point
 * accounts in other apps.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ValidationError } from "@pkg/validate";
import type { RequestContext } from "remix/fetch-router";

import { redirect } from "@pkg/http/response";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createController } from "remix/fetch-router";

import type { SelectSubject } from "~/database/schema";

import Subject from "~/app/data/subject";
import requireSubject from "~/app/http/middleware/require-subject";
import { UpdateProfileSchema } from "~/app/http/validators/account";
import { accountChrome } from "~/app/http/view-models/account-chrome";
import AccountLayout from "~/resources/layouts/account";
import ProfileEditView from "~/resources/views/account/profile-edit";
import routes from "~/routes/web";

/** The three editable values, as they were submitted or as they are currently stored. */
interface ProfileValues {
	displayName: string;
	username: string;
	avatar: string;
}

/** The values a subject's stored row starts the form with. */
function storedValues(subject: SelectSubject): ProfileValues {
	return {
		displayName: subject.display_name,
		username: subject.username,
		avatar: subject.avatar,
	};
}

/**
 * The first validator message addressed to a field, or `null` when it has none.
 *
 * Only the first: the fields carry one message each, and a field with several problems
 * is still one problem to fix from the person's point of view.
 */
function fieldError(issues: ValidationError["issues"], field: string): string | null {
	for (let issue of issues) {
		let first = issue.path?.[0];
		let name = typeof first === "object" && first !== null ? String(first.key) : String(first);
		if (name === field) return issue.message;
	}

	return null;
}

/**
 * Renders the edit form.
 *
 * @param values - What the fields start with: the stored row, or what was just submitted
 *   and refused, so a rejected save never discards typing.
 * @param issues - Per-field validator messages, empty on a first render.
 * @param error - A failure no single field owns, such as a username already taken.
 */
function editPage(
	ctx: RequestContext,
	subject: SelectSubject,
	values: ProfileValues,
	issues: ValidationError["issues"] = [],
	error: string | null = null,
): Response | Promise<Response> {
	return ctx.render(
		<AccountLayout
			{...accountChrome(ctx, {
				current: "profile",
				heading: ctx.i18next.t("profile.edit.title"),
				documentTitle: ctx.i18next.t("profile.edit.title"),
				isAdmin: subject.role === "admin",
				parents: [{ label: ctx.i18next.t("profile.title"), href: routes.account.profile.href() }],
			})}
		>
			<ProfileEditView
				title={ctx.i18next.t("profile.edit.title")}
				description={ctx.i18next.t("profile.edit.description")}
				fields={{
					displayName: {
						label: ctx.i18next.t("profile.edit.form.displayName.label"),
						placeholder: ctx.i18next.t("profile.edit.form.displayName.placeholder"),
						value: values.displayName,
						error: fieldError(issues, "displayName"),
					},
					username: {
						label: ctx.i18next.t("profile.edit.form.username.label"),
						placeholder: ctx.i18next.t("profile.edit.form.username.placeholder"),
						value: values.username,
						error: fieldError(issues, "username"),
					},
					avatar: {
						label: ctx.i18next.t("profile.edit.form.avatar.label"),
						placeholder: ctx.i18next.t("profile.edit.form.avatar.placeholder"),
						value: values.avatar,
						error: fieldError(issues, "avatar"),
					},
				}}
				labels={{
					submit: ctx.i18next.t("profile.edit.form.submit"),
					cancel: ctx.i18next.t("profile.edit.form.cancel"),
				}}
				error={error}
			/>
		</AccountLayout>,
		{ status: issues.length > 0 || error ? 400 : 200 },
	);
}

export default createController(routes.account.profileEdit, {
	middleware: [requireSubject],
	actions: {
		/** GET /account/profile/edit — the form, pre-filled from the stored row. */
		index() {
			let ctx = getContext();
			return editPage(ctx, ctx.subject, storedValues(ctx.subject));
		},

		/**
		 * POST /account/profile/edit — validates and saves, then redirects to the profile.
		 *
		 * Scoped to the subject the guard resolved, never to an id from the form: this
		 * endpoint has no way to be pointed at somebody else's row.
		 */
		action: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let subject = ctx.subject;

			let result = await validate(ctx.formData, UpdateProfileSchema);

			if (isFailure(result)) {
				ctx.logger.info("profile_update_invalid", { subjectId: subject.id });
				return editPage(
					ctx,
					subject,
					{
						displayName: readField(ctx.formData, "displayName", subject.display_name),
						username: readField(ctx.formData, "username", subject.username),
						avatar: readField(ctx.formData, "avatar", subject.avatar),
					},
					result.error.issues,
					ctx.i18next.t("profile.edit.errors.invalid"),
				);
			}

			try {
				await Subject.update(db, subject.id, {
					display_name: result.data.displayName,
					username: result.data.username,
					avatar: result.data.avatar,
				});
			} catch (error) {
				// `username` is unique, so the only expected failure here is somebody else
				// already holding it. Anything else is reported the same way rather than
				// becoming a 500 on a form the person can simply correct.
				ctx.logger.info("profile_update_rejected", {
					subjectId: subject.id,
					error: error instanceof Error ? error.message : "Unknown error",
				});

				return editPage(
					ctx,
					subject,
					result.data,
					[],
					ctx.i18next.t("profile.edit.errors.usernameTaken"),
				);
			}

			ctx.logger.info("profile_updated", { subjectId: subject.id });

			return redirect(routes.account.profile.href(), { status: redirect.Status.SeeOther });
		}),
	},
});

/** One submitted string, falling back to the stored value when the field was absent. */
function readField(formData: FormData, name: string, fallback: string): string {
	let value = formData.get(name);
	return typeof value === "string" ? value : fallback;
}
