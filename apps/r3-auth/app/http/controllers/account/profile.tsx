/**
 * `GET /account/profile` — the signed-in subject's own profile, read straight from the
 * subject the session guard resolved, so the page always shows the person the guard let
 * through. It is also the one place a person sees that their address is unconfirmed, so
 * it renders the verification badge and the panel that asks for a fresh message.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import requireSubject from "~/app/http/middleware/require-subject";
import { accountChrome } from "~/app/http/view-models/account-chrome";
import EmailVerificationViewModel, {
	RESEND_OUTCOME_PARAM,
} from "~/app/http/view-models/email-verification";
import AccountLayout from "~/resources/layouts/account";
import ProfileView from "~/resources/views/account/profile";
import routes from "~/routes/web";

export default createAction(routes.account.profile, {
	middleware: [requireSubject],
	handler(ctx) {
		let subject = ctx.subject;

		let emailVerification = EmailVerificationViewModel.default(
			ctx.i18next,
			subject.email_verified_at,
			ctx.url.searchParams.get(RESEND_OUTCOME_PARAM),
			routes.account.verifyEmailResend.href(),
		);

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
						{
							label: ctx.i18next.t("profile.view.email"),
							value: subject.email_address,
							badge: {
								label: emailVerification.badge,
								verified: emailVerification.verified,
							},
						},
					]}
					editLabel={ctx.i18next.t("profile.view.actions.edit")}
					emailVerification={emailVerification}
				/>
			</AccountLayout>,
		);
	},
});
