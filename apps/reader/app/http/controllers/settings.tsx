/**
 * Settings controller for `GET /settings`: what the account does on the reader's behalf,
 * and the two ways their subscription list travels. How often feeds are checked is said
 * here rather than chosen here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { iife } from "@sdxc/iife";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor } from "@sdxc/u/general";
import { flex, flexWrap, gap, items, vstack } from "@sdxc/u/layout";
import { maxIs, mie, p, pb, pi } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";
import { Alert, Button, Checkbox, LinkButton, Select, Text } from "@sdxc/ui";
import { SettingsLayout } from "@sdxc/ui/app/settings-layout";
import { SettingsSection } from "@sdxc/ui/app/settings-section";
import { createAction } from "remix/router";

import type { Presentation } from "~/app/initializers/cookies";
import type { AppContext } from "~/app/initializers/router";
import type { UserStore } from "~/app/models/user-store";
import type { Tier } from "~/app/services/entitlement";

import { APPEARANCE_PARAM, FACE_FIELD, THEME_FIELD } from "~/app/http/controllers/appearance";
import { chrome } from "~/app/http/controllers/chrome";
import { FILE_FIELD, IMPORTED_PARAM } from "~/app/http/controllers/feeds/import";
import {
	CHANNELS_PARAM,
	EMAIL_FIELD,
	PUSH_FIELD,
} from "~/app/http/controllers/notifications/channels";
import { FORGET_PARAM } from "~/app/http/controllers/notifications/forget";
import {
	QUIET_ENABLED_FIELD,
	QUIET_FROM_FIELD,
	QUIET_PARAM,
	QUIET_TO_FIELD,
} from "~/app/http/controllers/notifications/quiet-hours";
import { exactDate, shortDate } from "~/app/http/controllers/timeline-entries";
import tokensSection from "~/app/http/controllers/tokens/section";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { writePresentation } from "~/app/initializers/cookies";
import { vapidPublicKey } from "~/app/initializers/vapid";
import { userStore } from "~/app/models/user-store";
import { overBy, TIERS, tierRank } from "~/app/services/entitlement";
import { POLL_FLOOR_MS } from "~/database/feed-schema";
import { READING_FACES, THEMES } from "~/database/schema";
import { formatInterval } from "~/resources/components/marketing/scenes";
import { PushRegistration } from "~/resources/components/push-registration";
import {
	anchoredSections,
	SETTINGS_ANCHORS,
	SettingsNote,
	SettingsPhoneNav,
	settingsNav,
} from "~/resources/components/settings-area";
import AppLayout from "~/resources/layouts/app";
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

/** The tone an outcome note is drawn in, matching how much it cost the reader. */
interface Note {
	message: string;
	color: "success" | "warning" | "danger";
}

/**
 * One count off an import's redirect, which reads as zero for a parameter that is absent
 * or is something other than a count.
 *
 * @param params - The query the page was asked for with.
 * @param name - The parameter holding the count.
 */
function importedCount(params: URLSearchParams, name: string): number {
	let value = params.get(name);
	if (value === null || !/^\d+$/.test(value)) return 0;
	return Number.parseInt(value, 10);
}

/**
 * The copy and tone for the outcome an import redirect carries, or `null` for an ordinary
 * view of the page and for a value this page has no sentence for.
 *
 * @param ctx - The request's dictionary and the query it arrived with.
 */
function importNote(ctx: AppContext): Note | null {
	let imported = ctx.url.searchParams.get(IMPORTED_PARAM);

	if (imported === "done") {
		let following = importedCount(ctx.url.searchParams, "following");
		let failed = importedCount(ctx.url.searchParams, "failed");

		let sentences = [
			ctx.intl.t("feeds.transfer.import.added", {
				count: importedCount(ctx.url.searchParams, "added"),
			}),
		];

		if (following > 0) {
			sentences.push(ctx.intl.t("feeds.transfer.import.alreadyFollowing", { count: following }));
		}

		if (failed > 0) {
			sentences.push(ctx.intl.t("feeds.transfer.import.failed", { count: failed }));
		}

		/** Left out by the plan rather than by the site, which is the one a reader can change. */
		let overLimit = importedCount(ctx.url.searchParams, "overLimit");
		if (overLimit > 0) {
			sentences.push(ctx.intl.t("feeds.transfer.import.overLimit", { count: overLimit }));
		}

		return { message: sentences.join(" "), color: overLimit > 0 ? "warning" : "success" };
	}

	/** A document that holds no subscriptions left the reader where they were, intact. */
	if (imported === "empty") {
		return { message: ctx.intl.t("feeds.transfer.import.empty"), color: "warning" };
	}

	/** The upload was refused outright, which is the one outcome that cost the reader a step. */
	if (imported === "unreadable") {
		return { message: ctx.intl.t("feeds.transfer.import.unreadable"), color: "danger" };
	}

	/** Refused on size alone, so the message says what a subscription list actually weighs. */
	if (imported === "too-large") {
		return { message: ctx.intl.t("feeds.transfer.import.tooLarge"), color: "danger" };
	}

	/** The form is a file short, which the reader fixes by choosing one below. */
	if (imported === "missing") {
		return { message: ctx.intl.t("feeds.transfer.import.missing"), color: "warning" };
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

/** Ties the scheme picker to the label naming it. */
const THEME_ID = "settings-theme";

/** Ties the reading-face picker to its own label, beside the scheme. */
const FACE_ID = "settings-face";

/** Ties the push switch to the row naming it. */
const PUSH_ID = "settings-push";

/** Ties the email switch to the row naming it. */
const EMAIL_ID = "settings-email";

/** Ties the quiet-hours switch to the row naming it. */
const QUIET_ENABLED_ID = "settings-quiet-enabled";

/** Ties the quiet-hours selects to the switch above them. */
const QUIET_FROM_ID = "settings-quiet-from";

/** Ties the closing hour to its own label, beside the opening one. */
const QUIET_TO_ID = "settings-quiet-to";

/** Every hour of the day, which is the whole of what a quiet window is chosen from. */
const HOURS = Array.from({ length: 24 }, (_unused, hour) => hour);

/**
 * Draws a note inside the card of the section it is about, or nothing for no note.
 *
 * @param note - The outcome to say, if any.
 */
function noteBlock(note: Note | null) {
	if (note === null) return null;

	return (
		<SettingsNote color={note.color}>
			<Alert.Description>{note.message}</Alert.Description>
		</SettingsNote>
	);
}

/**
 * What the reader is on, what it allows, and where they stand against it. It leads the
 * page because it is the one section whose numbers can be refusing something right now.
 *
 * @param ctx - The request being answered.
 * @param entitlement - What their plan allows, and where they stand against it.
 */
function planSection(ctx: AppContext, entitlement: UserStore.Entitlement) {
	return (
		<SettingsSection
			id={SETTINGS_ANCHORS.plan}
			title={ctx.intl.t("settings.plan.legend")}
			description={[
				ctx.intl.t("settings.plan.current", {
					plan: ctx.intl.t(`settings.plan.names.${entitlement.tier}`),
				}),
				ctx.intl.t("settings.plan.allowance", {
					feeds: entitlement.limits.feeds,
					saved: entitlement.limits.saved,
					posts: entitlement.limits.posts,
				}),
				ctx.intl.t("settings.plan.history"),
				ctx.intl.t("settings.plan.includes"),
			].join(" ")}
			save="instant"
			labels={{ save: ctx.intl.t("settings.appearance.save") }}
		>
			{/**
			 * A failed card, said on the day it fails and not acted on. Nothing has changed,
			 * and the way out is the platform's own page rather than anything on this one.
			 */}
			{entitlement.graceUntil !== null && (
				<SettingsNote color="warning">
					<Alert.Description>{ctx.intl.t("settings.plan.lapsed")}</Alert.Description>
				</SettingsNote>
			)}

			{/**
			 * Every limit the reader is over, one sentence each, each naming the two ways out
			 * and neither of them a deletion this app would perform. There is no countdown,
			 * because nothing is going to be deleted.
			 */}
			{entitlement.over.length > 0 && (
				<SettingsNote color="warning">
					<Alert.Description>{ctx.intl.t("settings.plan.over.description")}</Alert.Description>

					{entitlement.over.map((refusal) => (
						<Alert.Description key={refusal.limit}>
							{ctx.intl.t(`settings.plan.over.${refusal.limit}`, {
								count: overBy(refusal),
							})}
						</Alert.Description>
					))}
				</SettingsNote>
			)}

			{/**
			 * Each checkout is its own form, and the forms stay flex items so the buttons
			 * share one cross-axis size on the title line; several wrap under the label on
			 * a phone.
			 */}
			<SettingsSection.Row
				layout="action"
				label={ctx.intl.t("settings.plan.usageLabel")}
				description={ctx.intl.t("settings.plan.usage", {
					feeds: entitlement.feeds,
					saved: entitlement.saved,
				})}
			>
				<div mix={[flex(), flexWrap("wrap"), gap(2), items("center")]}>
					{upgradesFrom(entitlement.tier).map((offered) => (
						<form
							key={offered}
							method="post"
							action={routes.billing.checkout.href({ plan: offered })}
							mix={[flex(), items("center")]}
						>
							<Button type="submit" color="brand" size="sm">
								{ctx.intl.t("settings.plan.upgrade", {
									plan: ctx.intl.t(`settings.plan.names.${offered}`),
								})}
							</Button>
						</form>
					))}

					{/**
					 * Offered only to a reader the platform holds a record for, since there is no
					 * page to open for somebody who has never bought anything.
					 */}
					{entitlement.tier !== "free" && (
						<form
							method="post"
							action={routes.billing.portal.href()}
							mix={[flex(), items("center")]}
						>
							<Button type="submit" size="sm" color="neutral" variant="outline">
								{ctx.intl.t("settings.plan.manage")}
							</Button>
						</form>
					)}
				</div>
			</SettingsSection.Row>
		</SettingsSection>
	);
}

/**
 * How the reader's pages are painted, and the face the words they came here to read are
 * set in. A real form that posts and reloads, so a browser running no script changes
 * both; "Saved." is quiet text beside the button, where the reader just pressed.
 *
 * @param ctx - The request being answered, whose query says whether a submission landed.
 * @param current - What is stored for this reader, or what the cookie says before a sign-in has written a row.
 */
function appearanceSection(ctx: AppContext, current: Presentation) {
	let saved = ctx.url.searchParams.get(APPEARANCE_PARAM) === "saved";

	return (
		<SettingsSection
			id={SETTINGS_ANCHORS.appearance}
			title={ctx.intl.t("settings.appearance.legend")}
			description={ctx.intl.t("settings.appearance.description")}
			save="explicit"
			form={{ action: routes.appearance.href() }}
			labels={{ save: ctx.intl.t("settings.appearance.save") }}
			footer={
				saved ? (
					<Text role="status" mix={[text("sm"), fg("success")]}>
						{ctx.intl.t("settings.appearance.saved")}
					</Text>
				) : null
			}
		>
			<SettingsSection.Row label={ctx.intl.t("settings.appearance.theme.label")} htmlFor={THEME_ID}>
				<Select id={THEME_ID} name={THEME_FIELD}>
					{THEMES.map((name) => (
						<Select.Option key={name} value={name} selected={name === current.theme}>
							{ctx.intl.t(`settings.appearance.theme.names.${name}`)}
						</Select.Option>
					))}
				</Select>
			</SettingsSection.Row>

			<SettingsSection.Row
				label={ctx.intl.t("settings.appearance.face.label")}
				description={ctx.intl.t("settings.appearance.face.hint")}
				htmlFor={FACE_ID}
			>
				<Select id={FACE_ID} name={FACE_FIELD}>
					{READING_FACES.map((name) => (
						<Select.Option key={name} value={name} selected={name === current.face}>
							{ctx.intl.t(`settings.appearance.face.names.${name}`)}
						</Select.Option>
					))}
				</Select>
			</SettingsSection.Row>
		</SettingsSection>
	);
}

/**
 * The copy and tone for whatever a notification submission left in the query, filed under
 * the section the submission came from, so each outcome is read beside its own form.
 *
 * @param ctx - The request's dictionary and the query it arrived with.
 */
function notificationNotes(ctx: AppContext): {
	channels: Note | null;
	quiet: Note | null;
	devices: Note | null;
} {
	let params = ctx.url.searchParams;

	let channels = iife((): Note | null => {
		if (params.get(CHANNELS_PARAM) === "saved") {
			return { message: ctx.intl.t("notifications.channels.saved"), color: "success" };
		}
		/** The plan and the switch disagreed, so the page says so rather than drawing nothing. */
		if (params.get(CHANNELS_PARAM) === "not-entitled") {
			return { message: ctx.intl.t("notifications.channels.notEntitled"), color: "warning" };
		}
		return null;
	});

	let quiet: Note | null =
		params.get(QUIET_PARAM) === "saved"
			? { message: ctx.intl.t("notifications.quiet.saved"), color: "success" }
			: null;

	let devices = iife((): Note | null => {
		if (params.get(FORGET_PARAM) === "forgotten") {
			return { message: ctx.intl.t("notifications.devices.forgotten"), color: "success" };
		}
		if (params.get(FORGET_PARAM) === "missing") {
			return { message: ctx.intl.t("notifications.devices.missing"), color: "warning" };
		}
		return null;
	});

	return { channels, quiet, devices };
}

/**
 * How the reader is reached, when they are left alone, and which browsers are registered:
 * three sections, one per form, each saving on its own.
 *
 * A reader with feeds picked and no channel on is the one failure this surface exists to
 * prevent, so it is said here rather than left to an event nobody reads.
 *
 * @param ctx - The request being answered.
 * @param notifications - What the reader's own object holds about all of this.
 */
function notificationsSections(ctx: AppContext, notifications: UserStore.Notifications) {
	let notes = notificationNotes(ctx);
	let emailHint = iife(() => {
		if (!notifications.emailAllowed) return ctx.intl.t("notifications.channels.emailLocked");
		if (notifications.address)
			return ctx.intl.t("notifications.channels.emailHint", {
				address: notifications.address,
			});
		return ctx.intl.t("notifications.channels.emailUnknown");
	});
	let hourOptions = (selected: number) =>
		HOURS.map((hour) => (
			<Select.Option key={hour} value={String(hour)} selected={hour === selected}>
				{ctx.intl.t("notifications.quiet.hour", { hour })}
			</Select.Option>
		));

	return (
		<>
			<SettingsSection
				id={SETTINGS_ANCHORS.notifications}
				title={ctx.intl.t("notifications.legend")}
				description={ctx.intl.t("notifications.description")}
				save="explicit"
				form={{ action: routes.notifications.channels.href() }}
				labels={{ save: ctx.intl.t("notifications.channels.save") }}
			>
				{noteBlock(notes.channels)}

				{notifications.feeds === 0 && (
					<div mix={[p(4)]}>
						<Text mix={[text("sm"), fg("neutral.muted")]}>
							{ctx.intl.t("notifications.noFeeds")}
						</Text>
					</div>
				)}

				{/**
				 * A reader can end up with feeds picked and nothing to be reached on, believing they
				 * configured something. The object's own event finds them; this is what prevents it.
				 */}
				{notifications.feeds > 0 && !notifications.push && !notifications.email && (
					<SettingsNote color="warning">
						<Alert.Description>{ctx.intl.t("notifications.noChannel")}</Alert.Description>
					</SettingsNote>
				)}

				<SettingsSection.Row
					layout="inline-switch"
					label={ctx.intl.t("notifications.channels.push")}
					description={ctx.intl.t("notifications.channels.pushHint")}
					htmlFor={PUSH_ID}
				>
					<Checkbox id={PUSH_ID} name={PUSH_FIELD} defaultChecked={notifications.push} />
				</SettingsSection.Row>

				<SettingsSection.Row
					layout="inline-switch"
					label={ctx.intl.t("notifications.channels.email")}
					description={emailHint}
					htmlFor={EMAIL_ID}
				>
					<Checkbox
						id={EMAIL_ID}
						name={EMAIL_FIELD}
						defaultChecked={notifications.email}
						disabled={!notifications.emailAllowed}
					/>
				</SettingsSection.Row>
			</SettingsSection>

			<SettingsSection
				id="quiet-hours"
				title={ctx.intl.t("notifications.quiet.legend")}
				description={ctx.intl.t("notifications.quiet.description")}
				save="explicit"
				form={{ action: routes.notifications.quietHours.href() }}
				labels={{ save: ctx.intl.t("notifications.quiet.save") }}
				footer={
					<Text mix={[text("xs"), fg("neutral.muted")]}>
						{ctx.intl.t("notifications.quiet.zone", { zone: notifications.timeZone })}
					</Text>
				}
			>
				{noteBlock(notes.quiet)}

				<SettingsSection.Row
					layout="inline-switch"
					label={ctx.intl.t("notifications.quiet.enabled")}
					htmlFor={QUIET_ENABLED_ID}
				>
					<Checkbox
						id={QUIET_ENABLED_ID}
						name={QUIET_ENABLED_FIELD}
						defaultChecked={notifications.quietHours}
					/>
				</SettingsSection.Row>

				<SettingsSection.Row label={ctx.intl.t("notifications.quiet.from")} htmlFor={QUIET_FROM_ID}>
					<Select id={QUIET_FROM_ID} name={QUIET_FROM_FIELD}>
						{hourOptions(notifications.quietFrom)}
					</Select>
				</SettingsSection.Row>

				<SettingsSection.Row label={ctx.intl.t("notifications.quiet.to")} htmlFor={QUIET_TO_ID}>
					<Select id={QUIET_TO_ID} name={QUIET_TO_FIELD}>
						{hourOptions(notifications.quietTo)}
					</Select>
				</SettingsSection.Row>
			</SettingsSection>

			<div mix={[vstack({ gap: 3, align: "stretch" })]}>
				<SettingsSection
					id="devices"
					title={ctx.intl.t("notifications.devices.legend")}
					description={ctx.intl.t("notifications.devices.description")}
					save="instant"
					labels={{ save: ctx.intl.t("notifications.channels.save") }}
				>
					{noteBlock(notes.devices)}

					{notifications.devices.length === 0 ? (
						<div mix={[p(4)]}>
							<Text mix={[text("sm"), fg("neutral.muted")]}>
								{ctx.intl.t("notifications.devices.none")}
							</Text>
						</div>
					) : (
						notifications.devices.map((device) => (
							<SettingsSection.Row
								key={device.id}
								layout="inline-switch"
								label={device.userAgent ?? device.service}
								description={
									device.lastDeliveredAt === null
										? ctx.intl.t("notifications.devices.never")
										: ctx.intl.t("notifications.devices.delivered", {
												date: shortDate(device.lastDeliveredAt, ctx.locale, Date.now()),
											})
								}
							>
								{/**
								 * A method override rather than a `DELETE` a form cannot send, which is how
								 * every other revocation on this app's surface reaches its route.
								 */}
								<form
									method="post"
									action={routes.notifications.forget.href({ deviceId: device.id })}
								>
									<input type="hidden" name="_method" value="DELETE" />

									<Button type="submit" size="sm" color="neutral" variant="outline">
										{ctx.intl.t("notifications.devices.forget")}
									</Button>
								</form>
							</SettingsSection.Row>
						))
					)}
				</SettingsSection>

				{/**
				 * The zone and the endpoint are both things only a browser knows, so this is where
				 * they are asked for. It draws only the button that asks for permission, and a
				 * browser running no script never sees it and never registers a device.
				 */}
				<PushRegistration
					worker="/sw.js"
					devices={routes.notifications.devices.href()}
					timeZone={routes.notifications.timeZone.href()}
					vapidPublicKey={vapidPublicKey() ?? ""}
					storedTimeZone={notifications.timeZone}
					enabled={notifications.push}
					allow={ctx.intl.t("notifications.devices.allow")}
				/>
			</div>
		</>
	);
}

/**
 * Taking the subscription list out and bringing another one in are the same errand read
 * in two directions, so they share a section, with the import's outcome at its top.
 *
 * @param ctx - The request being answered, whose query says what an import made of the document it was handed.
 */
function transferSection(ctx: AppContext) {
	return (
		<SettingsSection
			id={SETTINGS_ANCHORS.data}
			title={ctx.intl.t("feeds.transfer.legend")}
			save="instant"
			labels={{ save: ctx.intl.t("feeds.transfer.import.submit") }}
		>
			{noteBlock(importNote(ctx))}

			<SettingsSection.Row label={ctx.intl.t("settings.data.export")}>
				{/** Outlined rather than quiet: a bare label reads as a sentence, not as the
				 * control that hands a reader a file. */}
				<div mix={[flex(), flexWrap("wrap"), gap(2)]}>
					<LinkButton
						href={routes.feeds.export.href()}
						color="neutral"
						variant="outline"
						size="sm"
						data-rmx-document=""
					>
						{ctx.intl.t("feeds.transfer.export")}
					</LinkButton>
					<LinkButton
						href={routes.dataExport.href()}
						color="neutral"
						variant="outline"
						size="sm"
						title={ctx.intl.t("feeds.transfer.exportAllDescription")}
						data-rmx-document=""
					>
						{ctx.intl.t("feeds.transfer.exportAll")}
					</LinkButton>
				</div>
			</SettingsSection.Row>

			<SettingsSection.Row
				label={ctx.intl.t("feeds.transfer.import.label")}
				description={ctx.intl.t("feeds.transfer.import.description")}
				descriptionId={IMPORT_DESCRIPTION_ID}
				htmlFor={IMPORT_FILE_ID}
			>
				{/**
				 * `multipart/form-data` is the encoding that carries a file's bytes along with the
				 * field naming it; url-encoding sends the name the reader picked it under and leaves
				 * the document itself on their disk.
				 */}
				<form
					method="post"
					action={routes.feeds.import.href()}
					encType="multipart/form-data"
					mix={[vstack({ gap: 2, align: "start" }), maxIs("100%")]}
				>
					{/**
					 * A native file input rather than a styled trigger. The trigger hides the input
					 * behind a button-like label, so nothing on the page says which file was chosen —
					 * and without script there is nothing to say it with.
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
							 * The platform draws this control, and only its button half can be restyled —
							 * which is the half worth restyling.
							 */
							when("&::file-selector-button", [
								mie(3),
								pi(3),
								pb(1),
								rounded("md"),
								border({ color: "neutral.strong", width: 1 }),
								bg("transparent"),
								fg("neutral"),
								text("sm"),
								weight("medium"),
								cursor("pointer"),
							]),
							when("&:hover::file-selector-button", bg("neutral.tint")),
						]}
					/>

					<Button type="submit" color="brand" size="sm">
						{ctx.intl.t("feeds.transfer.import.submit")}
					</Button>
				</form>
			</SettingsSection.Row>
		</SettingsSection>
	);
}

/**
 * Renders the page.
 *
 * @param ctx - The request being answered, whose query says what an import made of the document it was handed.
 * @param settings - The reader's stored preferences, or `null` before a sign-in wrote them.
 * @param entitlement - What their plan allows, and where they stand against it.
 * @param notifications - How they are reached, when they are left alone, and on what.
 * @param tokens - Every token they minted for an agent, newest first.
 * @param filters - How many filters they hold.
 */
async function settingsPage(
	ctx: AppContext,
	settings: UserStore.Settings | null,
	entitlement: UserStore.Entitlement,
	notifications: UserStore.Notifications,
	tokens: UserStore.AgentToken[],
	filters: number,
) {
	let filtersOn = entitlement.can.rules.apply;
	let nav = settingsNav(ctx.intl, null, { filters: filtersOn });

	/**
	 * The row wins. This page and the sign-in callback are the two places both are read, so
	 * this is where a cookie that has drifted — cleared, or written before a choice made on
	 * another machine — is put back to what is stored.
	 */
	let current = settings?.presentation ?? ctx.presentation;

	let correction =
		settings !== null &&
		(settings.presentation.theme !== ctx.presentation.theme ||
			settings.presentation.face !== ctx.presentation.face)
			? { "Set-Cookie": await writePresentation(settings.presentation) }
			: undefined;

	/**
	 * How long ago the schedule above last ran, in the words every other date in the app is
	 * read in, with the exact one a pointer's breath away.
	 */
	let lastRefreshed =
		settings?.lastRefreshedAt == null
			? { short: ctx.intl.t("settings.neverRefreshed"), exact: undefined }
			: {
					short: ctx.intl.t("settings.lastRefreshed", {
						date: shortDate(settings.lastRefreshedAt, ctx.locale, Date.now()),
					}),
					exact: ctx.intl.t("settings.lastRefreshed", {
						date: exactDate(settings.lastRefreshedAt, ctx.locale),
					}),
				};

	return ctx.render(
		<AppLayout
			assets={ctx.assets}
			documentTitle={ctx.intl.t("settings.title")}
			heading={ctx.intl.t("settings.heading")}
			locale={ctx.locale}
			{...await chrome(ctx)}
		>
			{/**
			 * Every section is on this one page, so the nav's links are anchors into it. A phone,
			 * which hides the side nav on a section page, reaches them through the folded nav.
			 */}
			<SettingsLayout
				sections={nav.sections}
				labels={nav.labels}
				page="section"
				mix={[anchoredSections()]}
			>
				<SettingsPhoneNav
					sections={nav.sections}
					label={nav.labels.nav}
					jump={ctx.intl.t("settings.nav.jump")}
				/>

				{planSection(ctx, entitlement)}

				{appearanceSection(ctx, current)}

				{notificationsSections(ctx, notifications)}

				{/**
				 * What the app does on the reader's behalf, said in the place they would have come
				 * looking for a switch. The sentence points at the check they can ask for on a
				 * feed's own page, which is the whole of what is left to act on here.
				 */}
				<SettingsSection
					id={SETTINGS_ANCHORS.cadence}
					title={ctx.intl.t("settings.cadence.legend")}
					description={ctx.intl.t("settings.cadence.description", {
						floor: formatInterval(POLL_FLOOR_MS),
					})}
					save="instant"
					labels={{ save: ctx.intl.t("settings.appearance.save") }}
				>
					{/**
					 * When the feeds were last brought up to date is the schedule's own news, so it
					 * is the section's one row, with the exact date in the tooltip behind it.
					 */}
					<SettingsSection.Row
						layout="stacked"
						label={<span title={lastRefreshed.exact}>{lastRefreshed.short}</span>}
					/>
				</SettingsSection>

				{/**
				 * Where a reader goes to decide what happens to a post as it arrives. It sits in
				 * this area because it is configured once and read back later, which is what every
				 * other section here is. With filters switched off `/rules` only sends a reader on
				 * to the queue, so the section is left out with the page it points at.
				 */}
				{filtersOn && (
					<SettingsSection
						id={SETTINGS_ANCHORS.filters}
						title={ctx.intl.t("rules.heading")}
						description={ctx.intl.t("rules.description")}
						save="instant"
						labels={{ save: ctx.intl.t("settings.appearance.save") }}
					>
						<SettingsSection.Row
							layout="inline-switch"
							label={
								filters === 0
									? ctx.intl.t("rules.empty")
									: ctx.intl.t("settings.filters.count", { count: filters })
							}
						>
							<LinkButton
								href={routes.rules.index.href()}
								color="neutral"
								variant="outline"
								size="sm"
							>
								{ctx.intl.t("settings.filters.manage")}
							</LinkButton>
						</SettingsSection.Row>
					</SettingsSection>
				)}

				{tokensSection(ctx, tokens, entitlement.can.agent.connect)}

				{transferSection(ctx)}
			</SettingsLayout>
		</AppLayout>,
		correction && { headers: correction },
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

		let [settings, entitlement, notifications, tokens, rules] = await Promise.all([
			store.getSettings(),
			store.entitlement(),
			store.notifications(),
			store.listAgentTokens(),
			store.listRules(),
		]);

		return await settingsPage(ctx, settings, entitlement, notifications, tokens, rules.length);
	},
});
