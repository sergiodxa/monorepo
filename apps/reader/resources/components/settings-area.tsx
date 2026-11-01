/**
 * What every page of the settings area shares: the section nav, which links the sections
 * of `/settings` and the Filters page beside them so the area reads as one place, and the
 * note a section shows inside its card when something it holds needs saying.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { I18n } from "@sdxc/i18n";
import type { SettingsLayout } from "@sdxc/ui/app/settings-layout";
import type { Handle, RemixNode } from "remix/component";

import { p } from "@sdxc/u/size";
import { Alert } from "@sdxc/ui";

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
 * The nav's groups and strings for a page of the settings area. Anchors carry the full
 * path, so the same links work from `/rules` and the agent pages as from `/settings`.
 *
 * @param intl - The request's dictionary.
 * @param current - The page being shown, or `null` on `/settings`, whose sections are all on screen at once.
 * @returns Props to spread onto `SettingsLayout`.
 */
export function settingsNav(
	intl: I18n,
	current: SettingsPage | null,
): Pick<SettingsLayout.Props, "sections" | "labels"> {
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
					{
						href: routes.rules.index.href(),
						label: intl.t("settings.nav.filters"),
						current: current === "filters",
					},
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
