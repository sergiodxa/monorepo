/**
 * The pieces every product mockup is drawn from: the app window with its icon rail, the
 * page title row and the raised panels the app groups content in. Each mockup composes
 * them with the app's own cards, badges and tables, so it reads as the product.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	ActivityIcon,
	BellIcon,
	ClockIcon,
	FileSpreadsheetIcon,
	FileTextIcon,
	GlobeIcon,
	KeyIcon,
	MonitorCogIcon,
	NetworkIcon,
	SettingsIcon,
	WorkflowIcon,
	WrenchIcon,
} from "@sdxc/icons";
import { iife } from "@sdxc/iife";
import { bg, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { bs, is, p } from "@sdxc/u/size";
import { text, truncate, weight } from "@sdxc/u/typography";
import { ProductFrame } from "@sdxc/ui/patterns";

/**
 * The narrowest width a mockup lays out at. A media slot narrower than this, a phone's,
 * scales the whole composition down rather than reflowing it.
 */
const DESIGN_WIDTH = "32rem";

/** The app's sidebar destinations in their sidebar order, drawn as the rail's icons. */
const RAIL = {
	dashboard: ActivityIcon,
	http: MonitorCogIcon,
	dns: GlobeIcon,
	tcp: NetworkIcon,
	flows: WorkflowIcon,
	cron: ClockIcon,
	alerts: BellIcon,
	maintenance: WrenchIcon,
	statusPages: FileTextIcon,
	reports: FileSpreadsheetIcon,
	apiKeys: KeyIcon,
	settings: SettingsIcon,
} as const;

/** The rail destination a mockup marks as the page on screen. */
export type RailItem = keyof typeof RAIL;

/** A hairline in the marketing palette, the same line the frame's chrome draws. */
export const HAIRLINE = "1px solid var(--ui-marketing-hairline, var(--ui-neutral-border))";

namespace MockupWindow {
	export interface Props {
		/** Describes what the mockup shows, for the frame's text alternative. */
		label: string;
		/** The window title in the frame's chrome. */
		title: string;
		/** The address the chrome shows, for a public page outside the app. */
		url?: string;
		/** The rail item lit as the current page; omit for a page drawn without the app shell. */
		active?: RailItem;
		children: RemixNode;
	}
}

/**
 * The framed app window. The frame is one image to assistive technology, named by
 * `label`, and its drawn UI is hidden from it. The UI holds still, so it needs no
 * reduced-motion variant.
 */
export function MockupWindow(handle: Handle<MockupWindow.Props>) {
	return () => {
		let { active, children, label, title, url } = handle.props;
		return (
			<ProductFrame
				lights
				title={title}
				url={url}
				designWidth={DESIGN_WIDTH}
				fit="scale"
				role="img"
				aria-label={label}
			>
				<div
					aria-hidden="true"
					data-slot="product-mockup"
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: active ? "2.75rem minmax(0, 1fr)" : "minmax(0, 1fr)",
							textAlign: "start",
						}),
						text("sm"),
					]}
				>
					{active ? <Rail active={active} /> : null}
					<div mix={[vstack({ gap: 3, align: "stretch" }), p(4), raw({ minInlineSize: "0" })]}>
						{children}
					</div>
				</div>
			</ProductFrame>
		);
	};
}

/** The sidebar collapsed to its icons, with the current page filled. */
function Rail(handle: Handle<{ active: RailItem }>) {
	return () => (
		<div mix={[vstack({ gap: 1, align: "center" }), p(3, 0), raw({ borderInlineEnd: HAIRLINE })]}>
			{Object.entries(RAIL).map(([item, Icon]) => (
				<span
					key={item}
					mix={[
						hstack({ gap: 0, align: "center", justify: "center" }),
						is("1.75rem"),
						bs("1.75rem"),
						raw({ borderRadius: "0.375rem" }),
						item === handle.props.active ? [bg("brand.bg-tint"), fg("brand")] : fg("neutral.muted"),
					]}
				>
					<Icon size={16} strokeWidth={1.5} />
				</span>
			))}
		</div>
	);
}

namespace PageTitle {
	export interface Props {
		title: string;
		/** A quiet line under the title, such as the monitor's address. */
		detail?: string;
		/** What the title row ends with: a badge or a drawn button. */
		end?: RemixNode;
	}
}

/** The page's title row, the way the app's page header sets it. */
export function PageTitle(handle: Handle<PageTitle.Props>) {
	return () => {
		let { detail, end, title } = handle.props;
		return (
			<div mix={[hstack({ gap: 3, align: "center", justify: "between" })]}>
				<span mix={[vstack({ gap: 0.5, align: "start" }), raw({ minInlineSize: "0" })]}>
					<span mix={[text("lg"), weight("semibold"), fg("neutral.emphasis"), truncate()]}>
						{title}
					</span>
					{detail ? (
						<span mix={[text("xs"), fg("neutral.muted"), truncate(), is("100%")]}>{detail}</span>
					) : null}
				</span>
				{end}
			</div>
		);
	};
}

/** A primary action drawn as the app's brand button, inert because the window is a picture. */
export function DrawnButton(handle: Handle<{ children: string }>) {
	return () => (
		<span
			mix={[
				p(1.5, 3),
				text("xs"),
				weight("medium"),
				raw({
					flexShrink: "0",
					whiteSpace: "nowrap",
					borderRadius: "0.375rem",
					color: "var(--ui-brand-fg-on-solid, white)",
					backgroundColor: "var(--ui-brand-bg-solid)",
				}),
			]}
		>
			{handle.props.children}
		</span>
	);
}

namespace Panel {
	export interface Props {
		/** The panel's caption row. */
		title?: string;
		/** What the caption row ends with, such as a legend or a count. */
		end?: RemixNode;
		/** Drops the inner padding, for a table that runs to the panel's edges. */
		flush?: boolean;
		children: RemixNode;
	}
}

/** A raised panel, the surface the app groups a chart, a list or a table on. */
export function Panel(handle: Handle<Panel.Props>) {
	return () => {
		let { children, end, flush, title } = handle.props;
		return (
			<div
				mix={[
					vstack({ gap: 0, align: "stretch" }),
					raw({
						borderRadius: "0.5rem",
						border: HAIRLINE,
						backgroundColor: "var(--ui-surface-raised, Canvas)",
						overflow: "hidden",
					}),
				]}
			>
				{title ? (
					<span
						mix={[
							hstack({ gap: 3, align: "center", justify: "between" }),
							p(2.5, 3.5),
							flush ? raw({ borderBlockEnd: HAIRLINE }) : [],
						]}
					>
						<span mix={[weight("medium"), fg("neutral.emphasis"), truncate()]}>{title}</span>
						{end}
					</span>
				) : null}
				<div
					mix={[
						iife(() => {
							if (flush) return [];
							return title ? p(0, 3.5, 3.5, 3.5) : p(3.5);
						}),
					]}
				>
					{children}
				</div>
			</div>
		);
	};
}

namespace Rows {
	export interface Props {
		/** The grid's column tracks, shared by every row through a subgrid. */
		columns: string;
		/** The column captions; omit for a list without a header. */
		head?: readonly string[];
		/** Each row's cells, in column order. */
		rows: ReadonlyArray<{ key: string; cells: readonly RemixNode[] }>;
	}
}

/**
 * A compact table drawn as a grid, the app's table at the density a window this size
 * needs. Every row shares one subgrid, so the columns line up down the list.
 */
export function Rows(handle: Handle<Rows.Props>) {
	return () => {
		let { columns, head, rows } = handle.props;
		return (
			<div
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: columns,
						columnGap: "0.75rem",
						alignItems: "center",
					}),
				]}
			>
				{head ? (
					<span mix={[rowGrid(), p(2, 3.5), text("xs"), weight("medium"), fg("neutral.muted")]}>
						{head.map((caption) => (
							<span key={caption} mix={[truncate()]}>
								{caption}
							</span>
						))}
					</span>
				) : null}
				{rows.map((row, index) => (
					<span
						key={row.key}
						mix={[
							rowGrid(),
							p(2.5, 3.5),
							head || index > 0 ? raw({ borderBlockStart: HAIRLINE }) : [],
						]}
					>
						{row.cells.map((cell, cellIndex) => (
							<span
								key={cellIndex}
								mix={[raw({ minInlineSize: "0", display: "flex", alignItems: "center" })]}
							>
								{cell}
							</span>
						))}
					</span>
				))}
			</div>
		);
	};
}

/** One table row spanning every column through a subgrid. */
function rowGrid() {
	return raw({
		display: "grid",
		gridColumn: "1 / -1",
		gridTemplateColumns: "subgrid",
		alignItems: "center",
	});
}

/** A host, a key or a path set in mono and truncated, the way the app lists them. */
export function Mono(handle: Handle<{ children: string; muted?: boolean }>) {
	return () => (
		<span
			mix={[
				raw({ fontFamily: "var(--ui-font-mono)", fontSize: "0.75rem" }),
				fg(handle.props.muted ? "neutral.muted" : "neutral.emphasis"),
				truncate(),
			]}
		>
			{handle.props.children}
		</span>
	);
}

/** A row's lead cell: its name in the emphasis colour, truncated. */
export function Name(handle: Handle<{ children: string }>) {
	return () => (
		<span mix={[weight("medium"), fg("neutral.emphasis"), truncate()]}>
			{handle.props.children}
		</span>
	);
}

/** A quiet figure or time in a row, in tabular digits. */
export function Muted(handle: Handle<{ children: string }>) {
	return () => (
		<span
			mix={[text("xs"), fg("neutral"), truncate(), raw({ fontVariantNumeric: "tabular-nums" })]}
		>
			{handle.props.children}
		</span>
	);
}
