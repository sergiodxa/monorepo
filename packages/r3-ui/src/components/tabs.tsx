/**
 * A set of tabs whose active view comes from routing rather than tracked
 * selection state: each tab renders as a native link carrying the `tab`
 * role, and whichever one points at the page currently being viewed carries
 * `aria-selected="true"` to read as the active tab. `Tabs.List` lays the
 * links out along `Tabs`' orientation axis, sharing that axis with every
 * `Tabs.Tab` through component context, and `Tabs.Panel` holds the content
 * the current tab's page renders inside `Tabs.Panels`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { bg, borderEdge, fg, outline, outlineStyle } from "@pkg/u/color";
import { opacity, transition } from "@pkg/u/effects";
import { cursor, raw } from "@pkg/u/general";
import {
	absolute,
	basis,
	flexCol,
	flexRow,
	grow,
	hstack,
	insBe,
	insIs,
	inset,
	relative,
	shrink,
	vstack,
} from "@pkg/u/layout";
import { bs, is, mbe, mie, pb, pi } from "@pkg/u/size";
import { after, data, when } from "@pkg/u/state";
import { text, weight } from "@pkg/u/typography";
import { attrs } from "remix/ui";

import { interactiveTransition } from "../styles/interactive-transition";

/** Default {@link Tabs.Props} orientation, applied when `orientation` is omitted. */
const DEFAULT_ORIENTATION: Tabs.Orientation = "horizontal";

/** `role="tablist"` applied to {@link Tabs.List} through {@link attrs} unless a consumer supplies its own `role`. */
const DEFAULT_LIST_ROLE = "tablist";

/** `role="tab"` applied to {@link Tabs.Tab} through {@link attrs} unless a consumer supplies its own `role`. */
const DEFAULT_TAB_ROLE = "tab";

/** `role="tabpanel"` applied to {@link Tabs.Panel} through {@link attrs} unless a consumer supplies its own `role`. */
const DEFAULT_PANEL_ROLE = "tabpanel";

/**
 * Default {@link Tabs.PanelProps.tabIndex}, applied through {@link attrs}
 * unless a consumer supplies its own, so the panel's content is reachable by
 * moving focus straight into it rather than tabbing through {@link Tabs.List} first.
 */
const DEFAULT_PANEL_TAB_INDEX = 0;

/**
 * Prop types for {@link Tabs} and its compound parts.
 */
export namespace Tabs {
	/**
	 * Axis {@link Tabs.List}'s links lay out along: a single row with the
	 * active indicator running beneath it, or a single column with the
	 * indicator running alongside it.
	 */
	export type Orientation = "horizontal" | "vertical";

	/**
	 * Value {@link Tabs} stores in component context so every
	 * {@link Tabs.List} and {@link Tabs.Tab} nested inside mirrors the same
	 * orientation onto themselves without a consumer repeating it.
	 */
	export interface Context {
		/** The root's resolved layout axis. */
		orientation: Orientation;
	}

	/**
	 * Props accepted by {@link Tabs}.
	 */
	export interface Props extends TagProps<"div"> {
		/** Layout axis. Defaults to {@link DEFAULT_ORIENTATION}. */
		orientation?: Orientation;
	}

	/**
	 * Props accepted by {@link Tabs.List}.
	 */
	export interface ListProps extends TagProps<"div"> {}

	/**
	 * Props accepted by {@link Tabs.Tab}. A type alias rather than an
	 * interface, since the native anchor props already encode the
	 * relationship between `href` and `role` as a union; `href` is narrowed
	 * to required here, since a tab that goes nowhere isn't a link-mode tab.
	 */
	export type TabProps = TagProps<"a"> & {
		/** The page this tab navigates to. */
		href: string;
	};

	/**
	 * Props accepted by {@link Tabs.Panels}.
	 */
	export interface PanelsProps extends TagProps<"div"> {}

	/**
	 * Props accepted by {@link Tabs.Panel}.
	 */
	export interface PanelProps extends TagProps<"div"> {}
}

/**
 * Renders the root host: a plain `<div>` stacking {@link Tabs.List} above
 * {@link Tabs.Panels} by default, switching to a side-by-side row when
 * `orientation` is `"vertical"`. The resolved axis is shared through
 * component context, so every {@link Tabs.List} and {@link Tabs.Tab} nested
 * inside mirrors it onto its own `data-orientation` attribute and switches
 * its own layout and border sides from that, without reading an ancestor.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props and providing {@link Tabs.Context}.
 * @returns The render function producing the root's markup.
 * @example
 * <Tabs>
 * 	<Tabs.List aria-label={t("settings.sections")}>
 * 		<Tabs.Tab href="/settings/profile" aria-selected="true">{t("settings.profile")}</Tabs.Tab>
 * 		<Tabs.Tab href="/settings/billing" aria-selected="false">{t("settings.billing")}</Tabs.Tab>
 * 	</Tabs.List>
 * 	<Tabs.Panels>
 * 		<Tabs.Panel>{t("settings.profile.body")}</Tabs.Panel>
 * 	</Tabs.Panels>
 * </Tabs>
 * @example
 * <Tabs orientation="vertical">
 * 	<Tabs.List aria-label={t("settings.sections")}>
 * 		<Tabs.Tab href="/settings/profile" aria-selected="true">{t("settings.profile")}</Tabs.Tab>
 * 		<Tabs.Tab href="/settings/billing" aria-selected="false">{t("settings.billing")}</Tabs.Tab>
 * 	</Tabs.List>
 * 	<Tabs.Panels>
 * 		<Tabs.Panel>{t("settings.profile.body")}</Tabs.Panel>
 * 	</Tabs.Panels>
 * </Tabs>
 */
export function Tabs(handle: Handle<Tabs.Props, Tabs.Context>) {
	return () => {
		let { orientation, mix, ...rest } = handle.props;
		let resolvedOrientation = orientation ?? DEFAULT_ORIENTATION;

		handle.context.set({ orientation: resolvedOrientation });

		return (
			<div
				data-orientation={resolvedOrientation}
				{...rest}
				mix={[vstack(), data("orientation", "vertical", flexRow()), mix]}
			/>
		);
	};
}

/**
 * Renders the tab strip: a `role="tablist"` host laying {@link Tabs.Tab}
 * links out in a row with a shared block-end border underlining the whole
 * strip, or in a column with a shared inline-end border alongside it when
 * the enclosing {@link Tabs}'s orientation is `"vertical"`. A sliding accent
 * bar sits over that shared border through an absolutely positioned
 * pseudo-element, its offset, length, and opacity read from
 * `--ui-tab-indicator-*` custom properties; every one of those falls back to
 * a resting, invisible state, ready for a behavior that tracks the active
 * tab to animate them.
 *
 * @param handle Runtime handle carrying the host's props.
 * @returns The render function producing the tab strip's markup.
 * @example
 * <Tabs.List aria-label={t("settings.sections")}>
 * 	<Tabs.Tab href="/settings/profile" aria-selected="true">{t("settings.profile")}</Tabs.Tab>
 * 	<Tabs.Tab href="/settings/billing" aria-selected="false">{t("settings.billing")}</Tabs.Tab>
 * </Tabs.List>
 */
Tabs.List = function TabsList(handle: Handle<Tabs.ListProps>) {
	return () => {
		let { mix, ...rest } = handle.props;
		let context = handle.context.get(Tabs);

		return (
			<div
				data-orientation={context.orientation}
				aria-orientation={context.orientation}
				{...rest}
				mix={[
					attrs({ role: DEFAULT_LIST_ROLE }),
					relative(),
					hstack({ gap: 1 }),
					borderEdge("block-end", { color: "neutral", width: 1 }),
					after([
						absolute(),
						is("var(--ui-tab-indicator-inline-size, 0px)"),
						bs("0.125rem"),
						transition("inset-inline-start, inset-block-start, inline-size, block-size, opacity", {
							duration: "200ms",
							easing: "ease-out",
						}),
						insIs("var(--ui-tab-indicator-inline-start, 0px)"),
						insBe("-0.0625rem"),
						bg("var(--ui-primary-fg)"),
						raw({
							content: '""',
							opacity: "var(--ui-tab-indicator-opacity, 0)",
						}),
					]),
					data("orientation", "vertical", [
						flexCol(),
						borderEdge("block-end", { width: "0" }),
						borderEdge("inline-end", { color: "neutral", width: 1 }),
						after([
							inset("var(--ui-tab-indicator-block-start, 0px)", "0", "auto", "auto"),
							is("0.125rem"),
							bs("var(--ui-tab-indicator-block-size, 0px)"),
						]),
					]),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a single tab: a native `<a>` carrying the `tab` role, styled to
 * read as part of the strip rather than as body copy, its own block-end (or,
 * in a vertical strip, inline-end) border kept transparent to reserve the
 * space {@link Tabs.List}'s sliding indicator occupies. Set
 * `aria-selected="true"` on whichever tab points at the page currently being
 * viewed to color it as active; set `aria-disabled="true"` to mute a tab
 * that shouldn't be followed, keeping in mind that only omitting or
 * neutralizing `href` actually stops the navigation, since a plain link has
 * no native disabled state.
 *
 * @param handle Runtime handle carrying the host `<a>`'s props.
 * @returns The render function producing the tab's markup.
 * @example
 * <Tabs.Tab href="/settings/profile" aria-selected="true">{t("settings.profile")}</Tabs.Tab>
 * @example
 * <Tabs.Tab href="/settings/billing" aria-selected="false" aria-disabled="true">
 * 	{t("settings.billing")}
 * </Tabs.Tab>
 */
Tabs.Tab = function TabsTab(handle: Handle<Tabs.TabProps>) {
	return () => {
		let { mix, ...rest } = handle.props;
		let context = handle.context.get(Tabs);

		return (
			<a
				data-orientation={context.orientation}
				{...rest}
				mix={[
					interactiveTransition(),
					attrs({ role: DEFAULT_TAB_ROLE }),
					when("&:focus-visible", outline({ color: "primary.ring", offset: 2 })),
					pi(4),
					pb(2),
					weight(500),
					fg("neutral"),
					when("&:hover", fg("neutral.emphasis")),
					when('&[aria-selected="true"]', fg("primary")),
					when('&[aria-disabled="true"]', opacity(50)),
					mbe("-0.0625rem"),
					cursor("default"),
					text("sm"),
					borderEdge("block-end", { color: "transparent", width: 2 }),
					when('&[aria-disabled="true"]', cursor("not-allowed")),
					data("orientation", "vertical", [
						mbe("0"),
						mie("-0.0625rem"),
						borderEdge("block-end", { width: "0" }),
						borderEdge("inline-end", { color: "transparent", width: 2 }),
					]),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders the panel region: a `<div>` growing to fill whatever space is left
 * beside or beneath {@link Tabs.List}. Nest the current tab's
 * {@link Tabs.Panel} inside it.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the panel region's markup.
 * @example
 * <Tabs.Panels>
 * 	<Tabs.Panel>{t("settings.profile.body")}</Tabs.Panel>
 * </Tabs.Panels>
 */
Tabs.Panels = function TabsPanels(handle: Handle<Tabs.PanelsProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <div {...rest} mix={[grow(), shrink(1), basis("0%"), mix]} />;
	};
};

/**
 * Renders the current tab's content: a padded `<div>` carrying the
 * `tabpanel` role, focusable by default so a keyboard user can jump straight
 * into it after activating a tab; that focus shows a keyboard
 * focus-visible ring.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the panel's markup.
 * @example
 * <Tabs.Panel>{t("settings.profile.body")}</Tabs.Panel>
 */
Tabs.Panel = function TabsPanel(handle: Handle<Tabs.PanelProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				mix={[
					attrs({ role: DEFAULT_PANEL_ROLE, tabIndex: DEFAULT_PANEL_TAB_INDEX }),
					when("&:focus-visible", outline({ color: "primary.ring", offset: 2 })),
					pb(4),
					pi(4),
					outlineStyle("none"),
					mix,
				]}
			/>
		);
	};
};
