/**
 * Settings controller for `/settings`: the GET shows the reader's preferences and the POST
 * saves them. A saved cadence redirects back to the form carrying `?saved`, so the page the
 * browser lands on is a fresh read and refreshing it asks for the form again.
 *
 * Carrying subscriptions in and out belongs to the account rather than to any one view of
 * the list, so both transfers live here, and an import returns to this page with what
 * became of the document it was handed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { redirect } from "@sdxc/http/response";
import { bg, border, borderEdge, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor } from "@sdxc/u/general";
import { flex, flexWrap, gap, items, vstack } from "@sdxc/u/layout";
import { m, maxIs, mbs, mie, pb, pbs, pi } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";
import { Alert, Button, Description, FieldError, Label, LinkButton, Select, Text } from "@sdxc/ui";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createController } from "remix/router";

import type { UserStore } from "~/database/user-do";

import { FILE_FIELD, IMPORTED_PARAM } from "~/app/http/controllers/feeds/import";
import { exactDate, shortDate } from "~/app/http/controllers/timeline-entries";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { REFRESH_INTERVALS } from "~/database/schema";
import { userStore } from "~/database/user-do";
import AppLayout, { PAGE_COLUMN } from "~/resources/layouts/app";
import routes from "~/routes/web";

/**
 * The query parameter a saved cadence redirects back with, carrying the success across a
 * redirect that would otherwise arrive as an ordinary view of the form.
 */
const SAVED_PARAM = "saved";

/** Status for a submission the offered cadences do not include. */
const UNPROCESSABLE_STATUS = 422;

/** Ties the cadence field to the label naming it and the passage explaining it. */
const CADENCE_FIELD_ID = "settings-refresh-interval";
const DESCRIPTION_ID = "settings-refresh-description";

/**
 * Width of the cadence field, sized to the longest phrase it holds. A field stretched
 * across the column would promise more than a choice between six words.
 */
const CADENCE_FIELD_WIDTH = "14rem";

/** Ties the import field to the label naming it. */
const IMPORT_FILE_ID = "settings-import-file";

/** Ties the file picker to the passage saying what it is asking for. */
const IMPORT_DESCRIPTION_ID = "settings-import-description";

/**
 * What the file picker offers first: the extension a subscription list is exported under,
 * and the media types a reader's own export is served as.
 */
const IMPORT_ACCEPT = ".opml,.xml,application/xml,text/xml";

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
 * One count off an import's redirect, which reads as zero for a parameter that is absent
 * or is something other than a count.
 *
 * @param params - The query the page was asked for with.
 * @param name - The parameter holding the count.
 */
function importedCount(params: URLSearchParams, name: string): number {
	let raw = params.get(name);
	if (raw === null || !/^\d+$/.test(raw)) return 0;
	return Number.parseInt(raw, 10);
}

/**
 * The copy and tone for the outcome an import redirect carries, or `null` for an ordinary
 * view of the page and for a value this page has no sentence for.
 *
 * A document that was read and handed to the store succeeded, so it reads as a success
 * whatever the store then made of it: an import of fifty feeds that followed forty-seven
 * leads with the forty-seven and reports the three alongside.
 *
 * @param ctx - The request's dictionary and the query it arrived with.
 */
function importNote(
	ctx: RequestContext,
): { message: string; color: "success" | "warning" | "danger" } | null {
	let imported = ctx.url.searchParams.get(IMPORTED_PARAM);

	if (imported === "done") {
		let following = importedCount(ctx.url.searchParams, "following");
		let failed = importedCount(ctx.url.searchParams, "failed");

		let sentences = [
			ctx.i18next.t("feeds.transfer.import.added", {
				count: importedCount(ctx.url.searchParams, "added"),
			}),
		];

		if (following > 0) {
			sentences.push(ctx.i18next.t("feeds.transfer.import.alreadyFollowing", { count: following }));
		}

		if (failed > 0) {
			sentences.push(ctx.i18next.t("feeds.transfer.import.failed", { count: failed }));
		}

		return { message: sentences.join(" "), color: "success" };
	}

	/** A document that holds no subscriptions left the reader where they were, intact. */
	if (imported === "empty") {
		return { message: ctx.i18next.t("feeds.transfer.import.empty"), color: "warning" };
	}

	/** The upload was refused outright, which is the one outcome that cost the reader a step. */
	if (imported === "unreadable") {
		return { message: ctx.i18next.t("feeds.transfer.import.unreadable"), color: "danger" };
	}

	/** Refused on size alone, so the message says what a subscription list actually weighs. */
	if (imported === "too-large") {
		return { message: ctx.i18next.t("feeds.transfer.import.tooLarge"), color: "danger" };
	}

	/** The form is a file short, which the reader fixes by choosing one below. */
	if (imported === "missing") {
		return { message: ctx.i18next.t("feeds.transfer.import.missing"), color: "warning" };
	}

	return null;
}

/**
 * Renders the preferences form.
 *
 * @param ctx - The request being answered, whose query decides whether the saved cadence
 * and the outcome of an import are reported.
 * @param settings - The reader's stored preferences, or `null` before a sign-in wrote them.
 * @param error - Why the last submission was refused, or `null` for a page nobody submitted.
 */
function settingsPage(
	ctx: RequestContext,
	settings: UserStore.Settings | null,
	error: string | null,
) {
	/** The first offered cadence is what the `settings` column itself defaults to. */
	let chosen = settings?.refreshIntervalHours ?? REFRESH_INTERVALS[0];

	let transfer = importNote(ctx);

	/**
	 * How long ago the schedule above last ran, in the words every other date in the app is
	 * read in, with the exact one a pointer's breath away.
	 */
	let lastRefreshed =
		settings?.lastRefreshedAt == null
			? { short: ctx.i18next.t("settings.neverRefreshed"), exact: undefined }
			: {
					short: ctx.i18next.t("settings.lastRefreshed", {
						date: shortDate(settings.lastRefreshedAt, ctx.locale, Date.now()),
					}),
					exact: ctx.i18next.t("settings.lastRefreshed", {
						date: exactDate(settings.lastRefreshedAt, ctx.locale),
					}),
				};

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
				search: ctx.i18next.t("nav.search"),
				settings: ctx.i18next.t("nav.settings"),
				logout: ctx.i18next.t("nav.logout"),
			}}
		>
			{/**
			 * A sentence in a box is still a sentence, so the news keeps the measure the page is
			 * read in rather than running the width of a window.
			 */}
			{ctx.url.searchParams.has(SAVED_PARAM) && (
				<Alert color="success" mix={[maxIs(PAGE_COLUMN)]}>
					<Alert.Content>
						<Alert.Description>{ctx.i18next.t("settings.refresh.saved")}</Alert.Description>
					</Alert.Content>
				</Alert>
			)}

			{/**
			 * The preferences sit on the page itself, the way a post and a feed do: a heading, the
			 * fields under it, and the rule to the next section doing the work a panel's edge used
			 * to.
			 *
			 * The page takes the width every page takes, and the form keeps the measure a sentence
			 * is read in and a field is filled at, which is the width it wants wherever it appears.
			 */}
			<form
				method="post"
				action={routes.settings.action.href()}
				mix={[vstack({ gap: 4 }), maxIs(PAGE_COLUMN)]}
			>
				<div mix={[vstack({ gap: 3 })]}>
					<div mix={[vstack({ gap: 1 })]}>
						<Label htmlFor={CADENCE_FIELD_ID}>{ctx.i18next.t("settings.refresh.legend")}</Label>

						<Description id={DESCRIPTION_ID}>
							{ctx.i18next.t("settings.refresh.description")}
						</Description>
					</div>

					{/**
					 * One field rather than six rows: the cadences are a single choice, and the one
					 * in force is what the page has to show. A list of them spent half the page on a
					 * decision most readers make once.
					 */}
					{/** The field fills whatever box it is given, so the box is what sizes it. */}
					<div mix={[maxIs(CADENCE_FIELD_WIDTH)]}>
						<Select
							id={CADENCE_FIELD_ID}
							name="refreshIntervalHours"
							aria-describedby={DESCRIPTION_ID}
						>
							{REFRESH_INTERVALS.map((hours) => (
								<Select.Option key={hours} value={String(hours)} selected={hours === chosen}>
									{ctx.i18next.t("settings.interval", { count: hours })}
								</Select.Option>
							))}
						</Select>
					</div>

					{error && <FieldError>{error}</FieldError>}

					{/**
					 * When the schedule last ran is the schedule's own news, so it sits under the
					 * cadence it reports on, quiet as the dates down the side of a list of posts.
					 */}
					<Text mix={[text("xs"), fg("neutral.muted")]} title={lastRefreshed.exact}>
						{lastRefreshed.short}
					</Text>
				</div>

				<div mix={[flex()]}>
					<Button type="submit">{ctx.i18next.t("settings.refresh.submit")}</Button>
				</div>
			</form>

			{transfer && (
				<Alert color={transfer.color} mix={[maxIs(PAGE_COLUMN)]}>
					<Alert.Content>
						<Alert.Description>{transfer.message}</Alert.Description>
					</Alert.Content>
				</Alert>
			)}

			{/**
			 * Taking the subscription list out and bringing another one in are the same errand read
			 * in two directions, so they share a section. A hairline is what says the cadences above
			 * have ended, which is the boundary the rest of the app draws between one thing and the
			 * next.
			 */}
			<section
				mix={[
					vstack({ gap: 4 }),
					pbs(6),
					borderEdge("block-start", { color: "neutral.border", width: 1 }),
				]}
			>
				{/**
				 * Level 2, since the layout's own page heading is the document's only `h1`. It is set
				 * as the legend above it is, so the two sections are named in the same voice.
				 */}
				<h2 mix={[m(0), text("sm"), weight("medium"), fg("neutral.emphasis")]}>
					{ctx.i18next.t("feeds.transfer.legend")}
				</h2>

				{/** Outlined rather than quiet: a bare label reads as a sentence, not as the
				 * control that hands a reader a file. */}
				<div mix={[flex()]}>
					<LinkButton
						href={routes.feeds.export.href()}
						color="neutral"
						variant="outline"
						data-rmx-document=""
					>
						{ctx.i18next.t("feeds.transfer.export")}
					</LinkButton>
				</div>

				{/**
				 * `multipart/form-data` is the encoding that carries a file's bytes along with the
				 * field naming it; url-encoding sends the name the reader picked it under and leaves
				 * the document itself on their disk.
				 *
				 * The picker stays optional so an empty submit reaches the import, which answers it
				 * with the sentence asking for a file.
				 */}
				<form
					method="post"
					action={routes.feeds.import.href()}
					encType="multipart/form-data"
					mix={[vstack({ gap: 3, align: "start" }), mbs(2), maxIs(PAGE_COLUMN)]}
				>
					{/** Ahead of the controls, so it is read before a file is chosen rather than
					 * after. */}
					<Description id={IMPORT_DESCRIPTION_ID}>
						{ctx.i18next.t("feeds.transfer.import.description")}
					</Description>

					<div mix={[vstack({ gap: 2, align: "start" }), maxIs("100%")]}>
						<Label htmlFor={IMPORT_FILE_ID}>{ctx.i18next.t("feeds.transfer.import.label")}</Label>

						{/** The picker and the submit on one line, wrapping onto two where a phone
						 * has room for one control at a time. */}
						<div mix={[flex(), items("center"), flexWrap("wrap"), gap(2), maxIs("100%")]}>
							{/**
							 * A native file input rather than a styled trigger. The trigger hides the
							 * input behind a button-like label, so nothing on the page says which file was
							 * chosen — and without script there is nothing to say it with. The platform's
							 * own control names the file it holds.
							 */}
							<input
								id={IMPORT_FILE_ID}
								type="file"
								name={FILE_FIELD}
								accept={IMPORT_ACCEPT}
								aria-describedby={IMPORT_DESCRIPTION_ID}
								mix={[
									maxIs("100%"),
									text("sm"),
									fg("neutral.muted"),
									cursor("pointer"),
									/**
									 * The platform draws this control, and only its button half can be
									 * restyled — which is the half worth restyling. Dressed in the box the
									 * outline buttons on this page wear, down to the leading that decides
									 * their height, it stands level with the submit beside it and the pair
									 * reads as one control; the filename the browser writes sits between
									 * them, which is the whole reason for using the real input.
									 */
									when("&::file-selector-button", [
										mie(3),
										pi(4),
										pb(2),
										rounded("md"),
										border({ color: "neutral.strong", width: 2 }),
										bg("transparent"),
										fg("neutral"),
										text("sm"),
										weight("medium"),
										cursor("pointer"),
									]),
									when("&:hover::file-selector-button", bg("neutral.tint")),
								]}
							/>

							<Button type="submit">{ctx.i18next.t("feeds.transfer.import.submit")}</Button>
						</div>
					</div>
				</form>
			</section>
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
