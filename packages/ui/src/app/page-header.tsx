/**
 * The top of an app screen in one order: where it sits (a breadcrumb, or a parent link on a
 * narrow pane), the `<h1>` with its status and one-line description, the actions (secondary,
 * primary, then overflow), and an optional row of tabs that folds into "More ▾" on a narrow
 * pane. The sticky variant compacts once stuck.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { ChevronDownIcon, ChevronLeftIcon } from "@sdxc/icons";
import { bg, fg, outline } from "@sdxc/u/color";
import { mergeMix, raw } from "@sdxc/u/general";
import { focusVisible, hover, when } from "@sdxc/u/state";
import { tabularNums, text, weight } from "@sdxc/u/typography";
import { generateUUID } from "@sdxc/uuid/v4";

import { Breadcrumbs } from "../components/breadcrumbs.js";
import { Menu } from "../components/menu.js";

/** The container the header measures and, when sticky, the one whose stuck state it reads. */
const CONTAINER = "ui-page-header";

/** The header's width from which the breadcrumb shows; narrower, the parent link does. */
const WIDE = `@container ${CONTAINER} (min-width: 40rem)`;

/** Every header width under {@link WIDE}. */
const NARROW = `@container ${CONTAINER} (max-width: 39.9375rem)`;

/**
 * Browsers that take a scroll-state container. Every other browser keeps a plain inline-size
 * container, so the width queries that pick the trail or the parent link apply everywhere.
 */
const SCROLL_STATE_SUPPORT = "@supports (container-type: scroll-state)";

/** The sticky header once it is held at the top while motion is welcome, which is when it compacts. */
const STUCK = `@container ${CONTAINER} scroll-state(stuck: top)`;

/** How many tabs a narrow header shows before the rest fold into "More". */
const DEFAULT_NARROW_TABS = 2;

/** The overflow menu's label when `tabsMore` is omitted. */
const DEFAULT_MORE_LABEL = "More";

/** Whether the header sticks and compacts when `sticky` is omitted. */
const DEFAULT_STICKY = false;

/** Motion for the compacting rows; reduced motion keeps the header full size. */
const EASE = "200ms cubic-bezier(0.2, 0, 0, 1)";

/** Prop types for {@link PageHeader}. */
export namespace PageHeader {
	/** One step of the trail; the last one is this screen. */
	export interface Crumb {
		label: string;
		href?: string;
	}

	/** The screen above this one, linked on a narrow pane in place of the trail. */
	export interface Parent {
		href: string;
		label: string;
	}

	/** One tab under the title; each tab is a URL. */
	export interface Tab {
		href: string;
		label: string;
		/** A count after the label, such as open incidents. */
		count?: number;
		/** This tab is the view shown; sets `aria-current="page"`. */
		current?: boolean;
	}

	/** Props accepted by {@link PageHeader}. */
	export interface Props extends Omit<TagProps<"header">, "title" | "children"> {
		title: RemixNode;
		/** The trail from the app's root to this screen, shown from 40rem of header width. */
		crumbs?: Crumb[];
		/** The breadcrumb landmark's name, such as "Breadcrumb". */
		crumbsLabel?: string;
		/** The parent link shown under 40rem; defaults to the last linked crumb before this screen. */
		parent?: Parent;
		/** One line under the title. */
		description?: RemixNode;
		/** A badge after the title, such as the record's status. */
		status?: RemixNode;
		/** The one primary action, drawn after the secondary actions. */
		primaryAction?: RemixNode;
		/** Secondary actions, drawn first. */
		actions?: RemixNode;
		/** An overflow menu's trigger and menu, drawn last, so a destructive item in it comes last. */
		overflow?: RemixNode;
		tabs?: Tab[];
		/** The tabs landmark's name, such as "Monitor views". */
		tabsLabel?: string;
		/**
		 * How many tabs stay in the row under 40rem of header width; the rest move into a
		 * "More ▾" menu, the current tab always stays in the row, and the row folds only when
		 * two or more tabs would move.
		 * @default 2
		 */
		tabsNarrow?: number;
		/**
		 * The "More ▾" button's text and its menu's accessible name, in the app's own language.
		 * @default "More"
		 */
		tabsMore?: string;
		/**
		 * Sticks the header at `--ui-app-sticky-top` and compacts it once stuck: the trail and the
		 * description fold away and the title shrinks. Reduced motion keeps it full size.
		 * @default false
		 */
		sticky?: boolean;
	}
}

/**
 * Renders the header. From 40rem the actions end the title's row, the description under both;
 * narrower, actions sit beside the title or after the description, and tabs past `tabsNarrow`
 * fold into a popover "More ▾" menu that opens with no script. Sticky spans `--ui-app-gutter`.
 *
 * @param handle Runtime handle carrying the header's props.
 * @returns The render function producing the header's markup.
 * @example
 * <PageHeader crumbsLabel="Breadcrumb" crumbs={[{ label: "Monitors", href: "/monitors" }, { label: "api.acme.dev" }]} title="api.acme.dev" status={<Badge color="success">Up</Badge>} actions={<Button variant="outline">Pause</Button>} primaryAction={<Button>Edit monitor</Button>} />
 * @example
 * <PageHeader title="acme / delta" tabsLabel={t("repo.views")} tabsMore={t("repo.more")} tabs={[{ href: "/code", label: t("repo.code"), current: true }, { href: "/issues", label: t("repo.issues"), count: 26 }, { href: "/pulls", label: t("repo.pulls"), count: 71 }, { href: "/actions", label: t("repo.actions") }]} />
 */
export function PageHeader(handle: Handle<PageHeader.Props>) {
	let moreId = `page-header-more-${generateUUID()}`;

	return () => {
		let {
			title,
			crumbs = [],
			crumbsLabel,
			parent,
			description,
			status,
			primaryAction,
			actions,
			overflow,
			tabs = [],
			tabsLabel,
			tabsNarrow = DEFAULT_NARROW_TABS,
			tabsMore = DEFAULT_MORE_LABEL,
			sticky = DEFAULT_STICKY,
			mix,
			...rest
		} = handle.props;
		let back = parent ?? parentOf(crumbs);
		let hasActions = primaryAction !== undefined || actions !== undefined || overflow !== undefined;
		let folded = foldedTabs(tabs, tabsNarrow);

		return (
			<header
				{...rest}
				data-slot="page-header"
				data-sticky={sticky ? "" : undefined}
				mix={mergeMix(
					[
						raw({
							display: "block",
							inlineSize: "100%",
							minInlineSize: "0",
							containerType: "inline-size",
							containerName: CONTAINER,
							...(sticky ? { [SCROLL_STATE_SUPPORT]: { containerType: "inline-size scroll-state" } } : {}),
							overflowWrap: "anywhere",
						}),
						sticky
							? [
									raw({
										position: "sticky",
										insetBlockStart: "var(--ui-app-sticky-top, 0px)",
										zIndex: "2",
										boxSizing: "border-box",
										inlineSize: "calc(100% + 2 * var(--ui-app-gutter, 0px))",
										marginInline: "calc(-1 * var(--ui-app-gutter, 0px))",
										paddingInline: "var(--ui-app-gutter, 0px)",
									}),
									bg(),
								]
							: [],
					],
					mix,
				)}
			>
				<div
					data-slot="page-header-body"
					mix={[
						raw({
							display: "flex",
							flexDirection: "column",
							gap: "0.5rem",
							paddingBlock: "0 1rem",
							borderBlockEnd: "1px solid transparent",
							transition: `padding ${EASE}, border-color ${EASE}`,
						}),
						tabs.length > 0 ? raw({ paddingBlockEnd: "0" }) : [],
						sticky
							? when(
									"@media (prefers-reduced-motion: no-preference)",
									when(
										STUCK,
										tabs.length > 0
											? raw({ paddingBlockStart: "0.5rem" })
											: raw({
													paddingBlock: "0.5rem",
													borderBlockEndColor: "var(--ui-neutral-border)",
												}),
									),
								)
							: [],
						when("@media (prefers-reduced-motion: reduce)", raw({ transition: "none" })),
					]}
				>
					{crumbs.length > 0 || back ? (
						<Fold sticky={sticky}>
							{crumbs.length > 0 ? (
								<div
									data-slot="page-header-crumbs"
									mix={[
										when(NARROW, raw({ display: "none" })),
										when(WIDE, raw({ display: "block" })),
									]}
								>
									<Breadcrumbs aria-label={crumbsLabel}>
										<Breadcrumbs.List mix={[raw({ flexWrap: "wrap", rowGap: "0.25rem" })]}>
											{crumbs.map((crumb, index) => {
												let isCurrent = index === crumbs.length - 1;
												return (
													<Breadcrumbs.Item key={`${index}:${crumb.label}`}>
														<Breadcrumbs.Link
															href={isCurrent ? undefined : crumb.href}
															aria-current={isCurrent ? "page" : undefined}
														>
															{crumb.label}
														</Breadcrumbs.Link>
													</Breadcrumbs.Item>
												);
											})}
										</Breadcrumbs.List>
									</Breadcrumbs>
								</div>
							) : null}
							{back ? (
								<a
									href={back.href}
									data-slot="page-header-parent"
									mix={[
										when(WIDE, raw({ display: "none" })),
										when(
											NARROW,
											raw({
												display: "inline-flex",
												alignItems: "center",
												gap: "0.25rem",
												maxInlineSize: "100%",
												textDecoration: "none",
												borderRadius: "0.25rem",
											}),
										),
										text("sm"),
										fg("neutral.muted"),
										hover(fg("neutral.emphasis")),
										focusVisible(outline({ color: "brand.ring", offset: 2 })),
									]}
								>
									<ChevronLeftIcon size={16} aria-hidden="true" />
									{back.label}
								</a>
							) : null}
						</Fold>
					) : null}

					<div
						data-slot="page-header-main"
						mix={[
							when(
								NARROW,
								raw({
									display: "flex",
									flexWrap: "wrap",
									alignItems: "flex-start",
									columnGap: "1rem",
									rowGap: "0.75rem",
								}),
							),
							when(
								WIDE,
								raw({
									display: "grid",
									gridTemplateColumns: "minmax(0, 1fr) auto",
									gridTemplateAreas: description
										? '"title actions" "description description"'
										: '"title actions"',
									alignItems: "center",
									columnGap: "1rem",
									rowGap: "0.5rem",
								}),
							),
						]}
					>
						<div
							data-slot="page-header-heading"
							mix={[
								when(
									NARROW,
									raw({
										display: "flex",
										flexDirection: "column",
										gap: "0.5rem",
										flex: "1 1 16rem",
										minInlineSize: "0",
									}),
								),
								when(WIDE, raw({ display: "contents" })),
							]}
						>
							<div
								data-slot="page-header-title-row"
								mix={[
									raw({
										display: "flex",
										flexWrap: "wrap",
										alignItems: "center",
										gap: "0.5rem",
										gridArea: "title",
										minInlineSize: "0",
									}),
								]}
							>
								<h1
									data-slot="page-header-title"
									mix={[
										raw({
											margin: "0",
											minInlineSize: "0",
											fontSize: "1.25rem",
											lineHeight: "1.25",
											letterSpacing: "-0.01em",
											textWrap: "balance",
											transition: `font-size ${EASE}`,
										}),
										weight("semibold"),
										fg("neutral.emphasis"),
										when(WIDE, raw({ fontSize: "1.5rem" })),
										sticky
											? when(
													"@media (prefers-reduced-motion: no-preference)",
													when(STUCK, raw({ fontSize: "1rem" })),
												)
											: [],
										when("@media (prefers-reduced-motion: reduce)", raw({ transition: "none" })),
									]}
								>
									{title}
								</h1>
								{status ? (
									<span data-slot="page-header-status" mix={[raw({ display: "inline-flex" })]}>
										{status}
									</span>
								) : null}
							</div>

							{description ? (
								<Fold sticky={sticky} mix={[raw({ gridArea: "description", minInlineSize: "0" })]}>
									<p
										data-slot="page-header-description"
										mix={[
											raw({ margin: "0", maxInlineSize: "75ch" }),
											text("sm"),
											fg("neutral.muted"),
										]}
									>
										{description}
									</p>
								</Fold>
							) : null}
						</div>

						{hasActions ? (
							<div
								data-slot="page-header-actions"
								mix={[
									raw({
										display: "flex",
										flexWrap: "wrap",
										alignItems: "center",
										justifyContent: "flex-end",
										gap: "0.5rem",
										gridArea: "actions",
										marginInlineStart: "auto",
										maxInlineSize: "100%",
									}),
								]}
							>
								{actions ? (
									<span data-slot="page-header-secondary" mix={[raw({ display: "contents" })]}>
										{actions}
									</span>
								) : null}
								{primaryAction ? (
									<span data-slot="page-header-primary" mix={[raw({ display: "contents" })]}>
										{primaryAction}
									</span>
								) : null}
								{overflow ? (
									<span data-slot="page-header-overflow" mix={[raw({ display: "contents" })]}>
										{overflow}
									</span>
								) : null}
							</div>
						) : null}
					</div>

					{tabs.length > 0 ? (
						<nav
							aria-label={tabsLabel}
							data-slot="page-header-tabs"
							mix={[
								raw({
									marginBlockStart: "0.25rem",
									overflowX: "auto",
									scrollbarWidth: "none",
									boxShadow: "inset 0 -1px 0 var(--ui-neutral-border)",
								}),
							]}
						>
							<ul
								mix={[
									raw({
										display: "flex",
										gap: "1rem",
										margin: "0",
										padding: "0",
										listStyle: "none",
										inlineSize: "max-content",
									}),
								]}
							>
								{tabs.map((tab, index) => (
									<li
										key={tab.href}
										data-folded={folded.has(index) ? "" : undefined}
										mix={[folded.has(index) ? when(NARROW, raw({ display: "none" })) : []]}
									>
										<a
											href={tab.href}
											aria-current={tab.current ? "page" : undefined}
											mix={tabMix()}
										>
											{tab.label}
											{tab.count !== undefined ? <TabCount count={tab.count} /> : null}
										</a>
									</li>
								))}
								{folded.size > 0 ? (
									<li
										data-slot="page-header-tabs-more"
										mix={[when(WIDE, raw({ display: "none" }))]}
									>
										<button
											type="button"
											commandfor={moreId}
											command="toggle-popover"
											aria-haspopup="menu"
											mix={[
												...tabMix(),
												raw({
													border: "none",
													background: "none",
													padding: "0",
													fontFamily: "inherit",
													cursor: "pointer",
												}),
											]}
										>
											{tabsMore}
											<ChevronDownIcon size={14} aria-hidden="true" />
										</button>
									</li>
								) : null}
							</ul>
						</nav>
					) : null}
					{folded.size > 0 ? (
						<Menu id={moreId} placement="bottom-end" aria-label={tabsMore}>
							{tabs.map((tab, index) =>
								folded.has(index) ? (
									<Menu.Item key={tab.href} href={tab.href}>
										{tab.label}
										{tab.count !== undefined ? (
											<TabCount count={tab.count} mix={[raw({ marginInlineStart: "auto" })]} />
										) : null}
									</Menu.Item>
								) : null,
							)}
						</Menu>
					) : null}
				</div>
			</header>
		);
	};
}

/** Props accepted by {@link Fold}. */
interface FoldProps {
	/** Whether the header is the sticky variant, the only one that folds the row away. */
	sticky: boolean;
	/** Places the row in the layout around it, such as a grid area. */
	mix?: TagProps<"div">["mix"];
	children?: RemixNode;
}

/**
 * A row the sticky header folds away once stuck, by collapsing a one-row grid to zero height,
 * which animates without measuring the row. A static header draws the row as is.
 */
function Fold(handle: Handle<FoldProps>) {
	return () => {
		let { sticky, mix, children } = handle.props;
		if (!sticky) {
			return (
				<div data-slot="page-header-fold" mix={mix}>
					{children}
				</div>
			);
		}
		return (
			<div
				data-slot="page-header-fold"
				mix={mergeMix(
					[
						raw({
							display: "grid",
							gridTemplateRows: "1fr",
							transition: `grid-template-rows ${EASE}, opacity ${EASE}`,
						}),
						when(
							"@media (prefers-reduced-motion: no-preference)",
							when(STUCK, raw({ gridTemplateRows: "0fr", opacity: "0", visibility: "hidden" })),
						),
						when("@media (prefers-reduced-motion: reduce)", raw({ transition: "none" })),
					],
					mix,
				)}
			>
				<div mix={[raw({ minBlockSize: "0", overflow: "clip", overflowClipMargin: "4px" })]}>
					{children}
				</div>
			</div>
		);
	};
}

/** The last crumb before this screen that links somewhere, which is where "back" goes. */
function parentOf(crumbs: PageHeader.Crumb[]): PageHeader.Parent | undefined {
	for (let index = crumbs.length - 2; index >= 0; index--) {
		let crumb = crumbs[index];
		if (crumb?.href) return { href: crumb.href, label: crumb.label };
	}
	return undefined;
}

/**
 * The indices of the tabs a narrow header moves into "More": all but the first `narrow`,
 * where the current tab takes the last place in the row when it would have folded, so the
 * view shown is always named in the row. Empty when "More" would stand in for a single tab.
 */
function foldedTabs(tabs: PageHeader.Tab[], narrow: number): Set<number> {
	let keep = Math.max(1, narrow);
	if (tabs.length <= keep + 1) return new Set();
	let current = tabs.findIndex((tab) => tab.current);
	let shown = tabs.map((_, index) => index).slice(0, keep);
	if (current >= keep) shown[keep - 1] = current;
	return new Set(tabs.map((_, index) => index).filter((index) => !shown.includes(index)));
}

/**
 * A tab's look, shared by the links and the "More" button: a 40px row of muted text, and for
 * the current tab emphasis with a 2px accent underline.
 */
function tabMix() {
	return [
		raw({
			position: "relative",
			display: "inline-flex",
			alignItems: "center",
			gap: "0.375rem",
			blockSize: "2.5rem",
			whiteSpace: "nowrap",
			textDecoration: "none",
		}),
		text("sm"),
		fg("neutral.muted"),
		hover(fg("neutral.emphasis")),
		focusVisible(outline({ color: "brand.ring", offset: -2 })),
		when('&[aria-current="page"]', [fg("neutral.emphasis"), weight("medium")]),
		when(
			'&[aria-current="page"]::after',
			raw({
				content: '""',
				position: "absolute",
				insetInline: "0",
				insetBlockEnd: "0",
				blockSize: "2px",
				borderRadius: "2px",
				backgroundColor: "var(--ui-brand-bg-solid)",
			}),
		),
	];
}

/** Props accepted by {@link TabCount}. */
interface TabCountProps {
	count: number;
	mix?: TagProps<"span">["mix"];
}

/** A tab's count as a 12px pill, such as open issues, read before the tab is opened. */
function TabCount(handle: Handle<TabCountProps>) {
	return () => (
		<span
			data-slot="page-header-tab-count"
			mix={mergeMix(
				[
					raw({
						minInlineSize: "1.25rem",
						paddingInline: "0.375rem",
						borderRadius: "999px",
						fontSize: "0.75rem",
						lineHeight: "1.25rem",
						textAlign: "center",
						boxSizing: "border-box",
					}),
					tabularNums(),
					weight("medium"),
					bg("neutral.bg-tint-hover"),
					fg("neutral.emphasis"),
				],
				handle.props.mix,
			)}
		>
			{handle.props.count}
		</span>
	);
}
