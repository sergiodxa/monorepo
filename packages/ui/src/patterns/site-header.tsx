/**
 * The marketing site's top bar: brand, primary navigation with full-width mega panels, a
 * primary action, and a full-screen phone sheet. Panels open through the Popover API and
 * the sheet through a modal `<dialog>` and invoker commands, so both work before any script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { ChevronDownIcon, MenuIcon, XIcon } from "@sdxc/icons";
import { keyframes } from "@sdxc/u/animation";
import { combine, raw } from "@sdxc/u/general";
import { container } from "@sdxc/u/layout";
import { at, dark, motionSafe, startingStyle, supports } from "@sdxc/u/responsive";
import { hover, when } from "@sdxc/u/state";

import { LinkButton } from "../components/link-button.js";
import { hitArea } from "../styles/hit-area.js";
import { eyebrow, marketingContainer } from "../styles/marketing.js";

/** Container the bar's breakpoints read; the header spans the viewport, so it tracks it. */
const CONTAINER = "ui-site-header";

/** Chrome {@link SiteHeader} applies when `variant` is omitted. */
const DEFAULT_VARIANT: SiteHeader.Variant = "bar";

/** Breakpoint {@link SiteHeader} switches to the inline navigation at when `collapseAt` is omitted. */
const DEFAULT_COLLAPSE_AT: SiteHeader.CollapseAt = "xl";

/** Block size of the bar; mega panels and their backdrop start right under it. */
const BAR_HEIGHT = "4rem";

/** Block size of the floating bar, which sits {@link FLOAT_GAP} below the viewport top. */
const FLOAT_HEIGHT = "3.5rem";

/** Space the floating bar keeps from the viewport's top and side edges. */
const FLOAT_GAP = "0.5rem";

/** Scroll distance over which the bar goes from transparent to filled. */
const FILL_RANGE = "4rem";

/** The scrolled fill: the page color at 84%, so bands read through the blur. */
const FILL = "color-mix(in oklch, var(--ui-bg) 84%, transparent)";

/** Shadow under a floating bar once it fills, and under an open mega panel. */
const FLOAT_SHADOW = "var(--ui-shadow-float, 0 25px 50px -12px rgb(0 0 0 / 0.15))";

/** Keyframes the scroll timeline drives on a full-width bar. */
const BAR_FILL_KEYFRAMES = "ui-site-header-bar-fill";

/** Keyframes the scroll timeline drives on a floating bar. */
const FLOAT_FILL_KEYFRAMES = "ui-site-header-float-fill";

/** Keyframes for the phone sheet's entry. */
const SHEET_ENTER_KEYFRAMES = "ui-site-header-sheet-enter";

/**
 * Prop types for {@link SiteHeader}.
 */
export namespace SiteHeader {
	/**
	 * `bar` spans the viewport and gains its fill and hairline once the page scrolls;
	 * `floating` is a rounded bar held off the edges that gains a fill and a shadow.
	 */
	export type Variant = "bar" | "floating";

	/**
	 * Container width from which the inline navigation replaces the menu button:
	 * `lg` (48rem) for three or four short links, `xl` (64rem) for groups.
	 */
	export type CollapseAt = "lg" | "xl";

	/**
	 * One destination. `description` and `icon` show in a mega panel; the bar and the
	 * phone sheet use the label alone.
	 */
	export interface Link {
		/** Link text. */
		label: RemixNode;
		/** Destination. */
		href: string;
		/** One line under the label in a mega panel. */
		description?: RemixNode;
		/** A 1.25rem glyph beside the label in a mega panel, decorative. */
		icon?: RemixNode;
		/** Marks the link as the current page with `aria-current="page"`. */
		current?: boolean;
	}

	/**
	 * A titled column of links inside a mega panel or a phone-sheet group.
	 */
	export interface Column {
		/** Column label, set as a mono eyebrow. */
		title: RemixNode;
		/** The column's links. */
		links: Link[];
	}

	/**
	 * A top-level entry that opens a mega panel on wide screens and a disclosure in the
	 * phone sheet.
	 */
	export interface Group {
		/** Trigger text. */
		label: RemixNode;
		/** One to four columns; the panel lays them out side by side. */
		columns: Column[];
		/** A closing link under a hairline, such as "Browse all integrations". */
		footer?: Link;
	}

	/** A plain link or a group with a mega panel. */
	export type Item = Link | Group;

	/**
	 * An account action the header draws itself, so the bar and the phone sheet each get
	 * the size and width their surface needs.
	 */
	export interface Action {
		/** Button text. */
		label: RemixNode;
		/** Destination. */
		href: string;
	}

	/**
	 * Props accepted by {@link SiteHeader}.
	 */
	export interface Props extends TagProps<"header"> {
		/** The home link with the logo; give it an `aria-label` when the logo is an image. */
		brand: RemixNode;
		/** Top-level navigation, in reading order. */
		items?: Item[];
		/** The primary call to action: in the bar at every width and full width in the sheet. */
		cta?: Action;
		/** Secondary actions such as "Log in": in the bar when wide, stacked in the sheet. */
		actions?: Action[];
		/** Extra bar controls (search, theme toggle, a repository link) before the actions. */
		tools?: RemixNode;
		/** Chrome. Defaults to {@link DEFAULT_VARIANT}. */
		variant?: Variant;
		/** Where the inline navigation appears. Defaults to {@link DEFAULT_COLLAPSE_AT}. */
		collapseAt?: CollapseAt;
		/** Accessible name of both navigation landmarks. Defaults to "Main". */
		navLabel?: string;
		/** Accessible name of the menu button. Defaults to "Open menu". */
		menuLabel?: string;
		/** Accessible name of the sheet's close button. Defaults to "Close menu". */
		closeLabel?: string;
		/**
		 * Rendered at the end of the phone sheet. A one-page site places a client island
		 * here that closes the sheet when an in-page link is followed.
		 */
		sheet?: RemixNode;
	}
}

/**
 * Renders a sticky header whose bar fills as the page scrolls under it. Groups open a
 * full-width panel anchored to the bar; below `collapseAt` the links, groups and actions
 * move into a full-screen sheet that keeps every row at least 44px tall.
 *
 * @param handle Runtime handle carrying the host `<header>`'s props.
 * @returns The render function producing the header's markup.
 * @example
 * <SiteHeader
 * 	brand={<a href="/" aria-label="Keel home"><KeelLogo /></a>}
 * 	items={[{ label: "Pricing", href: "/pricing" }, { label: "Product", columns }]}
 * 	actions={[{ label: "Log in", href: "/login" }]}
 * 	cta={{ label: "Start free", href: "/signup" }}
 * />
 */
export function SiteHeader(handle: Handle<SiteHeader.Props>) {
	return () => {
		let {
			actions,
			brand,
			closeLabel,
			collapseAt,
			cta,
			items,
			menuLabel,
			mix,
			navLabel,
			sheet,
			tools,
			variant,
			...rest
		} = handle.props;
		let resolvedVariant = variant ?? DEFAULT_VARIANT;
		let breakpoint = collapseAt ?? DEFAULT_COLLAPSE_AT;
		let isFloating = resolvedVariant === "floating";
		let resolvedItems = items ?? [];
		let resolvedActions = actions ?? [];
		let label = navLabel ?? "Main";
		let sheetId = `${handle.id}-sheet`;
		let anchor = `--${handle.id}-bar`;

		return (
			<header
				{...rest}
				data-slot="site-header"
				data-variant={resolvedVariant}
				mix={[
					container(CONTAINER),
					raw({
						position: "sticky",
						insetBlockStart: "0",
						zIndex: "30",
						inlineSize: "100%",
						paddingInline: isFloating ? FLOAT_GAP : "0",
						paddingBlockStart: isFloating ? FLOAT_GAP : "0",
					}),
					mix,
				]}
			>
				<div
					data-slot="site-header-bar"
					style={{ anchorName: anchor }}
					mix={[isFloating ? floatingBar() : fullBar()]}
				>
					<div data-slot="site-header-row" mix={[row(isFloating, breakpoint)]}>
						<div data-slot="site-header-brand" mix={[brandSlot()]}>
							{brand}
						</div>

						{resolvedItems.length > 0 ? (
							<nav
								aria-label={label}
								data-slot="site-header-nav"
								mix={[showFrom(breakpoint, "flex")]}
							>
								<ul mix={[navList()]}>
									{resolvedItems.map((item, index) => (
										<li key={index}>
											{isGroup(item) ? (
												<GroupEntry
													group={item}
													panelId={`${handle.id}-panel-${index}`}
													anchor={anchor}
													floating={isFloating}
												/>
											) : (
												<a
													href={item.href}
													aria-current={item.current ? "page" : undefined}
													mix={[navTrigger()]}
												>
													{item.label}
												</a>
											)}
										</li>
									))}
								</ul>
							</nav>
						) : null}

						<div data-slot="site-header-end" mix={[endSlot()]}>
							{tools}
							{resolvedActions.map((action, index) => (
								<span key={index} mix={[showFrom(breakpoint, "inline-flex")]}>
									<LinkButton href={action.href} variant="ghost" color="neutral">
										{action.label}
									</LinkButton>
								</span>
							))}
							{cta ? (
								<LinkButton href={cta.href} color="brand">
									{cta.label}
								</LinkButton>
							) : null}
							<button
								type="button"
								commandfor={sheetId}
								command="show-modal"
								aria-label={menuLabel ?? "Open menu"}
								aria-haspopup="dialog"
								data-slot="site-header-menu-button"
								mix={[menuButton(), at(breakpoint, CONTAINER, raw({ display: "none" }))]}
							>
								<MenuIcon aria-hidden="true" />
							</button>
						</div>
					</div>
				</div>

				<dialog
					id={sheetId}
					closedby="any"
					aria-label={label}
					data-slot="site-header-sheet"
					mix={[sheetSurface()]}
				>
					<div mix={[sheetTop()]}>
						<div data-slot="site-header-brand" mix={[brandSlot()]}>
							{brand}
						</div>
						<button
							type="button"
							commandfor={sheetId}
							command="close"
							aria-label={closeLabel ?? "Close menu"}
							mix={[menuButton()]}
						>
							<XIcon aria-hidden="true" />
						</button>
					</div>

					<nav aria-label={label} data-slot="site-header-sheet-nav" mix={[sheetBody()]}>
						<ul mix={[raw({ listStyle: "none", margin: "0", padding: "0" })]}>
							{resolvedItems.map((item, index) => (
								<li
									key={index}
									mix={[raw({ borderBlockEnd: "1px solid var(--ui-marketing-hairline)" })]}
								>
									{isGroup(item) ? (
										<SheetGroup group={item} />
									) : (
										<a
											href={item.href}
											aria-current={item.current ? "page" : undefined}
											mix={[sheetRow()]}
										>
											{item.label}
										</a>
									)}
								</li>
							))}
						</ul>
					</nav>

					{cta || resolvedActions.length > 0 ? (
						<div data-slot="site-header-sheet-actions" mix={[sheetActions()]}>
							{resolvedActions.map((action, index) => (
								<LinkButton
									key={index}
									href={action.href}
									variant="surface"
									color="neutral"
									size="lg"
									mix={[raw({ inlineSize: "100%", justifyContent: "center" })]}
								>
									{action.label}
								</LinkButton>
							))}
							{cta ? (
								<LinkButton
									href={cta.href}
									color="brand"
									size="lg"
									mix={[raw({ inlineSize: "100%", justifyContent: "center" })]}
								>
									{cta.label}
								</LinkButton>
							) : null}
						</div>
					) : null}
					{sheet}
				</dialog>
			</header>
		);
	};
}

/**
 * Props {@link GroupEntry} reads: the group, the panel's id, and the anchor name the
 * panel's position resolves against.
 */
interface GroupEntryProps {
	group: SiteHeader.Group;
	panelId: string;
	anchor: string;
	floating: boolean;
}

/**
 * A group's trigger and the mega panel it toggles. The panel follows the trigger in the
 * document, so the trigger's chevron turns from `:has(+ :popover-open)` with no script.
 */
function GroupEntry(handle: Handle<GroupEntryProps>) {
	return () => {
		let { anchor, floating, group, panelId } = handle.props;

		return (
			<>
				<button
					type="button"
					commandfor={panelId}
					command="toggle-popover"
					data-slot="site-header-group-trigger"
					mix={[navTrigger(), groupTrigger()]}
				>
					{group.label}
					<ChevronDownIcon aria-hidden="true" />
				</button>
				<div
					id={panelId}
					popover="auto"
					data-slot="site-header-panel"
					style={{ positionAnchor: anchor }}
					mix={[panelSurface(floating)]}
				>
					<div mix={[panelGrid(group.columns.length, floating)]}>
						{group.columns.map((column, index) => (
							<div key={index} data-slot="site-header-column">
								<p data-variant="mono" mix={[eyebrow(), raw({ marginBlockEnd: "0.75rem" })]}>
									{column.title}
								</p>
								<ul mix={[raw({ listStyle: "none", margin: "0", padding: "0" })]}>
									{column.links.map((link, linkIndex) => (
										<li key={linkIndex}>
											<a
												href={link.href}
												aria-current={link.current ? "page" : undefined}
												mix={[panelLink()]}
											>
												{link.icon ? (
													<span aria-hidden="true" mix={[panelIcon()]}>
														{link.icon}
													</span>
												) : null}
												<span mix={[raw({ display: "grid", gap: "0.125rem", minInlineSize: "0" })]}>
													<span
														mix={[
															raw({ fontWeight: "500", color: "var(--ui-neutral-fg-emphasis)" }),
														]}
													>
														{link.label}
													</span>
													{link.description ? (
														<span
															mix={[
																raw({
																	fontSize: "0.8125rem",
																	lineHeight: "1.25rem",
																	color: "var(--ui-neutral-fg-muted)",
																}),
															]}
														>
															{link.description}
														</span>
													) : null}
												</span>
											</a>
										</li>
									))}
								</ul>
							</div>
						))}
					</div>
					{group.footer ? (
						<div mix={[panelFooter(floating)]}>
							<a href={group.footer.href} mix={[panelFooterLink()]}>
								{group.footer.label}
								<span aria-hidden="true">→</span>
							</a>
						</div>
					) : null}
				</div>
			</>
		);
	};
}

/**
 * Props {@link SheetGroup} reads.
 */
interface SheetGroupProps {
	group: SiteHeader.Group;
}

/**
 * A group as a disclosure in the phone sheet: the summary is a full row, and the columns
 * open beneath it under their eyebrows, so a long menu drills down without script.
 */
function SheetGroup(handle: Handle<SheetGroupProps>) {
	return () => {
		let { group } = handle.props;
		let links = group.footer ? [group.footer] : [];

		return (
			<details data-slot="site-header-sheet-group" mix={[sheetGroup()]}>
				<summary mix={[sheetRow(), sheetSummary()]}>
					{group.label}
					<ChevronDownIcon aria-hidden="true" />
				</summary>
				<div mix={[raw({ display: "grid", gap: "1.25rem", paddingBlockEnd: "1rem" })]}>
					{group.columns.map((column, index) => (
						<div key={index}>
							<p data-variant="mono" mix={[eyebrow(), raw({ marginBlock: "0.25rem" })]}>
								{column.title}
							</p>
							<ul mix={[raw({ listStyle: "none", margin: "0", padding: "0" })]}>
								{column.links.map((link, linkIndex) => (
									<li key={linkIndex}>
										<a
											href={link.href}
											aria-current={link.current ? "page" : undefined}
											mix={[sheetSubRow()]}
										>
											{link.label}
										</a>
									</li>
								))}
							</ul>
						</div>
					))}
					{links.map((link, index) => (
						<a
							key={`footer-${index}`}
							href={link.href}
							mix={[sheetSubRow(), raw({ fontWeight: "600" })]}
						>
							{link.label} <span aria-hidden="true">→</span>
						</a>
					))}
				</div>
			</details>
		);
	};
}

/** Whether a navigation entry opens a panel rather than navigating. */
function isGroup(item: SiteHeader.Item): item is SiteHeader.Group {
	return "columns" in item;
}

/** Hides an element until the header reaches `breakpoint`, then shows it with `display`. */
function showFrom(breakpoint: SiteHeader.CollapseAt, display: string) {
	return combine([raw({ display: "none" }), at(breakpoint, CONTAINER, raw({ display }))]);
}

/**
 * The full-width bar: transparent at the top of the page, then the blurred fill and a
 * hairline once the page has scrolled {@link FILL_RANGE}. Engines without scroll
 * timelines show the filled state from the start.
 */
function fullBar() {
	return combine([
		keyframes(BAR_FILL_KEYFRAMES, {
			from: { backgroundColor: "transparent", borderBlockEndColor: "transparent" },
			to: { backgroundColor: FILL, borderBlockEndColor: "var(--ui-marketing-hairline)" },
		}),
		raw({
			inlineSize: "100%",
			backgroundColor: FILL,
			borderBlockEnd: "1px solid var(--ui-marketing-hairline)",
			backdropFilter: "blur(12px)",
		}),
		supports(
			"(animation-timeline: scroll())",
			raw({
				animationName: BAR_FILL_KEYFRAMES,
				animationDuration: "auto",
				animationTimingFunction: "linear",
				animationFillMode: "both",
				animationTimeline: "scroll(root block)",
				animationRange: `0 ${FILL_RANGE}`,
			}),
		),
	]);
}

/**
 * The floating bar: a rounded panel the width of the content measure, held
 * {@link FLOAT_GAP} off the edges, that gains the fill, an edge and a shadow on scroll.
 */
function floatingBar() {
	let filled = {
		backgroundColor: FILL,
		boxShadow: `inset 0 0 0 1px var(--ui-marketing-hairline), ${FLOAT_SHADOW}`,
	};

	return combine([
		keyframes(FLOAT_FILL_KEYFRAMES, {
			from: {
				backgroundColor: "transparent",
				boxShadow: "inset 0 0 0 1px transparent, 0 0 0 0 transparent",
			},
			to: filled,
		}),
		raw({
			...filled,
			inlineSize: "100%",
			maxInlineSize: "calc(var(--ui-marketing-measure, 72rem) - 1rem)",
			marginInline: "auto",
			borderRadius: "1rem",
			backdropFilter: "blur(12px)",
		}),
		supports(
			"(animation-timeline: scroll())",
			raw({
				animationName: FLOAT_FILL_KEYFRAMES,
				animationDuration: "auto",
				animationTimingFunction: "linear",
				animationFillMode: "both",
				animationTimeline: "scroll(root block)",
				animationRange: `0 ${FILL_RANGE}`,
			}),
		),
	]);
}

/**
 * The bar's row. A full bar uses the content measure, so the brand lines up with every
 * band's copy; a floating bar's padding is the gutter less its own inset, which keeps the
 * same alignment. From `breakpoint` the row is three tracks, so the links sit centered.
 */
function row(floating: boolean, breakpoint: SiteHeader.CollapseAt) {
	return [
		floating
			? combine([
					raw({ paddingInline: "calc(var(--ui-marketing-gutter, 1rem) - 0.5rem)" }),
					at("md", CONTAINER, raw({ paddingInline: "1rem" })),
					at("lg", CONTAINER, raw({ paddingInline: "1.5rem" })),
				])
			: marketingContainer(),
		raw({
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: "1rem",
			blockSize: floating ? FLOAT_HEIGHT : BAR_HEIGHT,
		}),
		at(
			breakpoint,
			CONTAINER,
			raw({
				display: "grid",
				gridTemplateColumns: "1fr auto 1fr",
				gap: "2rem",
			}),
		),
	];
}

/** The brand cell: never shrinks, and centers an inline logo on the row. */
function brandSlot() {
	return raw({
		display: "flex",
		alignItems: "center",
		flexShrink: "0",
		minInlineSize: "0",
		color: "var(--ui-neutral-fg-emphasis)",
	});
}

/** The trailing cell: tools, actions, the primary action and the menu button, end-aligned. */
function endSlot() {
	return raw({
		display: "flex",
		alignItems: "center",
		justifyContent: "flex-end",
		gap: "0.5rem",
		minInlineSize: "0",
	});
}

/** The inline link row, with links spaced like Linear's and Vercel's bars. */
function navList() {
	return raw({
		display: "flex",
		alignItems: "center",
		gap: "0.25rem",
		listStyle: "none",
		margin: "0",
		padding: "0",
	});
}

/**
 * A bar link or group trigger: 0.875rem medium in the body ink, no underline at rest, and
 * a quiet tint on hover. The current page reads in the heading ink.
 */
function navTrigger() {
	return combine([
		raw({
			display: "inline-flex",
			alignItems: "center",
			gap: "0.25rem",
			minBlockSize: "2.25rem",
			paddingInline: "0.75rem",
			border: "0",
			borderRadius: "0.5rem",
			background: "transparent",
			font: "inherit",
			fontSize: "0.875rem",
			lineHeight: "1.25rem",
			fontWeight: "500",
			color: "var(--ui-neutral-fg)",
			textDecoration: "none",
			cursor: "pointer",
			whiteSpace: "nowrap",
			transitionProperty: "color, background-color",
			transitionDuration: "150ms",
		}),
		hover(
			raw({
				color: "var(--ui-neutral-fg-emphasis)",
				backgroundColor: "var(--ui-neutral-bg-tint-hover)",
			}),
		),
		when('&[aria-current="page"]', raw({ color: "var(--ui-neutral-fg-emphasis)" })),
		when(
			"&:focus-visible",
			raw({
				outline: "2px solid var(--ui-focus-ring, var(--ui-brand-border-strong))",
				outlineOffset: "2px",
			}),
		),
	]);
}

/** Turns a trigger's chevron while its panel is open. */
function groupTrigger() {
	return combine([
		when(
			"& > svg",
			raw({
				inlineSize: "0.875rem",
				blockSize: "0.875rem",
				color: "var(--ui-neutral-fg-muted)",
				transitionProperty: "rotate",
				transitionDuration: "150ms",
			}),
		),
		when("&:has(+ :popover-open)", raw({ color: "var(--ui-neutral-fg-emphasis)" })),
		when("&:has(+ :popover-open) > svg", raw({ rotate: "180deg" })),
	]);
}

/**
 * The menu and close buttons: a framed 2.5rem control, matching the primary action's
 * height and, through `--ui-button-radius`, its corners, whose hit area grows to the
 * theme's coarse-pointer target of 44px.
 */
function menuButton() {
	return [
		raw({
			display: "inline-grid",
			placeItems: "center",
			flexShrink: "0",
			position: "relative",
			inlineSize: "2.5rem",
			blockSize: "2.5rem",
			padding: "0",
			border: "0",
			borderRadius: "var(--ui-button-radius, 0.625rem)",
			background: "var(--ui-bg)",
			boxShadow: "var(--ui-shadow-control, inset 0 0 0 1px var(--ui-marketing-hairline))",
			color: "var(--ui-neutral-fg-emphasis)",
			cursor: "pointer",
		}),
		hitArea(),
		when("& > svg", raw({ inlineSize: "1.25rem", blockSize: "1.25rem" })),
		hover(raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })),
		when(
			"&:focus-visible",
			raw({
				outline: "2px solid var(--ui-focus-ring, var(--ui-brand-border-strong))",
				outlineOffset: "2px",
			}),
		),
	];
}

/**
 * The mega panel: fixed under the bar through anchor positioning, the bar's width, with
 * the float shadow and a dimmed page behind it from the bar down. Engines without anchor
 * positioning place it at the bar's known height.
 */
function panelSurface(floating: boolean) {
	let top = floating ? `calc(${FLOAT_GAP} + ${FLOAT_HEIGHT} + 0.5rem)` : BAR_HEIGHT;

	return combine([
		raw({
			position: "fixed",
			insetBlockStart: top,
			insetBlockEnd: "auto",
			inlineSize: "auto",
			insetInline: floating ? FLOAT_GAP : "0",
			margin: "0",
			marginInline: floating ? "auto" : "0",
			maxInlineSize: floating ? "calc(var(--ui-marketing-measure, 72rem) - 1rem)" : "none",
			padding: "0",
			border: "0",
			borderRadius: floating ? "1rem" : "0",
			backgroundColor: "var(--ui-surface-raised, var(--ui-bg))",
			color: "var(--ui-neutral-fg)",
			boxShadow: floating
				? `inset 0 0 0 1px var(--ui-marketing-hairline), ${FLOAT_SHADOW}`
				: `0 1px 0 var(--ui-marketing-hairline), ${FLOAT_SHADOW}`,
			maxBlockSize: `calc(100dvh - ${top} - 1rem)`,
			overflowY: "auto",
		}),
		supports(
			"(anchor-name: --a)",
			raw({
				insetBlockStart: floating ? "calc(anchor(bottom) + 0.5rem)" : "anchor(bottom)",
				insetInlineStart: "anchor(start)",
				insetInlineEnd: "anchor(end)",
				marginInline: "0",
				maxInlineSize: "none",
			}),
		),
		when(
			"&::backdrop",
			raw({
				insetBlockStart: top,
				backgroundColor: "rgb(0 0 0 / 0.08)",
				backdropFilter: "blur(2px)",
			}),
		),
		dark(when("&::backdrop", raw({ backgroundColor: "rgb(0 0 0 / 0.4)" }))),
		motionSafe(
			combine([
				raw({
					transitionProperty: "opacity, translate, display, overlay",
					transitionDuration: "150ms",
					transitionBehavior: "allow-discrete",
				}),
				when("&:popover-open", startingStyle(raw({ opacity: "0", translate: "0 -0.25rem" }))),
			]),
		),
	]);
}

/**
 * The panel's columns: as many equal tracks as the group has columns (one to four), on
 * the content measure, so a three-column group never leaves an empty fourth track.
 */
function panelGrid(count: number, floating: boolean) {
	let tracks = Math.min(Math.max(count, 1), 4);

	return [
		floating ? raw({ paddingInline: "1.5rem" }) : marketingContainer(),
		raw({
			display: "grid",
			gridTemplateColumns: `repeat(${tracks}, minmax(0, 1fr))`,
			columnGap: "2rem",
			rowGap: "1.5rem",
			paddingBlock: "1.75rem",
		}),
	];
}

/** A panel link: a 44px row with an optional glyph well, the label, and a muted line. */
function panelLink() {
	return combine([
		raw({
			display: "flex",
			alignItems: "flex-start",
			gap: "0.75rem",
			minBlockSize: "2.75rem",
			marginInline: "-0.625rem",
			paddingBlock: "0.5rem",
			paddingInline: "0.625rem",
			borderRadius: "0.625rem",
			fontSize: "0.9375rem",
			lineHeight: "1.375rem",
			textDecoration: "none",
		}),
		hover(raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })),
		when(
			"&:focus-visible",
			raw({
				outline: "2px solid var(--ui-focus-ring, var(--ui-brand-border-strong))",
				outlineOffset: "0",
			}),
		),
	]);
}

/** The glyph well beside a panel link, sized so a 1.25rem icon centers in 2.25rem. */
function panelIcon() {
	return combine([
		raw({
			display: "grid",
			placeItems: "center",
			flexShrink: "0",
			inlineSize: "2.25rem",
			blockSize: "2.25rem",
			borderRadius: "0.5rem",
			color: "var(--ui-neutral-fg-emphasis)",
			boxShadow: "inset 0 0 0 1px var(--ui-marketing-hairline)",
		}),
		when("& > svg", raw({ inlineSize: "1.25rem", blockSize: "1.25rem" })),
	]);
}

/** The panel's closing row, ruled off from the columns. */
function panelFooter(floating: boolean) {
	return [
		floating ? raw({ paddingInline: "1.5rem" }) : marketingContainer(),
		raw({
			display: "flex",
			paddingBlock: "1rem",
			borderBlockStart: "1px solid var(--ui-marketing-hairline)",
		}),
	];
}

/** The panel's closing link, set in the heading ink with a trailing arrow. */
function panelFooterLink() {
	return combine([
		raw({
			display: "inline-flex",
			alignItems: "center",
			gap: "0.375rem",
			fontSize: "0.875rem",
			fontWeight: "500",
			color: "var(--ui-neutral-fg-emphasis)",
			textDecoration: "none",
		}),
		hover(raw({ textDecoration: "underline", textUnderlineOffset: "4px" })),
	]);
}

/**
 * The phone sheet: a modal dialog covering the viewport, opaque, with the bar repeated at
 * its top, a scrolling list, and the actions pinned to its foot. Its entry fades and drops
 * 0.5rem in 150ms when motion is allowed.
 */
function sheetSurface() {
	return combine([
		keyframes(SHEET_ENTER_KEYFRAMES, {
			from: { opacity: "0", translate: "0 -0.5rem" },
			to: { opacity: "1", translate: "0 0" },
		}),
		raw({
			position: "fixed",
			inset: "0",
			inlineSize: "100%",
			blockSize: "100dvh",
			maxInlineSize: "none",
			maxBlockSize: "none",
			margin: "0",
			padding: "0",
			border: "0",
			backgroundColor: "var(--ui-bg)",
			color: "var(--ui-neutral-fg)",
			overscrollBehavior: "contain",
		}),
		when(
			"&[open]",
			raw({
				display: "grid",
				gridTemplateRows: "auto minmax(0, 1fr) auto",
			}),
		),
		when("&::backdrop", raw({ backgroundColor: "var(--ui-bg)" })),
		motionSafe(
			when(
				"&[open]",
				raw({
					animationName: SHEET_ENTER_KEYFRAMES,
					animationDuration: "150ms",
					animationTimingFunction: "cubic-bezier(.2,.7,.2,1)",
				}),
			),
		),
	]);
}

/** The sheet's top row: the brand and the close button on the bar's height and gutter. */
function sheetTop() {
	return [
		marketingContainer(),
		raw({
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: "1rem",
			inlineSize: "100%",
			boxSizing: "border-box",
			blockSize: BAR_HEIGHT,
			borderBlockEnd: "1px solid var(--ui-marketing-hairline)",
		}),
	];
}

/** The sheet's scrolling list, on the bar's gutter. */
function sheetBody() {
	return [
		marketingContainer(),
		raw({
			inlineSize: "100%",
			boxSizing: "border-box",
			overflowY: "auto",
			overscrollBehavior: "contain",
			paddingBlockEnd: "1rem",
		}),
	];
}

/** A top-level sheet row: 3.25rem tall, 1.125rem medium in the heading ink. */
function sheetRow() {
	return combine([
		raw({
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: "1rem",
			minBlockSize: "3.25rem",
			fontSize: "1.125rem",
			lineHeight: "1.5rem",
			fontWeight: "500",
			color: "var(--ui-neutral-fg-emphasis)",
			textDecoration: "none",
			cursor: "pointer",
		}),
		when(
			'&[aria-current="page"]',
			raw({ color: "var(--ui-brand-fg, var(--ui-neutral-fg-emphasis))" }),
		),
		when(
			"&:focus-visible",
			raw({
				outline: "2px solid var(--ui-focus-ring, var(--ui-brand-border-strong))",
				outlineOffset: "-2px",
			}),
		),
	]);
}

/** Strips the native marker and turns the chevron when its group is open. */
function sheetSummary() {
	return combine([
		raw({ listStyle: "none" }),
		when("&::-webkit-details-marker", raw({ display: "none" })),
		when(
			"& > svg",
			raw({
				inlineSize: "1.25rem",
				blockSize: "1.25rem",
				color: "var(--ui-neutral-fg-muted)",
				transitionProperty: "rotate",
				transitionDuration: "150ms",
			}),
		),
	]);
}

/** Turns the summary's chevron while its disclosure is open. */
function sheetGroup() {
	return when("&[open] > summary > svg", raw({ rotate: "180deg" }));
}

/** A link inside an open sheet group: a 44px row in the body ink. */
function sheetSubRow() {
	return combine([
		raw({
			display: "flex",
			alignItems: "center",
			gap: "0.375rem",
			minBlockSize: "2.75rem",
			fontSize: "1rem",
			color: "var(--ui-neutral-fg)",
			textDecoration: "none",
		}),
		hover(raw({ color: "var(--ui-neutral-fg-emphasis)" })),
		when(
			'&[aria-current="page"]',
			raw({ color: "var(--ui-neutral-fg-emphasis)", fontWeight: "600" }),
		),
	]);
}

/** The sheet's foot: the actions stacked full width above the safe-area inset. */
function sheetActions() {
	return [
		marketingContainer(),
		raw({
			display: "grid",
			gap: "0.75rem",
			inlineSize: "100%",
			boxSizing: "border-box",
			paddingBlockStart: "1rem",
			paddingBlockEnd: "max(1rem, env(safe-area-inset-bottom))",
			borderBlockStart: "1px solid var(--ui-marketing-hairline)",
		}),
	];
}
