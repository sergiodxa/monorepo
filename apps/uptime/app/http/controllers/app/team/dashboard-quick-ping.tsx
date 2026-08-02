/**
 * Dashboard quick-check fragment controller. GET /app/:team/dashboard/quick-ping —
 * renders the URL box, and the previous check's result when there is one, with no
 * document shell, so the dashboard's quick-ping `Frame` can swap it in on its own.
 * Requires `requireUser` + `requireTeam`.
 *
 * This fragment is the only reader — and the only remover — of the stored result. The
 * action that performs the check writes it and redirects; whichever way the page comes
 * back — a frame reload after a scripted submit, or a full navigation with no JavaScript
 * at all — this handler is what turns it into markup. Keeping that in one place is what
 * lets the two paths render the same card, and keeping the removal here is what keeps the
 * dashboard document request from clearing a result it never rendered.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getContext } from "remix/async-context-middleware";
import { createAction } from "remix/fetch-router";
import { Session } from "remix/session";

import type { QuickPingOutcome } from "~/app/http/controllers/actions/ping";

import { QUICK_PING_RESULT } from "~/app/http/controllers/actions/ping";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import QuickPing from "~/resources/components/quick-ping";
import routes from "~/routes/web";

/** GET /app/:team/dashboard/quick-ping — the quick-check card, fragment-only. */
export default createAction(routes.app.team.dashboard.quickPing, {
	middleware: [requireUser, requireTeam],
	handler: async () => {
		let ctx = getContext();

		/**
		 * Read and then removed here, which is what makes the result show exactly once: a
		 * later reload of this frame comes back to an empty form rather than to a stale
		 * answer. Removing it explicitly rather than relying on flash semantics is
		 * load-bearing — see {@link QUICK_PING_RESULT} for the request-ordering reason.
		 */
		let session = ctx.get(Session);
		let outcome = session?.get(QUICK_PING_RESULT) as QuickPingOutcome | undefined;
		if (outcome) session?.unset(QUICK_PING_RESULT);

		return ctx.render(
			<QuickPing
				action={routes.actions.runPing.href({ team: ctx.team.slug })}
				src={routes.app.team.dashboard.quickPing.href({ team: ctx.team.slug })}
				outcome={outcome}
				labels={{
					title: ctx.i18next.t("page.dashboard.quickPing.title"),
					description: ctx.i18next.t("page.dashboard.quickPing.description"),
					field: ctx.i18next.t("page.dashboard.quickPing.field.label"),
					placeholder: ctx.i18next.t("page.dashboard.quickPing.field.placeholder"),
					submit: ctx.i18next.t("page.dashboard.quickPing.action.submit"),
					noResponse: ctx.i18next.t("page.dashboard.quickPing.result.noResponse"),
					status: {
						up: ctx.i18next.t("page.dashboard.quickPing.result.status.up"),
						degraded: ctx.i18next.t("page.dashboard.quickPing.result.status.degraded"),
						down: ctx.i18next.t("page.dashboard.quickPing.result.status.down"),
					},
					error: {
						invalidUrl: ctx.i18next.t("page.dashboard.quickPing.error.invalidUrl"),
						subscriptionRequired: ctx.i18next.t(
							"page.dashboard.quickPing.error.subscriptionRequired",
						),
					},
				}}
			/>,
		);
	},
});
