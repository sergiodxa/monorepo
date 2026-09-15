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
import { border, fg } from "@sdxc/u/color";
import { flex, flexWrap, gap, items, vstack } from "@sdxc/u/layout";
import { m, p, pb } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import {
	Alert,
	Button,
	Card,
	Description,
	FieldError,
	FileTrigger,
	Heading,
	LinkButton,
	RadioGroup,
	Text,
} from "@sdxc/ui";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createController } from "remix/router";

import type { UserStore } from "~/database/user-do";

import { FILE_FIELD, IMPORTED_PARAM } from "~/app/http/controllers/feeds/import";
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
	let selected = settings?.refreshIntervalHours ?? REFRESH_INTERVALS[0];

	let transfer = importNote(ctx);

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
				search: ctx.i18next.t("nav.search"),
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

			{transfer && (
				<Alert color={transfer.color}>
					<Alert.Content>
						<Alert.Description>{transfer.message}</Alert.Description>
					</Alert.Content>
				</Alert>
			)}

			{/**
			 * Taking the subscription list out and bringing another one in are the same errand
			 * read in two directions, so they share a card. The picker and its submit wrap, so a
			 * phone stacks them rather than pinching both into one line.
			 */}
			<Card mix={[p(4)]}>
				<div mix={[vstack({ gap: 4 })]}>
					{/** Level 2, since the layout's own page heading is the document's only `h1`. */}
					<Heading level={2} mix={[text("sm"), weight("semibold")]}>
						{ctx.i18next.t("feeds.transfer.legend")}
					</Heading>

					<div mix={[flex()]}>
						<LinkButton href={routes.feeds.export.href()} color="neutral" variant="ghost" size="sm">
							{ctx.i18next.t("feeds.transfer.export")}
						</LinkButton>
					</div>

					{/**
					 * `multipart/form-data` is the encoding that carries a file's bytes along with
					 * the field naming it; url-encoding sends the name the reader picked it under
					 * and leaves the document itself on their disk.
					 *
					 * The picker stays optional so an empty submit reaches the import, which answers
					 * it with the sentence asking for a file. The input behind the trigger is
					 * visually hidden, and the browser's own validation would anchor its message to
					 * a control the reader cannot see.
					 */}
					<form
						method="post"
						action={routes.feeds.import.href()}
						encType="multipart/form-data"
						mix={[vstack({ gap: 2, align: "stretch" })]}
					>
						<div mix={[flex(), items("center"), flexWrap("wrap"), gap(2)]}>
							<FileTrigger
								name={FILE_FIELD}
								accept={IMPORT_ACCEPT}
								color="neutral"
								variant="outline"
								size="sm"
								aria-describedby={IMPORT_DESCRIPTION_ID}
							>
								{ctx.i18next.t("feeds.transfer.import.label")}
							</FileTrigger>

							<Button type="submit" color="neutral" variant="outline" size="sm">
								{ctx.i18next.t("feeds.transfer.import.submit")}
							</Button>
						</div>

						<Description id={IMPORT_DESCRIPTION_ID} mix={[text("xs")]}>
							{ctx.i18next.t("feeds.transfer.import.description")}
						</Description>
					</form>
				</div>
			</Card>
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
