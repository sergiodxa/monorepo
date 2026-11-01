/**
 * Dashboard quick-check fragment controller. GET /app/:team/dashboard/quick-ping —
 * renders the header's URL bar with the previous check's result right after it, with no
 * document shell, so the dashboard's quick-ping `Frame` swaps it in on its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ZapIcon } from "@sdxc/icons";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor } from "@sdxc/u/general";
import { gap, hidden, inlineFlex, items, justify, shrink } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { bs, is, maxIs, p } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
import { text, whiteSpace } from "@sdxc/u/typography";
import { StatusDot } from "@sdxc/ui";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import type { QuickPingOutcome, QuickPingResult } from "~/app/http/controllers/actions/ping";

import { QUICK_PING_RESULT } from "~/app/http/controllers/actions/ping";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { QUICK_PING_FORM_ID, QuickPingForm } from "~/resources/components/quick-ping-form";
import routes from "~/routes/web";

const RESULT_COLOR: Record<QuickPingResult["status"], "success" | "warning" | "danger"> = {
	up: "success",
	degraded: "warning",
	down: "danger",
};

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
					? ctx.intl.t("page.dashboard.quickPing.result.noResponse")
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
					aria-label={ctx.intl.t("page.dashboard.quickPing.action.open")}
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
					url={result?.url}
					label={ctx.intl.t("page.dashboard.quickPing.field.label")}
					placeholder={ctx.intl.t("page.dashboard.quickPing.field.placeholder")}
					description={ctx.intl.t("page.dashboard.quickPing.description")}
					submit={ctx.intl.t("page.dashboard.quickPing.action.submit")}
				/>

				{outcome && (
					/**
					 * The answer sits right after the button that asked for it, where the eye
					 * already is, and stays until the next reload of the bar clears it.
					 */
					<output
						aria-label={ctx.intl.t("page.dashboard.quickPing.result.label")}
						mix={[inlineFlex(), items("center"), gap("8px"), text("sm"), maxIs("28rem")]}
					>
						{result && detail ? (
							<>
								<StatusDot color={RESULT_COLOR[result.status]}>
									{ctx.intl.t(`page.dashboard.quickPing.result.status.${result.status}`)}
								</StatusDot>
								<span mix={[fg("neutral.muted")]}>{detail}</span>
							</>
						) : null}
						{outcome.kind === "error" ? (
							<StatusDot color="danger" mix={[whiteSpace("normal")]}>
								{ctx.intl.t(`page.dashboard.quickPing.error.${outcome.code}`)}
							</StatusDot>
						) : null}
					</output>
				)}
			</>,
		);
	},
});
