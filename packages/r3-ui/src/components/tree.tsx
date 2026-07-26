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

import { ChevronRightIcon } from "@pkg/lucide-remix";
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
 * consumer supplies its own `role` — the only role the native `<details>`
 * element accepts, and a fitting one besides: each item's own `<details>`
 * is exactly what groups its nested {@link Tree.Item} nodes.
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
 * own value. {@link Tree.Item}'s own rotate-on-open styling reads this
 * attribute to find the chevron nested inside its row without also
 * matching a nested subtree's own chevron.
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
	 * state declaratively, exactly as it does on {@link Tree}'s own `<details>`
	 * siblings elsewhere in this library.
	 */
	export interface ItemProps extends TagProps<"details"> {
		/**
		 * Stable identifier for this node, mirrored onto both the rendered
		 * element's own `id` and a `data-key` attribute so a paired
		 * selection, keyboard-navigation, or reorder behavior can correlate
		 * the node with its own tracked state without parsing its rendered
		 * content.
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
	 * enclosing form), plus a required `aria-label` since the control is
	 * icon-only.
	 */
	export interface ExpandButtonProps extends Omit<TagProps<"button">, "type"> {
		/** Accessible name for the icon-only control, e.g. "Expand" or "Collapse". */
		"aria-label": string;
	}
}

/**
 * Reads the nesting depth published by the nearest ancestor {@link Tree.Item},
 * guarded so a lookup finding no ancestor item at all resolves to
 * `undefined` rather than reaching the caller as a thrown error.
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
 * Renders the tree's root host: a bordered, rounded `<div>` carrying
 * `role="tree"`, stacking {@link Tree.Item} nodes in normal block flow.
 * Setting `data-empty` centers a fallback message in place of the list, for
 * a tree with no nodes to show.
 *
 * In dev mode, a tree rendered without an `aria-label` or `aria-labelledby`
 * logs a `console.warn`, since assistive technology otherwise has no
 * accessible name to announce for it.
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
					when("&:focus-visible", outline({ color: "primary.ring", offset: 2 })),
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
 * Renders a single node as a native `<details>`, so a subtree's reveal and
 * its own `[open]` state come from the platform with no script involved.
 * Nest {@link Tree.ItemContent} first, as this node's always-visible row,
 * followed by zero or more further {@link Tree.Item} nodes describing its
 * children — the browser hides everything after that first `<summary>`
 * automatically while the details is closed, and reveals it once opened, so
 * a subtree's whole visibility rides on the native disclosure mechanism
 * rather than a class or attribute this library tracks. A node with no
 * further {@link Tree.Item} children still renders as a `<details>` for a
 * uniform structure; leave {@link Tree.ExpandButton} out of its content and
 * activating it is indistinguishable from a no-op, since there is nothing
 * to reveal.
 *
 * Reveals its subtree through the same `::details-content` `block-size`
 * transition every `<details>`-based component in this library shares,
 * animating only as progressive enhancement on top of the platform's own
 * instant show/hide.
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
				data-key={id}
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
 * Renders {@link Tree.ItemContentProps.children} inside a native `<summary>`,
 * the enclosing {@link Tree.Item}'s always-visible, always-focusable row.
 * Indented to match the nesting depth of its own {@link Tree.Item} — read
 * automatically through context rather than a prop, so composing nodes
 * keeps every row correctly indented purely by nesting — and carries an
 * `aria-level` computed from that same depth. Its default disclosure
 * triangle is suppressed in favor of a plain row layout, so nest
 * {@link Tree.ExpandButton} in `children` for a chevron that rotates on
 * `[open]`, and any leading icon or trailing content a node's row wants.
 * Setting `aria-selected="true"` reads a row as selected and
 * `aria-disabled="true"` mutes it, mirroring a row list's own row contract;
 * the browser still toggles the enclosing `<details>` on activation
 * regardless, since preventing that natively requires script a consumer
 * attaches itself.
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
					when('&[aria-selected="true"]', bg("primary.tint")),
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
 * small text, sized to match {@link Tree.ItemContent}'s own vertical
 * rhythm. Carries no loading or fetching behavior of its own — it's styling
 * only, ready to hold whatever loading indicator a paired enhancement
 * supplies as `children`.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the sentinel node's markup.
 * @example
 * <Tree.LoadMoreItem>{t("files.loadingMore")}</Tree.LoadMoreItem>
 */
Tree.LoadMoreItem = SentinelRow;

/**
 * Renders the chevron a node's row shows when it has a subtree to reveal: a
 * native `<button type="button">` carrying a fixed grip-free glyph, rotated
 * 90 degrees while the enclosing {@link Tree.Item}'s `<details>` carries
 * `[open]`. Carries no independent expand/collapse behavior of its own in
 * this baseline — nested inside {@link Tree.ItemContent}, activating it
 * toggles the same `<details>` that clicking anywhere else in the row does,
 * since telling the two apart needs script a paired behavior attaches
 * later, reading the button's `data-slot` marker to bind its own handling
 * to just this control.
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
				{...rest}
				type="button"
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
					when("&:focus-visible", outline("primary.ring")),
					mix,
				]}
			>
				{children ?? <ChevronRightIcon aria-hidden size={16} />}
			</button>
		);
	};
};
