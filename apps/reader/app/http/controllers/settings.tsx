/**
 * Settings controller for `GET /settings`: what the account does on the reader's behalf,
 * and the two ways their subscription list travels.
 *
 * How often feeds are checked is said here rather than chosen here. A feed is one document
 * with one schedule however many people follow it, so there is no reader to ask, and a
 * setting whose only effect is to fetch a publisher's document more often spends somebody
 * else's bandwidth for an answer the reader cannot see. Every feed is checked once a day,
 * and the check a reader can ask for on a feed's own page is what they have when they want
 * one sooner.
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
import { Alert, Button, Description, Label, LinkButton, Text } from "@sdxc/ui";
import { createAction } from "remix/router";

import type { Tier } from "~/app/lib/entitlement";
import type { UserStore } from "~/database/user-do";

import { chrome } from "~/app/http/controllers/chrome";
import { FILE_FIELD, IMPORTED_PARAM } from "~/app/http/controllers/feeds/import";
import { exactDate, shortDate } from "~/app/http/controllers/timeline-entries";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { overBy, TIERS, tierRank } from "~/app/lib/entitlement";
import { userStore } from "~/database/user-do";
import AppLayout, { PAGE_COLUMN, pageNote } from "~/resources/layouts/app";
import routes from "~/routes/web";

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
 * The tiers a reader can move up to from where they are, which is what the panel offers a
 * button for. A reader on the top tier is offered nothing, and the manage link is what
 * they have instead.
 *
 * @param tier - The tier the reader is on.
 */
function upgradesFrom(tier: Tier): Tier[] {
	return TIERS.filter((offered) => tierRank(offered) > tierRank(tier));
}

/**
 * Renders the page.
 *
 * @param ctx - The request being answered, whose query says what an import made of the
 * document it was handed.
 * @param settings - The reader's stored preferences, or `null` before a sign-in wrote them.
 * @param entitlement - What their plan allows, and where they stand against it.
 */
async function settingsPage(
	ctx: RequestContext,
	settings: UserStore.Settings | null,
	entitlement: UserStore.Entitlement,
) {
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
			locale={ctx.locale}
			{...await chrome(ctx)}
		>
			{/**
			 * What the app does on the reader's behalf, said in the place they would have come
			 * looking for a switch. The sentence points at the check they can ask for on a feed's
			 * own page, which is the whole of what is left to act on here.
			 *
			 * It keeps the measure a sentence is read in rather than running the width of a
			 * window, which is the width every other passage on this page takes.
			 */}
			<section mix={[vstack({ gap: 1 }), maxIs(PAGE_COLUMN)]}>
				{/** Level 2, since the layout's own page heading is the document's only `h1`. */}
				<h2 mix={[m(0), text("sm"), weight("medium"), fg("neutral.emphasis")]}>
					{ctx.i18next.t("settings.cadence.legend")}
				</h2>

				<Description>{ctx.i18next.t("settings.cadence.description")}</Description>

				{/**
				 * When the feeds were last brought up to date is the schedule's own news, so it sits
				 * under the sentence describing it, quiet as the dates down the side of a list of
				 * posts.
				 */}
				<Text mix={[text("xs"), fg("neutral.muted")]} title={lastRefreshed.exact}>
					{lastRefreshed.short}
				</Text>
			</section>

			{/**
			 * What the reader is on, what it allows, and where they stand against it. It sits
			 * above the transfers because it is the one section on this page whose numbers can
			 * be refusing something right now.
			 */}
			<section
				mix={[
					vstack({ gap: 3 }),
					maxIs(PAGE_COLUMN),
					pbs(6),
					borderEdge("block-start", { color: "neutral.border", width: 1 }),
				]}
			>
				{/** Level 2, since the layout's own page heading is the document's only `h1`. */}
				<h2 mix={[m(0), text("sm"), weight("medium"), fg("neutral.emphasis")]}>
					{ctx.i18next.t("settings.plan.legend")}
				</h2>

				<Description>
					{ctx.i18next.t("settings.plan.current", {
						plan: ctx.i18next.t(`settings.plan.names.${entitlement.tier}`),
					})}{" "}
					{ctx.i18next.t("settings.plan.allowance", {
						feeds: entitlement.limits.feeds,
						saved: entitlement.limits.saved,
						posts: entitlement.limits.posts,
					})}{" "}
					{ctx.i18next.t("settings.plan.history")}
				</Description>

				<Text mix={[text("xs"), fg("neutral.muted")]}>
					{ctx.i18next.t("settings.plan.usage", {
						feeds: entitlement.feeds,
						saved: entitlement.saved,
					})}
				</Text>

				{/**
				 * A failed card, said on the day it fails and not acted on. Nothing has changed,
				 * and the way out is the platform's own page rather than anything on this one.
				 */}
				{entitlement.graceUntil !== null && (
					<Alert color="warning">
						<Alert.Content>
							<Alert.Description>{ctx.i18next.t("settings.plan.lapsed")}</Alert.Description>
						</Alert.Content>
					</Alert>
				)}

				{/**
				 * Every limit the reader is over, one sentence each, each naming the two ways out
				 * and neither of them a deletion this app would perform. There is no countdown,
				 * because nothing is going to be deleted.
				 */}
				{entitlement.over.length > 0 && (
					<Alert color="warning">
						<Alert.Content>
							<Alert.Description>
								{ctx.i18next.t("settings.plan.over.description")}
							</Alert.Description>

							{entitlement.over.map((refusal) => (
								<Alert.Description key={refusal.limit}>
									{ctx.i18next.t(`settings.plan.over.${refusal.limit}`, {
										count: overBy(refusal),
									})}
								</Alert.Description>
							))}
						</Alert.Content>
					</Alert>
				)}

				<div mix={[flex(), flexWrap("wrap"), gap(2), items("center")]}>
					{upgradesFrom(entitlement.tier).map((offered) => (
						<form
							key={offered}
							method="post"
							action={routes.billing.checkout.href({ plan: offered })}
						>
							<Button type="submit">
								{ctx.i18next.t("settings.plan.upgrade", {
									plan: ctx.i18next.t(`settings.plan.names.${offered}`),
								})}
							</Button>
						</form>
					))}

					{/**
					 * Offered only to a reader the platform holds a record for, since there is no
					 * page to open for somebody who has never bought anything.
					 */}
					{entitlement.tier !== "free" && (
						<form method="post" action={routes.billing.portal.href()}>
							<Button type="submit" color="neutral" variant="outline">
								{ctx.i18next.t("settings.plan.manage")}
							</Button>
						</form>
					)}
				</div>
			</section>

			{transfer && (
				<Alert color={transfer.color} mix={[maxIs(PAGE_COLUMN), ...pageNote()]}>
					<Alert.Content>
						<Alert.Description>{transfer.message}</Alert.Description>
					</Alert.Content>
				</Alert>
			)}

			{/**
			 * Taking the subscription list out and bringing another one in are the same errand read
			 * in two directions, so they share a section. A hairline is what says the passage above
			 * has ended, which is the boundary the rest of the app draws between one thing and the
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
	);
}

/** GET /settings — what the account does on the reader's behalf, and their OPML transfers. */
export default createAction(routes.settings, {
	middleware: [requireUser],
	async handler(ctx) {
		let viewer = getViewer();

		/** The guard has already answered an anonymous request, so this holds a reader's id. */
		if (!viewer) return redirect(routes.home.href(), { status: redirect.Status.SeeOther });

		let store = userStore(viewer.id);
		let [settings, entitlement] = await Promise.all([store.getSettings(), store.entitlement()]);

		return await settingsPage(ctx, settings, entitlement);
	},
});
