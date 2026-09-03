/**
 * Dashboard quick-check fragment controller. GET /app/:team/dashboard/quick-ping —
 * renders the header's URL bar and the previous check's result as a toast, with no
 * document shell, so the dashboard's quick-ping `Frame` can swap it in on its own.
 * A scripted frame reload and a full no-JavaScript navigation both resolve here,
 * so this is the one place that turns a stored check result into markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ZapIcon } from "@pkg/icons";
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
		 * Read and removed together, the only place either happens, so the very next
		 * reload renders a clean empty form and the answer appears exactly once. The
		 * explicit `unset` call is what makes the timing work; see {@link QUICK_PING_RESULT} for why.
		 */
		let session = ctx.get(Session);
		let outcome = session?.get(QUICK_PING_RESULT) as QuickPingOutcome | undefined;
		if (outcome) session?.unset(QUICK_PING_RESULT);

		let result = outcome?.kind === "result" ? outcome : undefined;

		/**
		 * The code the target answered with and how long it took, using dedicated
		 * no-response wording when the target never answered at all.
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
