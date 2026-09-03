/**
 * A hierarchical list of nodes built from nested `<details>` and `<summary>`
 * elements, so a branch's expand/collapse state, keyboard toggling, and
 * content hiding all come from the platform rather than tracked state.
 * {@link Tree.Item} nests further {@link Tree.Item} nodes directly inside
 * itself to describe a subtree, {@link Tree.ItemContent} renders each node's
 * always-visible row, and {@link Tree.LoadMoreItem} holds a trailing loading
 * placeholder exactly like a row list's own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { ChevronRightIcon } from "@pkg/icons";
import { bg, fg, outline } from "@pkg/u/color";
import { opacity, rounded, transition, transitionDuration } from "@pkg/u/effects";
import { cursor, listStyle, raw } from "@pkg/u/general";
import { center, hidden, hstack, interpolateSize, shrink, vstack } from "@pkg/u/layout";
import { clip } from "@pkg/u/overflow";
import { media } from "@pkg/u/responsive";
import { bs, is, pb, pie, pi } from "@pkg/u/size";
import { detailsContent, when } from "@pkg/u/state";
import { rotate } from "@pkg/u/transform";
import { text } from "@pkg/u/typography";
import { attrs } from "remix/ui";

import { interactiveTransition } from "../styles/interactive-transition";
import { panelChrome } from "../styles/panel-chrome";
import { warnIfNoAccessibleLabel } from "../utils/warn-if-no-accessible-name";

import { SentinelRow } from "./sentinel-row";

/** `role="tree"` applied to {@link Tree} through {@link attrs} unless a consumer supplies its own `role`. */
const DEFAULT_ROLE = "tree";

/**
 * `role="group"` applied to {@link Tree.Item} through {@link attrs} unless a
 * consumer supplies its own `role` — the only role a native `<details>`
 * accepts, and a fitting one since each item's own `<details>` groups its nodes.
 */
const DEFAULT_ITEM_ROLE = "group";

/** `role="treeitem"` applied to {@link Tree.ItemContent} through {@link attrs} unless a consumer supplies its own `role`. */
const DEFAULT_CONTENT_ROLE = "treeitem";

/**
 * Nesting depth {@link Tree.Item} falls back to when nothing wraps it in
 * another {@link Tree.Item} at all, so a root-level node's row renders with
 * no extra indentation and an `aria-level` of `1`.
 */
const DEFAULT_DEPTH = 0;

/**
 * Marker {@link Tree.ExpandButton} always carries as its `data-slot`
 * attribute, applied through {@link attrs} unless a consumer supplies its
 * own value, letting {@link Tree.Item}'s styling target just this chevron.
 */
const DEFAULT_EXPAND_BUTTON_SLOT = "expand-button";

/**
 * Prop and context types for {@link Tree} and its compound parts.
 */
export namespace Tree {
	/** Value each {@link Tree.Item} provides to the nodes nested inside it. */
	export interface ItemContext {
		/** Nesting depth this item occupies, `0` for a node rendered directly inside {@link Tree}. */
		depth: number;
	}

	/**
	 * Props accepted by {@link Tree}.
	 */
	export interface Props extends TagProps<"div"> {
		/** {@link Tree.Item} and {@link Tree.LoadMoreItem} nodes to render. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Tree.Item}. Every native `<details>` attribute
	 * still applies, so `open` sets a branch's initial and current expanded
	 * state declaratively, exactly as on any native `<details>` element.
	 */
	export interface ItemProps extends TagProps<"details"> {
		/**
		 * Stable identifier for this node, mirrored onto the rendered element's
		 * own `id` and a `data-rmx-key` attribute so a paired selection, navigation, or
		 * reorder behavior can correlate the node with its own tracked state.
		 */
		id: string;
		/** The node's {@link Tree.ItemContent} row, followed by zero or more nested {@link Tree.Item} nodes describing its subtree. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Tree.ItemContent}.
	 */
	export interface ItemContentProps extends TagProps<"summary"> {}

	/**
	 * Props accepted by {@link Tree.LoadMoreItem}.
	 */
	export interface LoadMoreItemProps extends TagProps<"div"> {}

	/**
	 * Props accepted by {@link Tree.ExpandButton}: every native `<button>`
	 * attribute except `type` (fixed to `"button"` so it never submits an
	 * enclosing form), plus a required `aria-label` for the icon-only control.
	 */
	export interface ExpandButtonProps extends Omit<TagProps<"button">, "type"> {
		/** Accessible name for the icon-only control, e.g. "Expand" or "Collapse". */
		"aria-label": string;
	}
}

/**
 * Reads the nesting depth published by the nearest ancestor {@link Tree.Item},
 * resolving to `undefined` when the lookup finds no ancestor item at all.
 *
 * @param handle Runtime handle of the component performing the lookup.
 * @returns The nearest ancestor item's depth, or `undefined` where nothing wraps the caller.
 * @example
 * let ambient = readAmbientDepth(handle); // 1, nested one level inside a Tree.Item holding depth 1
 */
function readAmbientDepth(handle: Handle<unknown, any>): number | undefined {
	try {
		let ambient = handle.context.get(TreeItem) as Tree.ItemContext | undefined;

		return ambient?.depth;
	} catch {
		return undefined;
	}
}

/**
 * Renders the tree's root host: a bordered `<div>` carrying `role="tree"`,
 * stacking {@link Tree.Item} nodes in block flow, with `data-empty`
 * centering a fallback message; an unlabeled tree logs a dev `console.warn`.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the tree's markup.
 * @example
 * <Tree aria-label={t("files.title")}>
 * 	<Tree.Item id="src">
 * 		<Tree.ItemContent>
 * 			<Tree.ExpandButton aria-label={t("files.expand")} />
 * 			{t("files.folder", { name: "src" })}
 * 		</Tree.ItemContent>
 * 		<Tree.Item id="src-index">
 * 			<Tree.ItemContent>{t("files.file", { name: "index.ts" })}</Tree.ItemContent>
 * 		</Tree.Item>
 * 	</Tree.Item>
 * </Tree>
 * @example
 * <Tree aria-label={t("files.title")} data-empty>
 * 	{t("files.empty")}
 * </Tree>
 */
export function Tree(handle: Handle<Tree.Props>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		warnIfNoAccessibleLabel(
			handle.props,
			'Tree: needs an "aria-label" or "aria-labelledby" describing its contents for assistive technology.',
		);

		return (
			<div
				{...rest}
				mix={[
					attrs({ role: DEFAULT_ROLE }),
					panelChrome(),
					when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
					vstack(),
					pb(1),
					pi(1),
					outline("none"),
					when("&[data-empty]", [center(), pb(8), fg("neutral.muted")]),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
}

/**
 * Renders a node as a native `<details>`, so a subtree's reveal and `[open]`
 * state come from the platform. Nest {@link Tree.ItemContent} first as the
 * row, then nested {@link Tree.Item} children; reveal animates via `::details-content`.
 *
 * @param handle Runtime handle carrying the host `<details>`'s props and providing {@link Tree.ItemContext} to nodes nested inside it.
 * @returns The render function producing the node's markup.
 * @example
 * <Tree.Item id="src">
 * 	<Tree.ItemContent>
 * 		<Tree.ExpandButton aria-label={t("files.expand")} />
 * 		{t("files.folder", { name: "src" })}
 * 	</Tree.ItemContent>
 * 	<Tree.Item id="src-index">
 * 		<Tree.ItemContent>{t("files.file", { name: "index.ts" })}</Tree.ItemContent>
 * 	</Tree.Item>
 * </Tree.Item>
 * @example
 * <Tree.Item id="src" open>
 * 	<Tree.ItemContent>
 * 		<Tree.ExpandButton aria-label={t("files.collapse")} />
 * 		{t("files.folder", { name: "src" })}
 * 	</Tree.ItemContent>
 * </Tree.Item>
 */
function TreeItem(handle: Handle<Tree.ItemProps, Tree.ItemContext>) {
	return () => {
		let { id, children, mix, ...rest } = handle.props;
		let ambient = readAmbientDepth(handle);
		let depth = ambient === undefined ? DEFAULT_DEPTH : ambient + 1;

		handle.context.set({ depth });

		return (
			<details
				{...rest}
				id={id}
				data-rmx-key={id}
				mix={[
					attrs({ role: DEFAULT_ITEM_ROLE }),
					interpolateSize(),
					detailsContent([clip(), bs(0)]),
					detailsContent([
						raw({
							transitionProperty: "block-size, content-visibility",
							transitionBehavior: "allow-discrete",
						}),
						transitionDuration("200ms"),
					]),
					when("&[open]::details-content", bs("auto")),
					when(`&[open] > summary [data-slot="${DEFAULT_EXPAND_BUTTON_SLOT}"]`, rotate(90)),
					media("(prefers-reduced-motion: reduce)", detailsContent(transitionDuration("0s"))),
					mix,
				]}
			>
				{children}
			</details>
		);
	};
}

Tree.Item = TreeItem;

/**
 * Renders {@link Tree.ItemContentProps.children} inside a native
 * `<summary>` — the enclosing {@link Tree.Item}'s always-visible row —
 * indented from its ambient depth, with `aria-selected`/`aria-disabled` styling.
 *
 * @param handle Runtime handle carrying the host `<summary>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <Tree.ItemContent>
 * 	<Tree.ExpandButton aria-label={t("files.expand")} />
 * 	{t("files.folder", { name: "src" })}
 * </Tree.ItemContent>
 * @example
 * <Tree.ItemContent aria-selected="true">
 * 	{t("files.file", { name: "index.ts" })}
 * </Tree.ItemContent>
 */
Tree.ItemContent = function TreeItemContent(handle: Handle<Tree.ItemContentProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		let depth = readAmbientDepth(handle) ?? DEFAULT_DEPTH;

		return (
			<summary
				{...rest}
				mix={[
					interactiveTransition(),
					attrs({ role: DEFAULT_CONTENT_ROLE, "aria-level": depth + 1 }),
					hstack({ gap: 2, align: "center" }),
					rounded("md"),
					pb(1.5),
					pie(3),
					fg("neutral.emphasis"),
					cursor("default"),
					listStyle(),
					raw({
						paddingInlineStart: `calc(0.5rem + ${depth} * var(--ui-tree-indent, 1.25rem))`,
					}),
					outline("none"),
					text("sm"),
					when("&::-webkit-details-marker", hidden()),
					when("&::marker", raw({ content: '""' })),
					media("(prefers-reduced-motion: reduce)", transitionDuration("0s")),
					when("&:hover", bg("neutral.bg-tint-hover")),
					when("&:active", bg("neutral.bg-tint-pressed")),
					when("&:focus", bg("neutral.bg-tint-hover")),
					when('&[aria-selected="true"]', bg("brand.tint")),
					when('&[aria-disabled="true"]', opacity(50)),
					mix,
				]}
			>
				{children}
			</summary>
		);
	};
};

/**
 * Renders a decorative sentinel node: a `<div>` styled as centered, muted
 * small text sized to match {@link Tree.ItemContent}'s vertical rhythm,
 * ready to hold whatever loading indicator a paired enhancement supplies.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the sentinel node's markup.
 * @example
 * <Tree.LoadMoreItem>{t("files.loadingMore")}</Tree.LoadMoreItem>
 */
Tree.LoadMoreItem = SentinelRow;

/**
 * Renders the chevron a node's row shows for a subtree, rotated 90 degrees
 * while the enclosing {@link Tree.Item}'s `<details>` carries `[open]`.
 * `type="button"` precedes the consumer's attributes so a `command`/`commandfor` invoker still runs inside a `<form>`.
 *
 * @param handle Runtime handle carrying the host `<button>`'s props.
 * @returns The render function producing the chevron's markup.
 * @example
 * <Tree.ItemContent>
 * 	<Tree.ExpandButton aria-label={t("files.expand")} />
 * 	{t("files.folder", { name: "src" })}
 * </Tree.ItemContent>
 */
Tree.ExpandButton = function TreeExpandButton(handle: Handle<Tree.ExpandButtonProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<button
				type="button"
				{...rest}
				mix={[
					attrs({ "data-slot": DEFAULT_EXPAND_BUTTON_SLOT }),
					center(),
					is(5),
					bs(5),
					rounded("sm"),
					fg("neutral.muted"),
					transition("transform, background-color"),
					shrink(),
					media("(prefers-reduced-motion: reduce)", transitionDuration("0s")),
					when("&:hover", bg("neutral.bg-tint-pressed")),
					when("&:focus-visible", outline("brand.ring")),
					mix,
				]}
			>
				{children ?? <ChevronRightIcon size={16} />}
			</button>
		);
	};
};
