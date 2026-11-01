/**
 * The top of an app screen in one order: where it sits (a breadcrumb, or a parent link on a
 * narrow pane), the `<h1>` with its status, a one-line description, the actions with the primary
 * one last, and an optional row of tabs. The sticky variant compacts once it is stuck.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { ChevronLeftIcon } from "@sdxc/icons";
import { bg, fg, outline } from "@sdxc/u/color";
import { mergeMix, raw } from "@sdxc/u/general";
import { focusVisible, hover, when } from "@sdxc/u/state";
import { tabularNums, text, weight } from "@sdxc/u/typography";

import { Breadcrumbs } from "../components/breadcrumbs.js";

/** The container the header measures and, when sticky, the one whose stuck state it reads. */
const CONTAINER = "ui-page-header";

/** The header's width from which the breadcrumb shows; narrower, the parent link does. */
const WIDE = `@container ${CONTAINER} (min-width: 40rem)`;

/** Every header width under {@link WIDE}. */
const NARROW = `@container ${CONTAINER} (max-width: 39.9375rem)`;

/** The sticky header once it is held at the top while motion is welcome, which is when it compacts. */
const STUCK = `@container ${CONTAINER} scroll-state(stuck: top)`;

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
		/** The one primary action, drawn last. */
		primaryAction?: RemixNode;
		/** Secondary actions, drawn before the primary one. */
		actions?: RemixNode;
		/** An overflow menu's trigger and menu, drawn before the secondary actions. */
		overflow?: RemixNode;
		tabs?: Tab[];
		/** The tabs landmark's name, such as "Monitor views". */
		tabsLabel?: string;
		/**
		 * Sticks the header at `--ui-app-sticky-top` and compacts it once stuck: the trail and the
		 * description fold away and the title shrinks. Reduced motion keeps it full size.
		 * @default false
		 */
		sticky?: boolean;
	}
}

/**
 * Renders the header. Titles and descriptions wrap inside the pane, actions wrap below the title
 * on a narrow pane, and tabs scroll sideways inside their own row. A sticky header spans the
 * shell's gutter (`--ui-app-gutter`) so content never shows beside it as it scrolls under.
 *
 * @param handle Runtime handle carrying the header's props.
 * @returns The render function producing the header's markup.
 * @example
 * <PageHeader crumbsLabel="Breadcrumb" crumbs={[{ label: "Monitors", href: "/monitors" }, { label: "api.acme.dev" }]} title="api.acme.dev" status={<Badge color="success">Up</Badge>} actions={<Button variant="outline">Pause</Button>} primaryAction={<Button>Edit monitor</Button>} />
 */
export function PageHeader(handle: Handle<PageHeader.Props>) {
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
			sticky = DEFAULT_STICKY,
			mix,
			...rest
		} = handle.props;
		let back = parent ?? parentOf(crumbs);
		let hasActions = primaryAction !== undefined || actions !== undefined || overflow !== undefined;

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
							containerType: sticky ? "inline-size scroll-state" : "inline-size",
							containerName: CONTAINER,
							overflowWrap: "anywhere",
						}),
						sticky
							? [
									raw({
										position: "sticky",
										insetBlockStart: "var(--ui-app-sticky-top, 0px)",
										zIndex: "2",
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
							raw({
								display: "flex",
								flexWrap: "wrap",
								alignItems: "center",
								columnGap: "1rem",
								rowGap: "0.75rem",
							}),
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
									flex: "1 1 16rem",
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

						{hasActions ? (
							<div
								data-slot="page-header-actions"
								mix={[
									raw({
										display: "flex",
										flexWrap: "wrap",
										alignItems: "center",
										gap: "0.5rem",
										marginInlineStart: "auto",
										maxInlineSize: "100%",
									}),
								]}
							>
								{overflow ? (
									<span data-slot="page-header-overflow" mix={[raw({ display: "contents" })]}>
										{overflow}
									</span>
								) : null}
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
							</div>
						) : null}
					</div>

					{description ? (
						<Fold sticky={sticky}>
							<p
								data-slot="page-header-description"
								mix={[raw({ margin: "0", maxInlineSize: "75ch" }), text("sm"), fg("neutral.muted")]}
							>
								{description}
							</p>
						</Fold>
					) : null}

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
								{tabs.map((tab) => (
									<li key={tab.href}>
										<a
											href={tab.href}
											aria-current={tab.current ? "page" : undefined}
											mix={[
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
											]}
										>
											{tab.label}
											{tab.count !== undefined ? (
												<span
													data-slot="page-header-tab-count"
													mix={[
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
													]}
												>
													{tab.count}
												</span>
											) : null}
										</a>
									</li>
								))}
							</ul>
						</nav>
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
	children?: RemixNode;
}

/**
 * A row the sticky header folds away once stuck, by collapsing a one-row grid to zero height,
 * which animates without measuring the row. A static header draws the row as is.
 */
function Fold(handle: Handle<FoldProps>) {
	return () => {
		let { sticky, children } = handle.props;
		if (!sticky) return <div data-slot="page-header-fold">{children}</div>;
		return (
			<div
				data-slot="page-header-fold"
				mix={[
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
				]}
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
