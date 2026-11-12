/**
 * A phone's bottom tab bar: four or five destinations under the thumb, each an icon over its
 * name, fixed above the home indicator, gone from the width where the sidebar takes over.
 * It reserves its own height in the flow, so the page's last row never hides behind it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { mergeMix, raw } from "@sdxc/u/general";
import { media, motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

/** The bar's height above the safe area, which a floating button above it offsets by. */
export const TAB_BAR_BLOCK_SIZE = "3.5rem";

/** The width from which a bar hides when `hideFrom` is omitted: a tablet's, where the sidebar shows. */
const DEFAULT_HIDE_FROM: TabBar.HideFrom = "40rem";

/** Prop types for {@link TabBar} and {@link TabBar.Item}. */
export namespace TabBar {
	/**
	 * The width from which the bar is gone, matching where the app's sidebar appears;
	 * `never` keeps it at every width, for an app made for phones alone.
	 */
	export type HideFrom = "30rem" | "40rem" | "48rem" | "64rem" | "never";

	/** Props accepted by {@link TabBar}. */
	export interface Props extends TagProps<"nav"> {
		/** The landmark's name, such as "Primary". */
		label: string;
		/** @default "40rem" */
		hideFrom?: HideFrom;
		/** Shows each item's name under its icon; `false` keeps names for assistive tech alone. @default true */
		showLabels?: boolean;
		/** Four or five {@link TabBar.Item}s. */
		children: RemixNode;
	}

	/** Props accepted by {@link TabBar.Item}; a type, since anchor props are a union. */
	export type ItemProps = TagProps<"a"> & {
		href: string;
		/** A 24px icon. */
		icon: RemixNode;
		/** The destination's name, read out and shown under the icon. */
		label: string;
		/** This item is the page shown; sets `aria-current="page"`. */
		current?: boolean;
		/** A badge on the icon; zero or unset draws none. Counts over 99 read "99+". */
		count?: number;
		/** What the count means for a screen reader, such as "3 unread notifications". */
		countLabel?: string;
	};
}

/**
 * Renders the bar. The outer box keeps the bar's height in the flow while the bar itself is
 * fixed to the viewport's foot, so it reads as one more block at the end of the page; a
 * screen at or above `hideFrom` draws neither.
 *
 * @example
 * <TabBar label="Primary">
 * 	<TabBar.Item href="/" icon={<HomeIcon />} label="Home" current />
 * 	<TabBar.Item href="/alerts" icon={<BellIcon />} label="Alerts" count={3} countLabel="3 new" />
 * </TabBar>
 */
export function TabBar(handle: Handle<TabBar.Props>) {
	return () => {
		let {
			label,
			hideFrom = DEFAULT_HIDE_FROM,
			showLabels = true,
			children,
			mix,
			...rest
		} = handle.props;

		return (
			<div
				data-slot="tab-bar"
				mix={[
					raw({
						"--ui-tab-bar-block-size": TAB_BAR_BLOCK_SIZE,
						blockSize: `calc(${TAB_BAR_BLOCK_SIZE} + env(safe-area-inset-bottom, 0px))`,
						flexShrink: "0",
					}),
					hideFrom === "never"
						? raw({})
						: media(`(min-width: ${hideFrom})`, raw({ display: "none" })),
				]}
			>
				<nav
					{...rest}
					aria-label={label}
					data-labels={showLabels ? "" : undefined}
					mix={mergeMix(
						[
							raw({
								position: "fixed",
								insetInline: "0",
								insetBlockEnd: "0",
								zIndex: "40",
								display: "grid",
								gridAutoFlow: "column",
								gridAutoColumns: "minmax(0, 1fr)",
								paddingBlockEnd: "env(safe-area-inset-bottom, 0px)",
								backgroundColor: "color-mix(in oklch, var(--ui-bg, Canvas) 88%, transparent)",
								backdropFilter: "blur(16px) saturate(1.4)",
								WebkitBackdropFilter: "blur(16px) saturate(1.4)",
								borderBlockStart: "1px solid var(--ui-neutral-border)",
							}),
						],
						mix,
					)}
				>
					{children}
				</nav>
			</div>
		);
	};
}

/**
 * One destination: the whole column is the link, at least 44px square. The current item
 * takes the brand colour and a heavier name, and a press dims it briefly.
 */
TabBar.Item = function TabBarItem(handle: Handle<TabBar.ItemProps>) {
	return () => {
		let { href, icon, label, current = false, count, countLabel, mix, ...rest } = handle.props;
		let hasCount = count !== undefined && count > 0;

		return (
			<a
				{...rest}
				href={href}
				aria-current={current ? "page" : undefined}
				data-slot="tab-bar-item"
				mix={mergeMix(
					[
						raw({
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							justifyContent: "center",
							gap: "0.125rem",
							minBlockSize: TAB_BAR_BLOCK_SIZE,
							minInlineSize: "2.75rem",
							color: "var(--ui-neutral-fg-muted)",
							textDecoration: "none",
							WebkitTapHighlightColor: "transparent",
							transition: "opacity 120ms",
							outline: "none",
						}),
						when("&[aria-current='page']", raw({ color: "var(--ui-brand-fg)" })),
						when("&:active", raw({ opacity: "0.6" })),
						when(
							"&:focus-visible",
							raw({ boxShadow: "inset 0 0 0 2px var(--ui-brand-ring)", borderRadius: "0.75rem" }),
						),
						motionReduce(raw({ transition: "none" })),
					],
					mix,
				)}
			>
				<span
					aria-hidden="true"
					data-slot="tab-bar-icon"
					mix={[
						raw({
							position: "relative",
							display: "inline-flex",
							inlineSize: "1.5rem",
							blockSize: "1.5rem",
							"& > svg": { inlineSize: "100%", blockSize: "100%" },
						}),
					]}
				>
					{icon}
					{hasCount ? (
						<span
							data-slot="tab-bar-count"
							mix={[
								raw({
									position: "absolute",
									insetBlockStart: "-0.375rem",
									insetInlineStart: "0.875rem",
									minInlineSize: "1.125rem",
									blockSize: "1.125rem",
									paddingInline: "0.3125rem",
									boxSizing: "border-box",
									borderRadius: "999px",
									fontSize: "0.6875rem",
									fontWeight: "700",
									lineHeight: "1.125rem",
									textAlign: "center",
									fontVariantNumeric: "tabular-nums",
									color: "var(--ui-brand-fg-on-solid, white)",
									backgroundColor: "var(--ui-brand-bg-solid)",
									boxShadow: "0 0 0 2px var(--ui-bg, Canvas)",
								}),
							]}
						>
							{(count ?? 0) > 99 ? "99+" : count}
						</span>
					) : null}
				</span>
				<span
					data-slot="tab-bar-label"
					mix={[
						raw({ fontSize: "0.6875rem", lineHeight: "1rem", fontWeight: "500" }),
						when("[aria-current='page'] > &", raw({ fontWeight: "700" })),
						when(":is(nav:not([data-labels])) &", visuallyHidden()),
					]}
				>
					{label}
					{hasCount && countLabel ? <span mix={[visuallyHidden()]}>, {countLabel}</span> : null}
				</span>
			</a>
		);
	};
};
