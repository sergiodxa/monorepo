/**
 * Dashboard quick-check fragment controller. GET /app/:team/dashboard/quick-ping —
 * renders the header's URL bar, and the previous check's answer as a toast when there is
 * one, with no document shell, so the dashboard's quick-ping `Frame` can swap it in on
 * its own. Requires `requireUser` + `requireTeam`.
 *
 * This fragment is the only reader — and the only remover — of the stored result. The
 * action that performs the check writes it and redirects; whichever way the page comes
 * back — a frame reload after a scripted submit, or a full navigation with no JavaScript
 * at all — this handler is what turns it into markup. Keeping that in one place is what
 * lets the two paths render the same thing, and keeping the removal here is what keeps the
 * dashboard document request from clearing a result it never rendered.
 *
 * The answer is a toast rather than a line under the field, because the bar now sits in
 * the header's fixed 64px row and there is no vertical room there for one. It is also the
 * honest shape for it: a check that saves nothing has nothing to leave behind, and the
 * toast fades on its own. The toast is still assembled here, on the server, from what the
 * session held — never in the browser — which is what keeps the scripted and unscripted
 * paths reporting the same check the same way.
 *
 * Below 768px the bar is a popover instead, opened by the trigger button rendered beside
 * it; see `quick-ping-form.tsx` for why one form covers both layouts rather than two.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ZapIcon } from "@pkg/lucide-remix";
import { bg, border, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { cursor } from "@pkg/u/general";
import { hidden, inlineFlex, items, justify, shrink } from "@pkg/u/layout";
import { media } from "@pkg/u/responsive";
import { bs, is, p } from "@pkg/u/size";
import { hover } from "@pkg/u/state";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import type { QuickPingOutcome } from "~/app/http/controllers/actions/ping";

import { QUICK_PING_RESULT } from "~/app/http/controllers/actions/ping";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { badgeVariant } from "~/resources/components/badge";
import FlashToast from "~/resources/components/flash-toast";
import { QUICK_PING_FORM_ID, QuickPingForm } from "~/resources/components/quick-ping-form";
import routes from "~/routes/web";

/** GET /app/:team/dashboard/quick-ping — the header's quick-check bar, fragment-only. */
export default createAction(routes.app.team.dashboard.quickPing, {
	middleware: [requireUser, requireTeam],
	handler: async () => {
		let ctx = getContext();

		/**
		 * Read and then removed here, which is what makes the answer show exactly once: a
		 * later reload of this frame comes back to an empty form rather than to a toast about
		 * a check nobody just ran. Removing it explicitly rather than relying on flash
		 * semantics is load-bearing — see {@link QUICK_PING_RESULT} for the request-ordering
		 * reason.
		 */
		let session = ctx.get(Session);
		let outcome = session?.get(QUICK_PING_RESULT) as QuickPingOutcome | undefined;
		if (outcome) session?.unset(QUICK_PING_RESULT);

		let result = outcome?.kind === "result" ? outcome : undefined;

		/**
		 * The code the target answered with and how long it took, or the wording for a target
		 * that never answered at all rather than a code it never sent.
		 */
		let detail: string | undefined;
		if (result) {
			let code =
				result.responseStatus === null
					? ctx.i18next.t("page.dashboard.quickPing.result.noResponse")
					: `HTTP ${result.responseStatus}`;
			detail =
				result.responseTimeMs === null ? code : `${code} · ${Math.round(result.responseTimeMs)} ms`;
		}

		return ctx.render(
			<>
				{/*
				 * Only below 768px, where the bar beside it is a closed popover: the same
				 * `commandfor`/`command="toggle-popover"` Invoker Commands relationship the
				 * sidebar's own hamburger uses, so opening the sheet costs no script.
				 */}
				<button
					type="button"
					commandfor={QUICK_PING_FORM_ID}
					command="toggle-popover"
					aria-label={ctx.i18next.t("page.dashboard.quickPing.action.open")}
					mix={[
						inlineFlex(),
						items("center"),
						justify("center"),
						is("32px"),
						bs("32px"),
						p(0),
						rounded(),
						border("none"),
						bg("transparent"),
						fg("inherit"),
						cursor("pointer"),
						shrink(),
						hover(bg("neutral.bg-tint-hover")),
						media("(min-width: 768px)", hidden()),
					]}
				>
					<ZapIcon size={18} strokeWidth={1.5} />
				</button>

				<QuickPingForm
					action={routes.actions.runPing.href({ team: ctx.team.slug })}
					src={routes.app.team.dashboard.quickPing.href({ team: ctx.team.slug })}
					url={result?.url}
					label={ctx.i18next.t("page.dashboard.quickPing.field.label")}
					placeholder={ctx.i18next.t("page.dashboard.quickPing.field.placeholder")}
					description={ctx.i18next.t("page.dashboard.quickPing.description")}
					submit={ctx.i18next.t("page.dashboard.quickPing.action.submit")}
				/>

				{result && detail && (
					<FlashToast
						color={badgeVariant(result.status).color}
						label={ctx.i18next.t("page.dashboard.quickPing.result.label")}
						occurrence={result.id}
						title={ctx.i18next.t(`page.dashboard.quickPing.result.status.${result.status}`)}
						description={detail}
					/>
				)}

				{outcome?.kind === "error" && (
					<FlashToast
						color="danger"
						label={ctx.i18next.t("page.dashboard.quickPing.result.label")}
						occurrence={outcome.id}
						title={ctx.i18next.t("page.dashboard.quickPing.title")}
						description={ctx.i18next.t(`page.dashboard.quickPing.error.${outcome.code}`)}
					/>
				)}
			</>,
		);
	},
});
