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

import type { SizeValue, SpacingValue } from "@pkg/u/tokens";
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
import { boxLength, spacing } from "@pkg/u/tokens";
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
 * {@link Tabs.List}'s own inter-tab gap, applied through `hstack({ gap:
 * LIST_GAP })`. Reused as-is when computing a controlled `activeIndex`'s
 * indicator offset (see {@link tabIndicatorMix}), so the two stay in sync by
 * construction instead of by a duplicated literal.
 */
const LIST_GAP: SpacingValue = 1;

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
	export interface ListProps extends TagProps<"div"> {
		/**
		 * Index of the currently active tab, for a tab bar with no
		 * client-side measurement of the active {@link Tabs.Tab}'s bounding
		 * box available — e.g. a link-based tab bar where each tab is a real
		 * navigation and the active one is known from the current route
		 * server-side, not from tracked selection state. When given together
		 * with `tabSize`, {@link Tabs.List} computes and sets its own
		 * `--ui-tab-indicator-*` custom properties from them directly,
		 * instead of leaving those properties at their resting fallback for
		 * something else (a future client-measured behavior) to set. Omit
		 * both props to keep today's default: the indicator stays at its
		 * resting, invisible fallback until something else sets those
		 * custom properties — unchanged from before this prop existed.
		 */
		activeIndex?: number;

		/**
		 * Every {@link Tabs.Tab}'s fixed size along the enclosing
		 * {@link Tabs}'s layout axis (inline-size when horizontal, block-size
		 * when vertical) — required alongside `activeIndex`, since a
		 * controlled index alone doesn't say how far apart the tabs actually
		 * sit. A number resolves against the spacing scale, same as every
		 * other sizing prop in this package; a raw CSS length string
		 * (`"110px"`) passes through unchanged — most callers with a fixed
		 * pixel-width tab bar want the latter. Ignored unless `activeIndex`
		 * is also given.
		 */
		tabSize?: SizeValue;
	}

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
 * Computes the `--ui-tab-indicator-*` custom properties {@link Tabs.List}'s
 * own sliding indicator reads, for a controlled `activeIndex` with no
 * client-side measurement available — e.g. a link-based tab bar rendering
 * server-controlled active state, with no bounding box to measure from since
 * there's no client behavior tracking selection at all. Every
 * {@link Tabs.Tab} is assumed to share one fixed `tabSize` along `orientation`'s
 * axis and to sit `LIST_GAP` apart (the same gap {@link Tabs.List} lays them
 * out with via `hstack`), so the active tab's leading edge is `activeIndex`
 * tab-and-gap widths from the start — the same offset a real flex layout of
 * equal-width, evenly gapped items produces, computed here instead of read
 * back from one.
 *
 * @param orientation The enclosing {@link Tabs}'s layout axis.
 * @param activeIndex Index of the active tab among its siblings.
 * @param tabSize Every tab's fixed size along `orientation`'s axis.
 * @returns A `raw()` mixin setting the indicator's offset, length, and opacity.
 */
export function tabIndicatorMix(
	orientation: Tabs.Orientation,
	activeIndex: number,
	tabSize: SizeValue,
) {
	let size = boxLength(tabSize);
	let offset = `calc((${size} + ${spacing(LIST_GAP)}) * ${activeIndex})`;

	if (orientation === "vertical") {
		return raw({
			"--ui-tab-indicator-block-start": offset,
			"--ui-tab-indicator-block-size": size,
			"--ui-tab-indicator-opacity": "1",
		});
	}

	return raw({
		"--ui-tab-indicator-inline-start": offset,
		"--ui-tab-indicator-inline-size": size,
		"--ui-tab-indicator-opacity": "1",
	});
}

/**
 * Renders the tab strip: a `role="tablist"` host laying {@link Tabs.Tab}
 * links out in a row with a shared block-end border underlining the whole
 * strip, or in a column with a shared inline-end border alongside it when
 * the enclosing {@link Tabs}'s orientation is `"vertical"`. A sliding accent
 * bar sits over that shared border through an absolutely positioned
 * pseudo-element, its offset, length, and opacity read from
 * `--ui-tab-indicator-*` custom properties; every one of those falls back to
 * a resting, invisible state by default, ready for a behavior that tracks
 * the active tab to animate them — or, when `activeIndex`/`tabSize` are
 * given, computed internally instead (see {@link tabIndicatorMix}), for a
 * tab bar with no client-side measurement available at all.
 *
 * @param handle Runtime handle carrying the host's props.
 * @returns The render function producing the tab strip's markup.
 * @example
 * <Tabs.List aria-label={t("settings.sections")}>
 * 	<Tabs.Tab href="/settings/profile" aria-selected="true">{t("settings.profile")}</Tabs.Tab>
 * 	<Tabs.Tab href="/settings/billing" aria-selected="false">{t("settings.billing")}</Tabs.Tab>
 * </Tabs.List>
 * @example
 * // A link-based, server-controlled tab bar: `activeIndex` comes from the
 * // current route, not from any client-tracked selection state, so
 * // `Tabs.List` computes its own sliding indicator with no client JS at all.
 * <Tabs.List aria-label={t("dashboard.tabs")} activeIndex={activeIndex} tabSize="110px">
 * 	<Tabs.Tab href="/dashboard/overview" aria-selected={activeIndex === 0}>
 * 		{t("dashboard.overview")}
 * 	</Tabs.Tab>
 * 	<Tabs.Tab href="/dashboard/incidents" aria-selected={activeIndex === 1}>
 * 		{t("dashboard.incidents")}
 * 	</Tabs.Tab>
 * </Tabs.List>
 */
Tabs.List = function TabsList(handle: Handle<Tabs.ListProps>) {
	return () => {
		let { mix, activeIndex, tabSize, ...rest } = handle.props;
		let context = handle.context.get(Tabs);
		let indicatorMix =
			activeIndex !== undefined && tabSize !== undefined
				? tabIndicatorMix(context.orientation, activeIndex, tabSize)
				: undefined;

		return (
			<div
				data-orientation={context.orientation}
				aria-orientation={context.orientation}
				{...rest}
				mix={[
					attrs({ role: DEFAULT_LIST_ROLE }),
					relative(),
					hstack({ gap: LIST_GAP }),
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
						bg("var(--ui-brand-fg)"),
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
					indicatorMix,
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
					when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
					pi(4),
					pb(2),
					weight(500),
					fg("neutral"),
					when("&:hover", fg("neutral.emphasis")),
					when('&[aria-selected="true"]', fg("brand")),
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
					when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
					pb(4),
					pi(4),
					outlineStyle("none"),
					mix,
				]}
			/>
		);
	};
};
