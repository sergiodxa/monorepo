/**
 * `GET /account/profile` — the signed-in subject's own profile, read straight from the
 * subject the session guard resolved rather than re-queried, so the page can never show
 * a different person than the one the guard let through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/fetch-router";

import requireSubject from "~/app/http/middleware/require-subject";
import { accountChrome } from "~/app/http/view-models/account-chrome";
import AccountLayout from "~/resources/layouts/account";
import ProfileView from "~/resources/views/account/profile";
import routes from "~/routes/web";

export default createAction(routes.account.profile, {
	middleware: [requireSubject],
	/** Renders the profile card for the subject the guard resolved. */
	handler(ctx) {
		let subject = ctx.subject;

		return ctx.render(
			<AccountLayout
				{...accountChrome(ctx, {
					current: "profile",
					heading: ctx.i18next.t("profile.title"),
					documentTitle: ctx.i18next.t("profile.title"),
					isAdmin: subject.role === "admin",
				})}
			>
				<ProfileView
					title={ctx.i18next.t("profile.view.title")}
					displayName={subject.display_name}
					username={subject.username}
					avatar={subject.avatar}
					role={subject.role}
					details={[
						{
							label: ctx.i18next.t("profile.view.displayName"),
							value: subject.display_name,
						},
						{ label: ctx.i18next.t("profile.view.username"), value: `@${subject.username}` },
						{ label: ctx.i18next.t("profile.view.email"), value: subject.email_address },
					]}
					editLabel={ctx.i18next.t("profile.view.actions.edit")}
				/>
			</AccountLayout>,
		);
	},
});
