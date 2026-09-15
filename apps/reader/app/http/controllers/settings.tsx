/**
 * Settings controller for `/settings`: the GET shows the reader's preferences and the POST
 * saves them. A saved cadence redirects back to the form carrying `?saved`, so the page the
 * browser lands on is a fresh read and refreshing it asks for the form again.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { redirect } from "@sdxc/http/response";
import { border, fg } from "@sdxc/u/color";
import { flex, vstack } from "@sdxc/u/layout";
import { m, p, pb } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Alert, Button, Card, Description, FieldError, RadioGroup, Text } from "@sdxc/ui";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createController } from "remix/router";

import type { UserStore } from "~/database/user-do";

import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { REFRESH_INTERVALS } from "~/database/schema";
import { userStore } from "~/database/user-do";
import AppLayout from "~/resources/layouts/app";
import routes from "~/routes/web";

/**
 * The query parameter a saved cadence redirects back with, carrying the success across a
 * redirect that would otherwise arrive as an ordinary view of the form.
 */
const SAVED_PARAM = "saved";

/** Status for a submission the offered cadences do not include. */
const UNPROCESSABLE_STATUS = 422;

/** Ties the radio group's accessible name and hint to the legend and description on screen. */
const LEGEND_ID = "settings-refresh-legend";
const DESCRIPTION_ID = "settings-refresh-description";

/**
 * The cadence the form submits, as the text a form field carries mapped back to the number
 * of hours it stands for. Anything outside the offered set is refused here, ahead of the
 * database's own `CHECK`.
 */
const RefreshIntervalForm = f.object({
	refreshIntervalHours: f.field(
		s.union(REFRESH_INTERVALS.map((hours) => s.literal(String(hours)).transform(() => hours))),
	),
});

/**
 * The refusal a submission outside the offered cadences earns, which is the one the store
 * reports for the same value, so both arrive at the page through a single branch.
 */
const REFUSED_INTERVAL: UserStore.IntervalResult = { ok: false, reason: "invalid-interval" };

/**
 * Renders the preferences form.
 *
 * @param ctx - The request being answered, whose query decides whether the saved note shows.
 * @param settings - The reader's stored preferences, or `null` before a sign-in wrote them.
 * @param error - Why the last submission was refused, or `null` for a page nobody submitted.
 */
function settingsPage(
	ctx: RequestContext,
	settings: UserStore.Settings | null,
	error: string | null,
) {
	/** The first offered cadence is what the `settings` column itself defaults to. */
	let selected = settings?.refreshIntervalHours ?? REFRESH_INTERVALS[0];

	let lastRefreshed =
		settings?.lastRefreshedAt == null
			? ctx.i18next.t("settings.neverRefreshed")
			: ctx.i18next.t("settings.lastRefreshed", {
					date: new Intl.DateTimeFormat(ctx.locale).format(settings.lastRefreshedAt),
				});

	return ctx.render(
		<AppLayout
			documentTitle={ctx.i18next.t("settings.title")}
			heading={ctx.i18next.t("settings.heading")}
			current="settings"
			locale={ctx.locale}
			nav={{
				label: ctx.i18next.t("nav.label"),
				reading: ctx.i18next.t("nav.reading"),
				feeds: ctx.i18next.t("nav.feeds"),
				settings: ctx.i18next.t("nav.settings"),
				logout: ctx.i18next.t("nav.logout"),
			}}
		>
			{ctx.url.searchParams.has(SAVED_PARAM) && (
				<Alert color="success">
					<Alert.Content>
						<Alert.Description>{ctx.i18next.t("settings.refresh.saved")}</Alert.Description>
					</Alert.Content>
				</Alert>
			)}

			<Card mix={[p(4)]}>
				<form method="post" action={routes.settings.action.href()} mix={[vstack({ gap: 4 })]}>
					<fieldset mix={[border("none"), m(0), p(0)]}>
						<legend id={LEGEND_ID} mix={[p(0), pb(2), text("sm"), weight("semibold")]}>
							{ctx.i18next.t("settings.refresh.legend")}
						</legend>

						<div mix={[vstack({ gap: 3 })]}>
							<Description id={DESCRIPTION_ID}>
								{ctx.i18next.t("settings.refresh.description")}
							</Description>

							<RadioGroup
								name="refreshIntervalHours"
								aria-labelledby={LEGEND_ID}
								aria-describedby={DESCRIPTION_ID}
							>
								{REFRESH_INTERVALS.map((hours) => (
									<RadioGroup.Radio
										key={hours}
										value={String(hours)}
										defaultChecked={hours === selected}
									>
										{ctx.i18next.t("settings.interval", { count: hours })}
									</RadioGroup.Radio>
								))}
							</RadioGroup>

							{error && <FieldError>{error}</FieldError>}
						</div>
					</fieldset>

					<div mix={[flex()]}>
						<Button type="submit">{ctx.i18next.t("settings.refresh.submit")}</Button>
					</div>
				</form>
			</Card>

			<Text mix={[text("sm"), fg("neutral.muted")]}>{lastRefreshed}</Text>
		</AppLayout>,
		error ? { status: UNPROCESSABLE_STATUS } : undefined,
	);
}

export default createController(routes.settings, {
	middleware: [requireUser],
	actions: {
		/** GET /settings — the preferences form. */
		async index(ctx) {
			let viewer = getViewer();

			/** The guard has already answered an anonymous request, so this holds a reader's id. */
			if (!viewer) return redirect(routes.home.href(), { status: redirect.Status.SeeOther });

			return settingsPage(ctx, await userStore(viewer.id).getSettings(), null);
		},

		/**
		 * POST /settings — saves the refresh cadence. Success answers with a redirect rather
		 * than the page, so the browser's next reload asks for the form instead of resubmitting.
		 */
		async action(ctx) {
			let viewer = getViewer();

			if (!viewer) return redirect(routes.home.href(), { status: redirect.Status.SeeOther });

			let store = userStore(viewer.id);
			let submitted = s.parseSafe(RefreshIntervalForm, ctx.formData);

			let saved = submitted.success
				? await store.setRefreshInterval(submitted.value.refreshIntervalHours)
				: REFUSED_INTERVAL;

			if (saved.ok) {
				return redirect(`${routes.settings.index.href()}?${SAVED_PARAM}`, {
					status: redirect.Status.SeeOther,
				});
			}

			return settingsPage(
				ctx,
				await store.getSettings(),
				ctx.i18next.t("settings.refresh.invalid"),
			);
		},
	},
});
