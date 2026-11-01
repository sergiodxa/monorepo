/**
 * What every page of the settings area shares: the section nav, which links the sections of
 * `/settings` and the pages beside them so the area reads as one place, its phone form, and
 * the note a section shows inside its card when something it holds needs saying.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { I18n } from "@sdxc/i18n";
import type { SettingsLayout } from "@sdxc/ui/app/settings-layout";
import type { Handle, RemixNode } from "remix/component";

import { ChevronDownIcon } from "@sdxc/icons";
import { bg, border, borderEdge, fg, outline } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { listStyle, raw, userSelect } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { m, maxIs, minIs, p, pi } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import {
	font,
	leading,
	overflowWrap,
	text,
	textDecoration,
	truncate,
	weight,
} from "@sdxc/u/typography";
import { Alert, Disclosure } from "@sdxc/ui";

import routes from "~/routes/web";

/** The anchors `/settings` gives its sections, which the nav links into. */
export const SETTINGS_ANCHORS = {
	cadence: "cadence",
	appearance: "appearance",
	plan: "plan",
	notifications: "notifications",
	filters: "filters",
	agents: "agents",
	data: "data",
} as const;

/** A page of the settings area that is not `/settings` itself, marked current in the nav. */
export type SettingsPage = "filters" | "agents";

/**
 * The width below which `SettingsLayout` shows one column, measured on the container the
 * layout names on itself, so the phone nav appears exactly where the side nav disappears.
 */
const NARROW = "@container ui-settings-layout (max-width: 47.999rem)";

/** What the reader's account turns on or off in the settings area. */
export interface SettingsReach {
	/** Whether filters are switched on for this reader, which is when `/rules` answers. */
	filters: boolean;
}

/**
 * The nav's groups and strings for a page of the settings area. Anchors carry the full
 * path, so the same links work from `/rules` and the agent pages as from `/settings`.
 *
 * @param intl - The request's dictionary.
 * The Filters link is left out while filters are switched off, since `/rules` would only
 * send the reader on to the queue.
 *
 * @param intl - The request's dictionary.
 * @param current - The page being shown, or `null` on `/settings`, whose sections are all on screen at once.
 * @param reach - What the reader's account has switched on.
 * @returns Props to spread onto `SettingsLayout`, and to hand `SettingsPhoneNav`.
 */
export function settingsNav(
	intl: I18n,
	current: SettingsPage | null,
	reach: SettingsReach,
): { sections: SettingsLayout.Group[]; labels: { nav: string; back: string } } {
	let settings = routes.settings.href();
	let anchor = (id: string) => `${settings}#${id}`;

	return {
		labels: { nav: intl.t("settings.nav.label"), back: intl.t("settings.nav.back") },
		sections: [
			{
				label: intl.t("settings.nav.account"),
				items: [
					{ href: anchor(SETTINGS_ANCHORS.plan), label: intl.t("settings.nav.plan") },
					{ href: anchor(SETTINGS_ANCHORS.appearance), label: intl.t("settings.nav.appearance") },
					{
						href: anchor(SETTINGS_ANCHORS.notifications),
						label: intl.t("settings.nav.notifications"),
					},
				],
			},
			{
				label: intl.t("settings.nav.reading"),
				items: [
					{ href: anchor(SETTINGS_ANCHORS.cadence), label: intl.t("settings.nav.checking") },
					...(reach.filters
						? [
								{
									href: routes.rules.index.href(),
									label: intl.t("settings.nav.filters"),
									current: current === "filters",
								},
							]
						: []),
					{
						href: anchor(SETTINGS_ANCHORS.agents),
						label: intl.t("settings.nav.agents"),
						current: current === "agents",
					},
				],
			},
			{
				label: intl.t("settings.nav.data"),
				items: [{ href: anchor(SETTINGS_ANCHORS.data), label: intl.t("settings.nav.transfer") }],
			},
		],
	};
}

/**
 * Lands a link into a section with its title just under the app's sticky top bar, so the
 * section a reader picked is the first thing they read. Mix it onto `SettingsLayout`.
 */
export function anchoredSections() {
	return when(
		"& section[id]",
		raw({ scrollMarginBlockStart: "calc(var(--ui-app-sticky-top, 0px) + 1rem)" }),
	);
}

export namespace SettingsPhoneNav {
	export interface Props {
		/** The same groups the layout's side nav draws. */
		sections: ReadonlyArray<SettingsLayout.Group>;
		/** Name of the nav landmark, the same as the side nav's. */
		label: string;
		/** What the closed nav says on `/settings`, where no one section is current. */
		jump: string;
	}
}

/**
 * The section nav as a phone reaches it: one closed row naming the current section that
 * opens onto every link. It shows only below the width at which `SettingsLayout` hides its
 * side nav, so every page of the area keeps a way to every other section on a phone.
 *
 * @example
 * <SettingsPhoneNav sections={nav.sections} label={nav.labels.nav} jump={t("settings.nav.jump")} />
 */
export function SettingsPhoneNav(handle: Handle<SettingsPhoneNav.Props>) {
	return () => {
		let { sections, label, jump } = handle.props;
		let current = sections.flatMap((group) => group.items).find((item) => item.current);

		return (
			<nav
				aria-label={label}
				data-slot="settings-phone-nav"
				mix={[raw({ display: "none", [NARROW]: { display: "block" } })]}
			>
				<Disclosure>
					<Disclosure.Trigger mix={[raw({ minBlockSize: "2.75rem" })]}>
						<span mix={[hstack({ gap: 2, align: "baseline" }), minIs(0), raw({ flex: "1" })]}>
							{current ? (
								<>
									<span mix={[text("sm"), weight("normal"), fg("neutral.muted")]}>{label}</span>
									<span mix={[truncate(), minIs(0)]}>{current.label}</span>
								</>
							) : (
								<span mix={[truncate(), minIs(0)]}>{jump}</span>
							)}
						</span>
						<ChevronDownIcon data-slot="icon" aria-hidden="true" />
					</Disclosure.Trigger>

					<Disclosure.Panel>
						<div
							mix={[
								vstack({ gap: 3, align: "stretch" }),
								p(2),
								borderEdge("block-start", { color: "neutral", width: 1, style: "solid" }),
							]}
						>
							{sections.map((group) => (
								<div mix={[vstack({ gap: 0.5, align: "stretch" })]}>
									{group.label ? (
										<p mix={[m(0), pi(2.5), text("xs"), weight("medium"), fg("neutral.muted")]}>
											{group.label}
										</p>
									) : null}
									<ul mix={[vstack({ gap: 0.5, align: "stretch" }), listStyle(), m(0), p(0)]}>
										{group.items.map((item) => (
											<li>
												<a
													href={item.href}
													aria-current={item.current ? "page" : undefined}
													mix={[
														hstack({ gap: 2, align: "center" }),
														pi(2.5),
														rounded("md"),
														text("sm"),
														fg("neutral"),
														textDecoration("none"),
														raw({ blockSize: "2.75rem" }),
														/**
														 * One step past a tint, which matches the page's own background and
														 * would leave the current section unmarked.
														 */
														hover([
															raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" }),
															fg("neutral.emphasis"),
														]),
														when('&[aria-current="page"]', [
															raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" }),
															fg("neutral.emphasis"),
															weight("medium"),
														]),
														when("&:focus-visible", outline({ color: "brand.ring", offset: -2 })),
													]}
												>
													<span mix={[truncate(), minIs(0)]}>{item.label}</span>
												</a>
											</li>
										))}
									</ul>
								</div>
							))}
						</div>
					</Disclosure.Panel>
				</Disclosure>
			</nav>
		);
	};
}

export namespace SettingsCode {
	export interface Props {
		/** The value a reader copies into another program, such as a token or an address. */
		children: string;
	}
}

/**
 * A value a reader copies by hand, framed so it reads as one thing to select. A click selects
 * all of it, since a token missing a character fails without saying why, and a long value
 * breaks anywhere so it stays inside a phone's width.
 */
export function SettingsCode(handle: Handle<SettingsCode.Props>) {
	return () => (
		<code
			data-slot="settings-code"
			mix={[
				raw({ display: "block" }),
				m(0),
				p(2.5, 3),
				rounded("md"),
				border({ color: "neutral", width: 1 }),
				bg(),
				fg("neutral.emphasis"),
				font("mono"),
				text("sm"),
				leading("relaxed"),
				maxIs("100%"),
				overflowWrap("anywhere"),
				userSelect("all"),
			]}
		>
			{handle.props.children}
		</code>
	);
}

export namespace SettingsNote {
	export interface Props {
		color: Alert.Color;
		/** The alert's body: one or more `Alert.Description`s. */
		children: RemixNode;
	}
}

/**
 * An outcome or a warning drawn as the first block of a settings card, inset like a row,
 * so it reads as news about that section rather than about the page.
 */
export function SettingsNote(handle: Handle<SettingsNote.Props>) {
	return () => (
		<div data-slot="settings-note" mix={[p(3)]}>
			<Alert color={handle.props.color}>
				<Alert.Content>{handle.props.children}</Alert.Content>
			</Alert>
		</div>
	);
}
