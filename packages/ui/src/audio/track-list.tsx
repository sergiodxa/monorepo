/**
 * The track table of an album, a playlist or an artist's top songs: a number that turns into a
 * play button under the pointer, the title with its artists, the album, when it was added and
 * its length. The playing row carries `aria-current="true"` and shows an {@link Equalizer}.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { ClockIcon, PlayIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { mergeMix, raw } from "@sdxc/u/general";

import { Equalizer } from "./equalizer.js";
import { formatTrackTime } from "./utils/track-time.js";

/** The container the table's columns respond to, so it fits a side panel as well as a page. */
const CONTAINER = "ui-track-list";

/** Prop types for {@link TrackList} and its parts. */
export namespace TrackList {
	/** The column headings and the marks' spoken names. */
	export interface Labels {
		/** The number column's heading, such as "#". */
		index: string;
		title: string;
		album: string;
		added: string;
		duration: string;
		/** What a screen reader hears on the playing row's mark, such as "Now playing". */
		playing: string;
	}

	/** Which optional columns the table shows; a playlist shows both, an album neither. */
	export interface Columns {
		album?: boolean;
		added?: boolean;
	}

	/** Every native `<table>` attribute, plus the headings and the rows. */
	export interface Props extends TagProps<"table"> {
		labels: Labels;
		/** @default { album: false, added: false } */
		columns?: Columns;
		/** Shows the heading row from the width where every column fits. @default true */
		header?: boolean;
		/** {@link TrackList.Row} elements in playing order. */
		children: RemixNode;
	}

	/** Every native `<tr>` attribute, plus one track's cells. */
	export interface RowProps extends Omit<TagProps<"tr">, "title"> {
		/** The track's place, shown in the number column. */
		index: number;
		title: string;
		/** The artists, usually links to their pages, joined with commas by the caller. */
		artists?: RemixNode;
		/** A small square cover beside the title, for a list that mixes albums. */
		art?: RemixNode;
		/** The album, usually a link; shown when the table's `columns.album` is on. */
		album?: RemixNode;
		/** When the track was added, such as "3 days ago"; shown when `columns.added` is on. */
		added?: RemixNode;
		/** Length in seconds. */
		duration: number;
		/** Marks the "E" badge before the artists. */
		explicit?: boolean;
		/** The play control: a {@link TrackList.PlayButton}, inside a form when it posts. */
		play: RemixNode;
		/** Whether this row is the one playing, as the server knows it; a player keeps it current after. */
		current?: boolean;
		/** Controls at the row's end, such as a like button or a menu. */
		trailing?: RemixNode;
	}

	/** Every native `<button>` attribute; `aria-label` names the track it plays. */
	export interface PlayButtonProps extends TagProps<"button"> {
		"aria-label": string;
	}
}

/**
 * Renders the table. Its cells drop to number, title and length on a narrow container, and
 * the whole row plays its track when pressed anywhere outside its own links and controls.
 *
 * @example
 * <TrackList labels={labels} columns={{ album: true }}>
 * 	<TrackList.Row index={1} title="Low Tide" duration={187} play={<TrackList.PlayButton aria-label="Play Low Tide" />} />
 * </TrackList>
 */
export function TrackList(handle: Handle<TrackList.Props>) {
	return () => {
		let { children, columns = {}, header = true, labels, mix, ...rest } = handle.props;
		return (
			<div
				data-slot="track-list-frame"
				mix={[raw({ containerType: "inline-size", containerName: CONTAINER, minInlineSize: "0" })]}
			>
				<table
					{...rest}
					data-slot="track-list"
					data-album={columns.album ? "" : undefined}
					data-added={columns.added ? "" : undefined}
					mix={mergeMix([tableStyles()], mix)}
				>
					<colgroup>
						<col data-col="index" />
						<col data-col="title" />
						{columns.album ? <col data-col="album" /> : null}
						{columns.added ? <col data-col="added" /> : null}
						<col data-col="duration" />
						<col data-col="trailing" />
					</colgroup>
					<thead data-header={header ? "" : undefined}>
						<tr>
							<th scope="col" data-cell="index">
								{labels.index}
							</th>
							<th scope="col" data-cell="title">
								{labels.title}
							</th>
							{columns.album ? (
								<th scope="col" data-cell="album">
									{labels.album}
								</th>
							) : null}
							{columns.added ? (
								<th scope="col" data-cell="added">
									{labels.added}
								</th>
							) : null}
							<th scope="col" data-cell="duration">
								<ClockIcon aria-hidden="true" size={16} />
								<span mix={[visuallyHidden()]}>{labels.duration}</span>
							</th>
							<th scope="col" data-cell="trailing">
								<span mix={[visuallyHidden()]}>{labels.title}</span>
							</th>
						</tr>
					</thead>
					<tbody data-playing-label={labels.playing}>{children}</tbody>
				</table>
			</div>
		);
	};
}

/**
 * One track. The album and added cells render only when the caller passes them, so the row
 * matches the table's `columns`.
 */
function TrackListRow(handle: Handle<TrackList.RowProps>) {
	return () => {
		let {
			added,
			album,
			art,
			artists,
			current,
			duration,
			explicit,
			index,
			play,
			title,
			trailing,
			...rest
		} = handle.props;
		return (
			<tr {...rest} data-slot="track-list-row" aria-current={current ? "true" : undefined}>
				<td data-cell="index">
					<span data-slot="track-list-marker">
						<span data-slot="track-list-index">{index}</span>
						<span data-slot="track-list-playing">
							<Equalizer />
						</span>
						{play}
					</span>
				</td>
				<td data-cell="title">
					<span data-slot="track-list-heading">
						{art === undefined ? null : <span data-slot="track-list-art">{art}</span>}
						<span data-slot="track-list-text">
							<span data-slot="track-list-title">{title}</span>
							{artists === undefined && !explicit ? null : (
								<span data-slot="track-list-artists">
									{explicit ? (
										<abbr data-slot="track-list-explicit" title="Explicit">
											E
										</abbr>
									) : null}
									{artists}
								</span>
							)}
						</span>
					</span>
				</td>
				{album === undefined ? null : <td data-cell="album">{album}</td>}
				{added === undefined ? null : <td data-cell="added">{added}</td>}
				<td data-cell="duration">{formatTrackTime(duration)}</td>
				<td data-cell="trailing">{trailing}</td>
			</tr>
		);
	};
}

/**
 * The play control in a row's number cell. It shows under the pointer and on keyboard focus,
 * and its hit area covers the whole row, so a press anywhere on the row plays the track.
 */
function TrackListPlayButton(handle: Handle<TrackList.PlayButtonProps>) {
	return () => {
		let { children, type = "submit", ...rest } = handle.props;
		return (
			<button {...rest} type={type} data-slot="track-list-play">
				{children ?? <PlayIcon aria-hidden="true" size={16} fill="currentColor" />}
			</button>
		);
	};
}

TrackList.Row = TrackListRow;
TrackList.PlayButton = TrackListPlayButton;

/** The table's look: quiet rows, a hover wash, the number cell's three states and the narrow form. */
function tableStyles() {
	return raw({
		inlineSize: "100%",
		tableLayout: "fixed",
		borderCollapse: "separate",
		borderSpacing: "0",
		fontSize: "0.875rem",
		lineHeight: "1.25rem",
		color: "var(--ui-neutral-fg-muted)",
		fontVariantNumeric: "tabular-nums",
		"& col[data-col=index]": { inlineSize: "3rem" },
		"& col[data-col=album]": { inlineSize: "30%" },
		"& col[data-col=added]": { inlineSize: "8.5rem" },
		"& col[data-col=duration]": { inlineSize: "4.5rem" },
		"& col[data-col=trailing]": { inlineSize: "3rem" },
		"& th": {
			paddingBlock: "0.5rem",
			paddingInline: "0.5rem",
			textAlign: "start",
			fontSize: "0.75rem",
			fontWeight: "500",
			letterSpacing: "0.04em",
			textTransform: "uppercase",
			borderBlockEnd: "1px solid var(--ui-neutral-border)",
		},
		"& thead:not([data-header])": { display: "none" },
		"& th[data-cell=index], & td[data-cell=index]": { textAlign: "center" },
		"& th[data-cell=duration], & td[data-cell=duration]": { textAlign: "end" },
		"& th[data-cell=duration] svg": { verticalAlign: "middle" },
		"& tbody::before": { content: "''", display: "block", blockSize: "0.5rem" },
		"& tr[data-slot=track-list-row]": { position: "relative" },
		"& td": {
			paddingInline: "0.5rem",
			blockSize: "3.5rem",
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
		},
		"& td:first-child": {
			borderStartStartRadius: "var(--ui-radius-md, 0.375rem)",
			borderEndStartRadius: "var(--ui-radius-md, 0.375rem)",
		},
		"& td:last-child": {
			borderStartEndRadius: "var(--ui-radius-md, 0.375rem)",
			borderEndEndRadius: "var(--ui-radius-md, 0.375rem)",
		},
		"& tr[data-slot=track-list-row]:hover td, & tr[data-slot=track-list-row]:focus-within td": {
			backgroundColor: "var(--ui-neutral-bg-tint-hover)",
		},
		"& td[data-cell=index]": {
			display: "table-cell",
			overflow: "visible",
			fontSize: "0.9375rem",
		},
		"& [data-slot=track-list-marker]": {
			display: "inline-grid",
			placeItems: "center",
			verticalAlign: "middle",
			inlineSize: "1.75rem",
			blockSize: "1.75rem",
		},
		"& [data-slot=track-list-marker] > *, & [data-slot=track-list-play]": { gridArea: "1 / 1" },
		"& [data-slot=track-list-playing]": {
			display: "none",
			color: "var(--ui-brand-fg)",
			fontSize: "0.875rem",
		},
		"& [data-slot=track-list-play]": {
			display: "inline-grid",
			placeItems: "center",
			inlineSize: "1.75rem",
			blockSize: "1.75rem",
			padding: "0",
			border: "0",
			borderRadius: "999px",
			color: "var(--ui-neutral-fg-emphasis)",
			backgroundColor: "transparent",
			cursor: "pointer",
			opacity: "0",
		},
		"& [data-slot=track-list-play]::after": {
			content: "''",
			position: "absolute",
			inset: "0",
		},
		"& [data-slot=track-list-play]:focus-visible": {
			opacity: "1",
			outline: "2px solid var(--ui-brand-ring)",
			outlineOffset: "1px",
		},
		"& tr:hover [data-slot=track-list-play], & tr:focus-within [data-slot=track-list-play]": {
			opacity: "1",
		},
		"& tr:hover [data-slot=track-list-index], & tr:focus-within [data-slot=track-list-index], & tr:hover [data-slot=track-list-playing], & tr:focus-within [data-slot=track-list-playing]":
			{ visibility: "hidden" },
		"& tr[aria-current=true] [data-slot=track-list-index]": { display: "none" },
		"& tr[aria-current=true] [data-slot=track-list-playing]": { display: "inline-flex" },
		"& [data-slot=track-list-playing] > *": { fontSize: "0.875rem" },
		"& tr[aria-current=true] [data-slot=track-list-title]": { color: "var(--ui-brand-fg)" },
		"& [data-slot=track-list-heading]": {
			display: "flex",
			alignItems: "center",
			gap: "0.75rem",
			minInlineSize: "0",
		},
		"& [data-slot=track-list-art]": {
			flex: "none",
			display: "block",
			inlineSize: "2.5rem",
			blockSize: "2.5rem",
			overflow: "clip",
			borderRadius: "var(--ui-radius-sm, 0.25rem)",
			backgroundColor: "var(--ui-neutral-bg-tint)",
		},
		"& [data-slot=track-list-art] > *": {
			display: "block",
			inlineSize: "100%",
			blockSize: "100%",
			objectFit: "cover",
		},
		"& [data-slot=track-list-text]": { display: "grid", minInlineSize: "0" },
		"& [data-slot=track-list-title]": {
			overflow: "hidden",
			textOverflow: "ellipsis",
			fontSize: "0.9375rem",
			lineHeight: "1.375rem",
			fontWeight: "500",
			color: "var(--ui-neutral-fg-emphasis)",
		},
		"& [data-slot=track-list-artists]": {
			overflow: "hidden",
			textOverflow: "ellipsis",
			fontSize: "0.8125rem",
		},
		"& [data-slot=track-list-explicit]": {
			display: "inline-grid",
			placeItems: "center",
			marginInlineEnd: "0.375rem",
			inlineSize: "1rem",
			blockSize: "1rem",
			borderRadius: "0.1875rem",
			fontSize: "0.625rem",
			fontWeight: "700",
			lineHeight: "1",
			textDecoration: "none",
			verticalAlign: "0.0625rem",
			color: "var(--ui-neutral-bg-solid, Canvas)",
			backgroundColor: "var(--ui-neutral-fg-muted)",
		},
		"& td a": {
			position: "relative",
			zIndex: "1",
			color: "inherit",
			textDecoration: "none",
		},
		"& td a:hover": { color: "var(--ui-neutral-fg-emphasis)", textDecoration: "underline" },
		"& td a:focus-visible": {
			outline: "2px solid var(--ui-brand-ring)",
			outlineOffset: "2px",
			borderRadius: "2px",
		},
		"& td[data-cell=trailing]": { textAlign: "end" },
		"& td[data-cell=trailing] :is(a, button, input, select)": { position: "relative", zIndex: "1" },
		[`@container ${CONTAINER} (max-width: 52rem)`]: {
			"& col[data-col=added], & [data-cell=added]": { display: "none" },
		},
		[`@container ${CONTAINER} (max-width: 36rem)`]: {
			"& thead": { display: "none" },
			"& col[data-col=album], & [data-cell=album]": { display: "none" },
			"& col[data-col=index]": { inlineSize: "2.25rem" },
			"& col[data-col=duration]": { inlineSize: "3.25rem" },
			"& col[data-col=trailing]": { inlineSize: "2.75rem" },
			"& td": { paddingInline: "0.25rem" },
			"& tr:hover [data-slot=track-list-index], & tr:focus-within [data-slot=track-list-index]": {
				visibility: "visible",
			},
			"& tr:hover [data-slot=track-list-playing], & tr:focus-within [data-slot=track-list-playing]":
				{ visibility: "visible" },
			"& tr [data-slot=track-list-play]:not(:focus-visible)": { opacity: "0" },
		},
	});
}
