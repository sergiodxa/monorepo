/**
 * `sidebar | list | detail` on one screen, built on Resizable: the selected record lives in
 * the URL, the split and collapsed panes persist in a cookie, the sidebar becomes a sheet
 * below 64rem and one pane per route shows below 48rem. Without a sidebar it is list + detail.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps, RemixNode } from "remix/component";

import { ArrowLeftIcon, PanelLeftIcon, PanelRightIcon } from "@sdxc/icons";
import { bg, border, fg, outline } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { cursor, pseudoContent, raw, touchAction, userSelect, mergeMix } from "@sdxc/u/general";
import { container, flex, gap, inlineFlex, items, justify, relative, shrink } from "@sdxc/u/layout";
import { bs, is, m, p, pi } from "@sdxc/u/size";
import { before, focusVisible, hover, when } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";
import { clientEntry } from "remix/component";

import { hitArea } from "../styles/hit-area.js";

import type { SplitViewKeyScope } from "./mixins/split-view.js";
import type { SplitViewLayout, SplitViewPane } from "./utils/split-view-layout.js";

import { ResizeSession } from "./behaviors/resize-session.js";
import { resizeHandle } from "./mixins/resize-handle.js";
import { splitViewHandle, splitViewKeys, splitViewToggle } from "./mixins/split-view.js";
import { Resizable } from "./resizable.js";
import { SPLIT_VIEW_COOKIE } from "./utils/split-view-layout.js";

export { SPLIT_VIEW_ITEM_ATTRIBUTE } from "./mixins/split-view.js";
export {
	SPLIT_VIEW_COOKIE,
	parseSplitViewLayout,
	readSplitViewLayout,
	serializeSplitViewLayout,
} from "./utils/split-view-layout.js";

/** Container the view names; every pane's layout answers its width. */
const CONTAINER = "ui-split-view" as const;

/** Where j/k answer when `keys` is left unset. */
const DEFAULT_KEY_SCOPE: SplitViewKeyScope = "page";

/** Below this container width the sidebar is a sheet. */
const SHEET_QUERY = `@container ${CONTAINER} (width < 64rem)` as const;

/** Below this container width the view shows one pane per route. */
const SINGLE_QUERY = `@container ${CONTAINER} (width < 48rem)` as const;

/** Builds the selector matching a pane while the view carries `attribute`. */
function whileRoot<Attribute extends string>(
	attribute: Attribute,
): `:where([data-split-view]${Attribute}) > [data-resizable-group] > &` {
	return `:where([data-split-view]${attribute}) > [data-resizable-group] > &`;
}

/**
 * Prop types for {@link SplitView}.
 */
export namespace SplitView {
	/** A pane of the view. */
	export type Pane = SplitViewPane;

	/** The remembered layout {@link readSplitViewLayout} reads from the request's cookie. */
	export type Layout = SplitViewLayout;

	/** Every string the view announces. */
	export interface Labels {
		/** The sidebar divider's name, such as "Resize folders". */
		resizeSidebar?: string;
		/** The list divider's name, such as "Resize conversations". */
		resizeList: string;
		/** The detail's back link below 48rem, such as "Conversations". */
		back: string;
	}

	/** Every native `<div>` attribute, plus the panes and how they are laid out. */
	export interface Props extends Omit<TagProps<"div">, "id"> {
		/** The view's id; its panes take `${id}-sidebar`, `${id}-list` and `${id}-detail`. */
		id: string;
		/** Folders, views, filters: omit it for a two-pane list + detail. */
		sidebar?: RemixNode;
		/** What the sidebar shows collapsed to its rail, such as its icons alone. */
		rail?: RemixNode;
		/** The list of records, each link carrying `data-split-view-item`. */
		list: RemixNode;
		/** The selected record, or nothing while none is selected. */
		detail?: RemixNode;
		/** Shown in the detail pane while nothing is selected. */
		empty?: RemixNode;
		/**
		 * The pane this route shows below 48rem.
		 *
		 * @default detail ? "detail" : "list"
		 */
		active?: Pane;
		/** The list's URL; below 48rem the detail links back to it. */
		backHref?: string;
		/** The named frame the back link loads into (`data-rmx-target`), for a view inside one. */
		frame?: string;
		/** The remembered split, from {@link readSplitViewLayout}. */
		layout?: Layout;
		/**
		 * The cookie the layout persists in; give each view on a site its own.
		 *
		 * @default "ui-split-view"
		 */
		cookie?: string;
		/** The path the layout cookie is sent under, such as one app's own prefix. @default "/" */
		cookiePath?: string;
		/**
		 * Where j/k answer: `"page"` anywhere, `"view"` only while focus is inside the view.
		 *
		 * @default "page"
		 */
		keys?: SplitViewKeyScope;
		labels: Labels;
	}
}

/**
 * Props {@link SplitViewHandle} serializes into the page for hydration, which is why they
 * are a `type`: `SerializableProps` rejects an interface.
 */
export type SplitViewHandleProps = {
	/** The pane before the divider, which Enter collapses. */
	pane: "sidebar" | "list";
	/** The divider's accessible name. */
	label: string;
	/** Ids of the panes on either side. */
	controls: string;
};

/**
 * A divider between two panes as an island: drag or ←/→ to resize, Enter to collapse the
 * pane before it; the settled layout is written to the view's cookie. Loads from
 * `@sdxc/ui/app/split-view#SplitViewHandle`; until then the panes keep their layout.
 *
 * @example <SplitViewHandle pane="list" label="Resize conversations" controls="inbox-list inbox-detail" />
 */
export const SplitViewHandle: EntryComponent<SplitViewHandleProps> = clientEntry(
	"@sdxc/ui/app/split-view#SplitViewHandle",
	function SplitViewHandle(handle) {
		let session = new ResizeSession();

		return () => {
			let { pane, label, controls } = handle.props;
			return (
				<div
					role="separator"
					tabIndex={0}
					aria-orientation="vertical"
					aria-label={label}
					aria-controls={controls}
					aria-keyshortcuts="ArrowLeft ArrowRight Enter"
					data-resizable-handle
					data-pane={pane}
					mix={[
						splitViewHandle(pane),
						resizeHandle("horizontal", session),
						relative(),
						flex(),
						shrink(0),
						items("center"),
						justify("center"),
						userSelect(),
						touchAction(),
						cursor("col-resize"),
						before(pseudoContent('""')),
						before([bs("full"), is("1px")]),
						when("&::before", bg("neutral.border")),
						hover(when("&::before", bg("neutral.strong"))),
						when("&[data-resizing]::before", bg("brand.solid")),
						focusVisible(when("&::before", [bg("brand.solid"), raw({ inlineSize: "2px" })])),
						outline("none"),
						hitArea(),
						raw(
							pane === "sidebar"
								? {
										flex: "0 0 1px",
										zIndex: 1,
										[whileRoot('[data-collapsed~="sidebar"]')]: { display: "none" },
										[SHEET_QUERY]: { display: "none" },
									}
								: {
										flex: "0 0 1px",
										zIndex: 1,
										[whileRoot('[data-collapsed~="list"]')]: { display: "none" },
										[whileRoot('[data-collapsed~="detail"]')]: { display: "none" },
										[SINGLE_QUERY]: { display: "none" },
									},
						),
					]}
				/>
			);
		};
	},
);

/**
 * Props {@link SplitViewToggle} serializes into the page for hydration, which is why they
 * are a `type`: `SerializableProps` rejects an interface.
 */
export type SplitViewToggleProps = {
	/** The split view's id. */
	viewId: string;
	/** The pane the button collapses and restores. */
	pane: SplitViewPane;
	/** The button's accessible name, such as "Toggle folders". */
	label: string;
	/** Whether the pane renders collapsed, from the remembered layout. */
	collapsed?: boolean;
};

/**
 * A button collapsing or restoring one pane, placed anywhere in the app's own headers.
 * For the sidebar below 64rem it opens the sidebar as a sheet instead, through the
 * Popover API, which also works before the island loads from
 * `@sdxc/ui/app/split-view#SplitViewToggle`.
 *
 * @example <SplitViewToggle viewId="inbox" pane="sidebar" label="Toggle folders" />
 */
export const SplitViewToggle: EntryComponent<SplitViewToggleProps> = clientEntry(
	"@sdxc/ui/app/split-view#SplitViewToggle",
	function SplitViewToggle(handle) {
		return () => {
			let { viewId, pane, label, collapsed } = handle.props;
			let Icon = pane === "detail" ? PanelRightIcon : PanelLeftIcon;

			return (
				<button
					type="button"
					aria-label={label}
					title={label}
					aria-expanded={collapsed ? "false" : "true"}
					aria-controls={`${viewId}-${pane}`}
					popovertarget={pane === "sidebar" ? `${viewId}-sidebar` : undefined}
					data-split-view-toggle={viewId}
					data-pane={pane}
					mix={[
						splitViewToggle(viewId, pane),
						inlineFlex(),
						items("center"),
						justify("center"),
						shrink(0),
						is("2rem"),
						bs("2rem"),
						rounded("md"),
						border({ color: "transparent", width: 0 }),
						bg("transparent"),
						fg("neutral.muted"),
						cursor("pointer"),
						transition("color, background-color"),
						hover([fg("neutral.emphasis"), bg("neutral.tint")]),
						focusVisible(outline({ color: "brand.ring", width: 2, offset: -2 })),
					]}
				>
					<Icon size={16} aria-hidden="true" />
				</button>
			);
		};
	},
);

/**
 * Props {@link SplitViewKeys} serializes into the page for hydration, which is why they
 * are a `type`: `SerializableProps` rejects an interface.
 */
export type SplitViewKeysProps = {
	/** The list pane's id. */
	listId: string;
	/** The sidebar pane's id, when the view has one. */
	sidebarId?: string;
	/** Where j/k answer. */
	keys?: SplitViewKeyScope;
};

/**
 * The view's keys as an island with no visible markup: j/k step through the list's
 * `data-split-view-item` links, the list keeps its scroll across loads, and following a
 * link closes the sidebar sheet. Loads from `@sdxc/ui/app/split-view#SplitViewKeys`.
 *
 * @example <SplitViewKeys listId="inbox-list" />
 */
export const SplitViewKeys: EntryComponent<SplitViewKeysProps> = clientEntry(
	"@sdxc/ui/app/split-view#SplitViewKeys",
	function SplitViewKeys(handle) {
		return () => {
			let { listId, sidebarId, keys } = handle.props;
			return <span hidden mix={[splitViewKeys(listId, sidebarId, keys ?? DEFAULT_KEY_SCOPE)]} />;
		};
	},
);

/**
 * Renders the view. From 64rem the panes sit side by side; below it the sidebar is a sheet
 * opened by a {@link SplitViewToggle}; below 48rem only the `active` pane shows, and the
 * detail gains a back link. Each pane scrolls on its own and keeps its id for a frame.
 *
 * @param handle Runtime handle carrying the root `<div>`'s props.
 * @returns The render function producing the view's markup.
 * @example
 * <SplitView
 * 	id="inbox"
 * 	sidebar={<FolderNav />}
 * 	list={<ConversationList />}
 * 	detail={selected ? <Conversation id={selected} /> : null}
 * 	empty={<Empty title="No conversation selected" />}
 * 	backHref="/inbox"
 * 	layout={readSplitViewLayout(request.headers.get("Cookie"))}
 * 	labels={{ resizeSidebar: "Resize folders", resizeList: "Resize conversations", back: "Inbox" }}
 * />
 * @example
 * <SplitView id="customers" list={<CustomerList />} detail={<Customer />} labels={labels} />
 */
export function SplitView(handle: Handle<SplitView.Props>) {
	return () => {
		let {
			id,
			sidebar,
			rail,
			list,
			detail,
			empty,
			active,
			backHref,
			frame,
			layout,
			cookie,
			cookiePath,
			keys,
			labels,
			mix,
			...rest
		} = handle.props;
		let hasDetail = detail !== null && detail !== undefined && detail !== false;
		let ids = { sidebar: `${id}-sidebar`, list: `${id}-list`, detail: `${id}-detail` };

		return (
			<div
				id={id}
				data-split-view
				data-slot="split-view"
				data-cookie={cookie ?? SPLIT_VIEW_COOKIE}
				data-cookie-path={cookiePath}
				data-collapsed={(layout?.collapsed ?? []).join(" ")}
				data-active={active ?? (hasDetail ? "detail" : "list")}
				{...rest}
				mix={mergeMix(
					[container(CONTAINER), is("full"), bs("full"), raw({ minBlockSize: 0 })],
					mix,
				)}
			>
				<Resizable
					data-resizable-group
					mix={[
						bs("full"),
						rounded("none"),
						border({ color: "transparent", width: 0 }),
						bg("transparent"),
					]}
				>
					{sidebar ? (
						<SidebarPane id={ids.sidebar} size={layout?.sidebar} rail={rail}>
							{sidebar}
						</SidebarPane>
					) : null}
					{sidebar ? (
						<SplitViewHandle
							pane="sidebar"
							label={labels.resizeSidebar ?? labels.resizeList}
							controls={`${ids.sidebar} ${ids.list}`}
						/>
					) : null}
					<Resizable.Panel
						id={ids.list}
						data-pane="list"
						data-resizable-panel
						data-resizable-min="15"
						data-resizable-max="60"
						defaultSize={layout?.list}
						mix={[
							raw({
								flex: "0 0 var(--ui-resizable-panel-size, var(--ui-app-list-width, 20rem))",
								minInlineSize: "min(16rem, 40%)",
								maxInlineSize: "none",
								overscrollBehavior: "contain",
								[whileRoot('[data-collapsed~="list"]')]: { display: "none" },
								[whileRoot('[data-collapsed~="detail"]')]: { flex: "1 1 auto" },
								[SINGLE_QUERY]: {
									display: "none",
									flex: "1 1 auto",
									[whileRoot('[data-active="list"]')]: { display: "block" },
								},
							}),
						]}
					>
						{list}
					</Resizable.Panel>
					<SplitViewHandle
						pane="list"
						label={labels.resizeList}
						controls={`${ids.list} ${ids.detail}`}
					/>
					<Resizable.Panel
						id={ids.detail}
						data-pane="detail"
						data-resizable-panel
						mix={[
							raw({
								display: "flex",
								flexDirection: "column",
								flex: "1 1 0",
								minInlineSize: 0,
								maxInlineSize: "none",
								[whileRoot('[data-collapsed~="detail"]')]: { display: "none" },
								[SINGLE_QUERY]: {
									display: "none",
									[whileRoot('[data-active="detail"]')]: { display: "flex" },
								},
							}),
						]}
					>
						{backHref ? (
							<a
								href={backHref}
								data-rmx-target={frame}
								data-slot="split-view-back"
								mix={[
									inlineFlex(),
									items("center"),
									gap(1.5),
									m(2),
									pi(2),
									bs("2rem"),
									raw({ alignSelf: "start" }),
									rounded("md"),
									text("sm"),
									weight("medium"),
									fg("neutral.muted"),
									hover([fg("neutral.emphasis"), bg("neutral.tint")]),
									focusVisible(outline({ color: "brand.ring", width: 2, offset: -2 })),
									raw({ display: "none", [SINGLE_QUERY]: { display: "inline-flex" } }),
								]}
							>
								<ArrowLeftIcon size={16} aria-hidden="true" />
								{labels.back}
							</a>
						) : null}
						{hasDetail ? (
							detail
						) : (
							<div
								data-slot="split-view-empty"
								mix={[
									flex(),
									items("center"),
									justify("center"),
									p(6),
									fg("neutral.muted"),
									text("sm"),
									raw({ flex: "1 1 auto", textAlign: "center" }),
								]}
							>
								{empty}
							</div>
						)}
					</Resizable.Panel>
				</Resizable>
				<SplitViewKeys
					listId={ids.list}
					sidebarId={sidebar ? ids.sidebar : undefined}
					keys={keys}
				/>
			</div>
		);
	};
}

/** Props {@link SidebarPane} reads. */
interface SidebarPaneProps {
	id: string;
	size?: number;
	rail?: RemixNode;
	children: RemixNode;
}

/**
 * The sidebar pane: a column from 64rem that snaps to `--ui-app-rail-width` when collapsed,
 * and a `popover` sheet `--ui-app-sheet-width` wide below it, which a
 * {@link SplitViewToggle} opens and light dismiss closes.
 *
 * @param handle Runtime handle carrying the pane's id, remembered size, rail and content.
 * @returns The render function producing the pane's markup.
 */
function SidebarPane(handle: Handle<SidebarPaneProps>) {
	return () => {
		let { id, size, rail, children } = handle.props;

		return (
			<Resizable.Panel
				id={id}
				popover="auto"
				data-pane="sidebar"
				data-resizable-panel
				data-resizable-min="10"
				data-resizable-max="35"
				defaultSize={size}
				mix={[
					raw({
						display: "flex",
						flexDirection: "column",
						position: "static",
						inset: "auto",
						margin: 0,
						padding: 0,
						border: 0,
						color: "inherit",
						background: "transparent",
						blockSize: "auto",
						inlineSize: "auto",
						flex: "0 0 var(--ui-resizable-panel-size, var(--ui-app-sidebar-width, 16rem))",
						minInlineSize: "min(12rem, 30%)",
						maxInlineSize: "none",
						maxBlockSize: "none",
						"& > [data-split-rail]": { display: "none" },
						[whileRoot('[data-collapsed~="sidebar"]')]: {
							flexBasis: "var(--ui-app-rail-width, 3.25rem)",
							minInlineSize: 0,
							overflow: "hidden",
						},
						':where([data-split-view][data-collapsed~="sidebar"]) > [data-resizable-group] > & > [data-split-full]':
							rail ? { display: "none" } : {},
						':where([data-split-view][data-collapsed~="sidebar"]) > [data-resizable-group] > & > [data-split-rail]':
							{
								display: "block",
							},
						[SHEET_QUERY]: {
							"&:not(:popover-open)": { display: "none" },
							"&:popover-open": {
								position: "fixed",
								insetBlock: 0,
								insetInlineStart: 0,
								insetInlineEnd: "auto",
								inlineSize: "min(var(--ui-app-sheet-width, 18rem), calc(100vw - 3rem))",
								minInlineSize: 0,
								blockSize: "100dvh",
								overflow: "auto",
								background: "var(--ui-bg, Canvas)",
								borderInlineEnd: "1px solid var(--ui-neutral-border)",
								boxShadow: "var(--ui-shadow-xl, 0 20px 25px -5px rgb(0 0 0 / 0.1))",
							},
							"&::backdrop": { background: "rgb(0 0 0 / 0.3)" },
							"& > [data-split-full]": { display: "block" },
							"& > [data-split-rail]": { display: "none" },
						},
						[SINGLE_QUERY]: {
							':where([data-split-view][data-active="sidebar"]) > [data-resizable-group] > &:not(:popover-open)':
								{
									display: "flex",
									flex: "1 1 auto",
								},
						},
					}),
				]}
			>
				{rail ? (
					<>
						<div data-split-full>{children}</div>
						<div data-split-rail>{rail}</div>
					</>
				) : (
					children
				)}
			</Resizable.Panel>
		);
	};
}
