/**
 * A non-modal side sheet showing one record whose open state lives in the URL: the server
 * renders it when the page's query names a record, Close is a link back to the list, and
 * the list behind stays interactive. A small island adds Esc, ↑/↓ (k/j) and copy link.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps, RemixNode } from "remix/component";

import { ChevronDownIcon, ChevronUpIcon, LinkIcon, XIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, borderEdge, fg, outline } from "@sdxc/u/color";
import { opacity, rounded, shadow, transition } from "@sdxc/u/effects";
import { cursor, pointerEvents, raw, mergeMix } from "@sdxc/u/general";
import {
	absolute,
	container,
	fixed,
	flex,
	gap,
	hstack,
	inlineFlex,
	items,
	justify,
	shrink,
	vstack,
} from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { bs, is, m, minBs, minIs, p, pb, pi } from "@sdxc/u/size";
import { z } from "@sdxc/u/stacking";
import { focusVisible, hover, when } from "@sdxc/u/state";
import { leading, tabularNums, text, truncate, weight } from "@sdxc/u/typography";
import { clientEntry } from "remix/component";

import type { DetailSheetKeyScope } from "./mixins/detail-sheet-keys.js";

import { copyPermalink } from "./mixins/copy-permalink.js";
import { DETAIL_SHEET_LINK_ATTRIBUTE, detailSheetKeys } from "./mixins/detail-sheet-keys.js";

/** Container the sheet's viewport layer names, so the panel answers the viewport's width. */
const SHEET_CONTAINER = "ui-detail-sheet" as const;

/** Below this width the panel becomes a bottom sheet. */
const NARROW_QUERY = `@container ${SHEET_CONTAINER} (width < 40rem)` as const;

/** Where the sheet's keys answer when `keys` is left unset. */
const DEFAULT_KEY_SCOPE: DetailSheetKeyScope = "page";

/**
 * Prop types for {@link DetailSheet} and {@link DetailSheetControls}.
 */
export namespace DetailSheet {
	/** Every string the sheet shows or announces. */
	export interface Labels {
		/** Close link's name, such as "Close". */
		close: string;
		/** Copy button's name, such as "Copy link". */
		copyLink: string;
		/** Announced once the link is on the clipboard, such as "Link copied". */
		linkCopied: string;
		/** Previous link's name, such as "Previous monitor". */
		previous: string;
		/** Next link's name, such as "Next monitor". */
		next: string;
		/** Read before the `n / N` counter, such as "Monitor". */
		position: string;
	}

	/** Where the open record sits in the list behind, and the links to its neighbours. */
	export interface Position {
		/** The open record's 1-based place in the list. */
		index: number;
		total: number;
		/** The list URL with the previous record open; `null` at the first. */
		previousHref?: string | null;
		/** The list URL with the next record open; `null` at the last. */
		nextHref?: string | null;
	}

	/** Every native `<aside>` attribute, plus the sheet's content and links. */
	export interface Props extends Omit<TagProps<"aside">, "id" | "title"> {
		/** The sheet's id; its heading takes `${id}-title`. */
		id: string;
		/** The record's name, in the sheet's heading. */
		title: RemixNode;
		/** A line under the title: an id, a status, a host. */
		description?: RemixNode;
		/** The list URL without the record open. Close and Esc follow it. */
		closeHref: string;
		/** The URL a teammate can open this record at; shows the copy button. */
		permalink?: string;
		/** Shows `n / N` with previous/next links and their keys. */
		position?: Position;
		/** Extra header controls, placed before the navigation. */
		actions?: RemixNode;
		/** Pinned under the body: the record's own actions. */
		footer?: RemixNode;
		/**
		 * Where Esc, k/j and ↑/↓ answer: `"page"` document-wide with focus moved into the
		 * sheet on open, `"sheet"` only while focus is inside it.
		 *
		 * @default "page"
		 */
		keys?: DetailSheetKeyScope;
		/** Floats the sheet off the viewport edges as a rounded card. */
		inset?: boolean;
		labels: Labels;
		/** The record's detail: a `PropertyList`, a `Timeline`, notes. */
		children?: RemixNode;
	}
}

/**
 * Props {@link DetailSheetControls} serializes into the page for hydration, which is why
 * they are a `type`: `SerializableProps` rejects an interface.
 */
export type DetailSheetControlsProps = {
	/** The sheet's id, which names the permalink field. */
	sheetId: string;
	closeHref: string;
	permalink?: string;
	index?: number;
	total?: number;
	previousHref?: string | null;
	nextHref?: string | null;
	labels: DetailSheet.Labels;
	/** Where Esc, k/j and ↑/↓ answer. */
	keys?: DetailSheetKeyScope;
};

/**
 * The square, quiet look every header control shares, links and the copy button alike.
 */
function controlStyle() {
	return [
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
		when('&[aria-disabled="true"]', [opacity(40), pointerEvents("none")]),
	];
}

/**
 * Renders a header navigation link, or an inert placeholder in its place when there is
 * no record that way, so the controls keep their positions at either end of the list.
 */
function NavLink(
	handle: Handle<{
		link: string;
		rel?: string;
		href?: string | null;
		label: string;
		keys: string;
		children: RemixNode;
	}>,
) {
	return () => {
		let { link, rel, href, label, keys, children } = handle.props;

		return (
			<a
				href={href ?? undefined}
				aria-label={label}
				title={label}
				aria-keyshortcuts={keys}
				aria-disabled={href ? undefined : "true"}
				rel={rel}
				{...{ [DETAIL_SHEET_LINK_ATTRIBUTE]: link }}
				mix={controlStyle()}
			>
				{children}
			</a>
		);
	};
}

/**
 * The sheet's header controls as an island: `n / N` with previous/next links, copy link
 * and Close. Server HTML renders every link; once hydrated, Esc, k/j and ↑/↓ follow them
 * and focus moves into the sheet. Loads from `@sdxc/ui/app/detail-sheet#DetailSheetControls`.
 *
 * @example
 * <DetailSheetControls sheetId="monitor" closeHref="/monitors" labels={labels} />
 */
export const DetailSheetControls: EntryComponent<DetailSheetControlsProps> = clientEntry(
	"@sdxc/ui/app/detail-sheet#DetailSheetControls",
	function DetailSheetControls(handle) {
		return () => {
			let { closeHref, permalink, index, total, previousHref, nextHref, labels, keys } =
				handle.props;
			let positioned = index !== undefined && total !== undefined;

			return (
				<div
					data-slot="detail-sheet-controls"
					mix={[
						hstack({ gap: 0.5, align: "center" }),
						shrink(0),
						detailSheetKeys(keys ?? DEFAULT_KEY_SCOPE),
					]}
				>
					{positioned ? (
						<>
							<span
								data-slot="detail-sheet-position"
								mix={[
									pi(1.5),
									text("xs"),
									fg("neutral.muted"),
									tabularNums(),
									raw({ whiteSpace: "nowrap" }),
								]}
							>
								<span mix={[visuallyHidden()]}>{`${labels.position} `}</span>
								{`${index} / ${total}`}
							</span>
							<NavLink
								link="previous"
								rel="prev"
								href={previousHref}
								label={labels.previous}
								keys="k ArrowUp"
							>
								<ChevronUpIcon size={16} aria-hidden="true" />
							</NavLink>
							<NavLink
								link="next"
								rel="next"
								href={nextHref}
								label={labels.next}
								keys="j ArrowDown"
							>
								<ChevronDownIcon size={16} aria-hidden="true" />
							</NavLink>
						</>
					) : null}
					{permalink ? (
						<button
							type="button"
							data-slot="detail-sheet-copy"
							aria-label={labels.copyLink}
							title={labels.copyLink}
							mix={[
								...controlStyle(),
								when("&[data-copied]", fg("success")),
								copyPermalink(permalink, labels.linkCopied),
							]}
						>
							<LinkIcon size={16} aria-hidden="true" />
							<span role="status" mix={[visuallyHidden()]} />
						</button>
					) : null}
					<NavLink link="close" href={closeHref} label={labels.close} keys="Escape">
						<XIcon size={16} aria-hidden="true" />
					</NavLink>
				</div>
			);
		};
	},
);

/**
 * Renders an `<aside>` named by its heading over the viewport, passing the pointer through
 * to the page, with the panel docked to its inline end at `--ui-app-detail-sheet-width`, or
 * a bottom sheet below 40rem. Never a modal; destructive actions confirm in the app's flow.
 *
 * @param handle Runtime handle carrying the `<aside>`'s props.
 * @returns The render function producing the sheet's markup.
 * @example
 * {selected ? (
 * 	<DetailSheet
 * 		id="monitor"
 * 		title={selected.name}
 * 		closeHref="/monitors#monitor-42"
 * 		permalink={`/monitors/${selected.id}`}
 * 		position={{ index: 3, total: 84, previousHref: "/monitors?pane=41", nextHref: "/monitors?pane=43" }}
 * 		labels={labels}
 * 	>
 * 		<PropertyList>…</PropertyList>
 * 	</DetailSheet>
 * ) : null}
 */
export function DetailSheet(handle: Handle<DetailSheet.Props>) {
	return () => {
		let {
			id,
			title,
			description,
			closeHref,
			permalink,
			position,
			actions,
			footer,
			inset,
			keys,
			labels,
			children,
			mix,
			...rest
		} = handle.props;
		let titleId = `${id}-title`;
		let edge = inset ? "var(--ui-app-inset-gap, 0.5rem)" : "0px";

		return (
			<aside
				id={id}
				aria-labelledby={titleId}
				tabIndex={-1}
				data-slot="detail-sheet"
				data-inset={inset ? "" : undefined}
				{...rest}
				mix={mergeMix(
					[
						fixed(),
						z(30),
						raw({
							insetBlockStart: "var(--ui-app-detail-sheet-top, 0px)",
							insetBlockEnd: 0,
							insetInline: 0,
						}),
						container(SHEET_CONTAINER),
						pointerEvents("none"),
						outline("none"),
					],
					mix,
				)}
			>
				<div
					data-slot="detail-sheet-panel"
					mix={[
						absolute(),
						flex(),
						raw({ flexDirection: "column" }),
						pointerEvents("auto"),
						bg(),
						fg(),
						text("sm"),
						shadow("xl"),
						overflow("hidden"),
						/**
						 * Every edge and size lives in one rule with its narrow override, so the bottom
						 * sheet always wins below 40rem whatever order the stylesheet layers land in.
						 */
						raw({
							insetBlockStart: edge,
							insetBlockEnd: edge,
							insetInlineEnd: edge,
							insetInlineStart: "auto",
							inlineSize: `min(var(--ui-app-detail-sheet-width, clamp(28rem, 36cqi, 36rem)), calc(100cqi - 2 * ${edge}))`,
							borderInlineStart: "1px solid var(--ui-neutral-border)",
							borderRadius: inset ? "var(--ui-app-inset-radius, 0.75rem)" : "0",
							[NARROW_QUERY]: {
								insetBlockStart: "auto",
								insetInline: "0",
								insetBlockEnd: "0",
								inlineSize: "100%",
								maxBlockSize: "85%",
								borderInlineStart: "0",
								borderBlockStart: "1px solid var(--ui-neutral-border)",
								borderRadius:
									"var(--ui-app-inset-radius, 0.75rem) var(--ui-app-inset-radius, 0.75rem) 0 0",
							},
						}),
					]}
				>
					<header
						data-slot="detail-sheet-header"
						mix={[
							flex(),
							items("start"),
							justify("between"),
							gap(3),
							pi(4),
							pb(3),
							borderEdge("bottom", { width: 1, color: "neutral" }),
							shrink(0),
						]}
					>
						<div mix={[vstack({ gap: 0.5 }), minIs(0), raw({ paddingBlockStart: "0.25rem" })]}>
							<h2
								id={titleId}
								mix={[m(0), text("base"), weight("semibold"), leading("1.5rem"), truncate()]}
							>
								{title}
							</h2>
							{description ? (
								<p mix={[m(0), text("sm"), fg("neutral.muted")]}>{description}</p>
							) : null}
						</div>
						<div mix={[hstack({ gap: 1, align: "center" }), shrink(0), minBs("2rem")]}>
							{actions}
							<DetailSheetControls
								sheetId={id}
								closeHref={closeHref}
								permalink={permalink}
								index={position?.index}
								total={position?.total}
								previousHref={position?.previousHref ?? null}
								nextHref={position?.nextHref ?? null}
								labels={labels}
								keys={keys}
							/>
						</div>
					</header>
					<div
						data-slot="detail-sheet-body"
						mix={[raw({ flex: "1 1 auto" }), minBs(0), overflow("auto"), p(4), vstack({ gap: 5 })]}
					>
						{children}
					</div>
					{footer ? (
						<footer
							data-slot="detail-sheet-footer"
							mix={[
								flex(),
								items("center"),
								justify("end"),
								gap(2),
								pi(4),
								pb(3),
								shrink(0),
								borderEdge("top", { width: 1, color: "neutral" }),
							]}
						>
							{footer}
						</footer>
					) : null}
				</div>
			</aside>
		);
	};
}
