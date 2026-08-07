/**
 * Email-safe uptime bar: a caption naming the range, one row of equal-width table
 * cells filled with the colour of each period's status, and a legend naming the
 * colours. Everything it renders is a table with inline styles, which is the only
 * layout every mail client agrees on.
 *
 * This is a second implementation of the bar rather than a reuse of the one the web
 * pages render, and deliberately so. That component is built on the app's CSS mixin
 * system: `mix={[...]}` compiles to class names in a stylesheet mail clients strip,
 * its row is a flex container Gmail drops, and every colour is a `--ui-*` custom
 * property Gmail also drops. All three fail at once and none of them degrades into
 * anything readable — the row would collapse and the bars would have no fill. The
 * construction that survives is different enough that parameterising the web
 * component would put two unrelated code paths in one file, so the duplication is
 * the cheaper of the two. The colours come from `shared/palette`, which holds the
 * same tokens the web component asks for, so the two agree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import {
	DEGRADED_COLOR,
	DOWN_COLOR,
	MUTED_COLOR,
	NO_DATA_COLOR,
	UP_COLOR,
} from "~/app/emails/shared/palette";

/** Height of the bar row in pixels, matching the web bar so the two read the same. */
const BAR_HEIGHT = "32";

/** Side of a legend swatch in pixels. */
const SWATCH_SIZE = "10";

/** Gutter between two segments, set as `cellspacing` because it is the gap Outlook honours. */
const SEGMENT_GAP = "2";

/**
 * Cell filler for the coloured boxes. A cell whose content is genuinely empty
 * collapses to nothing in Outlook and takes its background with it, so every box
 * carries a no-break space rendered at zero size.
 */
const FILLER = " ";

/** Shared style of every caption and legend label. */
const LABEL_STYLE = `font-family:inherit;font-size:12px;line-height:1.5;color:${MUTED_COLOR};white-space:nowrap;`;

/** Everything a legend swatch needs except its fill, which the entry supplies. */
const SWATCH_STYLE = `width:${SWATCH_SIZE}px;height:${SWATCH_SIZE}px;border-radius:2px;font-size:0;line-height:0;`;

export namespace UptimeBar {
	/** Status one segment reports; `null` is a period no check covers. */
	export type Status = "up" | "degraded" | "down" | null;

	/** Pre-translated copy the bar shows, built by the email that renders it. */
	export interface Labels {
		/** Caption at the oldest end of the range, e.g. "24 hours ago". */
		start: string;
		/** Caption at the newest end of it, e.g. "Now". */
		end: string;
		/** Formatted uptime caption between the two, or `null` when nothing was measured. */
		uptime: string | null;
		/** Names of the four fills, in the order the legend shows them. */
		legend: { up: string; degraded: string; down: string; noData: string };
	}

	/** Props accepted by {@link UptimeBar}. */
	export interface Props {
		/** One entry per reporting period, oldest first; the caller picks the granularity. */
		segments: Status[];
		/** Copy for the caption and the legend, already in the reader's language. */
		labels: Labels;
	}
}

/**
 * Fill for a status, total over the union so an unfilled state is impossible.
 *
 * Exported because a bar is not the only place a status is coloured — a digest that lists a
 * team's monitors as rows paints the same four states — and two mappings of the same four
 * words would eventually disagree about which green.
 *
 * @param status - Status to paint.
 * @returns The colour, as a literal every mail client keeps.
 */
export function statusFill(status: UptimeBar.Status): string {
	if (status === "up") return UP_COLOR;
	if (status === "degraded") return DEGRADED_COLOR;
	if (status === "down") return DOWN_COLOR;
	return NO_DATA_COLOR;
}

/**
 * The name a status answers `palette`'s dark rules by, in the two properties a status is
 * ever painted in: `fill` for a box behind it, `ink` for the word itself.
 *
 * The inline colour stays whatever {@link statusFill} returned, so a client that strips
 * the stylesheet still shows the light bar it always did; the class is only what the
 * dark block has to aim at.
 *
 * @param status - Status being painted.
 * @param property - Whether it is being painted as a fill or as copy.
 * @returns The class name, or none for a state that has no dark counterpart.
 * @example <td class={statusClass(status, "fill")} style={`background-color:${statusFill(status)};`} />
 */
export function statusClass(status: UptimeBar.Status, property: "fill" | "ink"): string {
	// An unchecked period is a fill and never a word: the digest prints those rows in the
	// muted copy colour, which the kit already flips.
	if (status === null) return property === "fill" ? "uptime-fill-none" : "";
	return `uptime-${property}-${status}`;
}

/**
 * The four legend entries, each paired with the fill it names. The caller renders them
 * as sibling cells rather than as a nested table per entry — one table level fewer is
 * one less thing for Outlook's renderer to get wrong, and flattening them keeps every
 * cell individually keyed without needing a fragment inside the row.
 */
function legendEntries(labels: UptimeBar.Labels): { status: UptimeBar.Status; label: string }[] {
	return [
		{ status: "up", label: labels.legend.up },
		{ status: "degraded", label: labels.legend.degraded },
		{ status: "down", label: labels.legend.down },
		{ status: null, label: labels.legend.noData },
	];
}

/**
 * Renders `segments` as a row of coloured cells between its caption and its legend.
 *
 * The row is `table-layout:fixed` with no per-cell width, so the segments divide the
 * card evenly however many of them there are and the bar never trails off into empty
 * space.
 *
 * @example <UptimeBar segments={hours} labels={labels} />
 */
export function UptimeBar(handle: Handle<UptimeBar.Props>) {
	return () => {
		let { segments, labels } = handle.props;

		return (
			<table
				role="presentation"
				width="100%"
				cellPadding="0"
				cellSpacing="0"
				style="width:100%;margin:0 0 16px;"
			>
				<tbody>
					<tr>
						<td style="padding:0 0 6px;">
							<table
								role="presentation"
								width="100%"
								cellPadding="0"
								cellSpacing="0"
								style="width:100%;"
							>
								<tbody>
									<tr>
										<td align="left" class="mail-muted" style={LABEL_STYLE}>
											{labels.start}
										</td>
										<td align="center" class="mail-muted" style={LABEL_STYLE}>
											{labels.uptime}
										</td>
										<td align="right" class="mail-muted" style={LABEL_STYLE}>
											{labels.end}
										</td>
									</tr>
								</tbody>
							</table>
						</td>
					</tr>

					{/* With no segments the row renders as a hairline rather than as a bar. */}
					{segments.length > 0 ? (
						<tr>
							<td>
								<table
									role="presentation"
									width="100%"
									cellPadding="0"
									cellSpacing={SEGMENT_GAP}
									style="width:100%;table-layout:fixed;border-collapse:separate;"
								>
									<tbody>
										<tr>
											{segments.map((status, index) => (
												<td
													key={index}
													height={BAR_HEIGHT}
													class={statusClass(status, "fill")}
													style={`height:${BAR_HEIGHT}px;background-color:${statusFill(status)};border-radius:1px;font-size:0;line-height:0;`}
												>
													{FILLER}
												</td>
											))}
										</tr>
									</tbody>
								</table>
							</td>
						</tr>
					) : null}

					<tr>
						<td align="right" style="padding:6px 0 0;">
							<table role="presentation" cellPadding="0" cellSpacing="0" style="margin:0 0 0 auto;">
								<tbody>
									<tr>
										{legendEntries(labels).flatMap((entry) => [
											<td
												key={`${entry.label}-swatch`}
												width={SWATCH_SIZE}
												height={SWATCH_SIZE}
												class={statusClass(entry.status, "fill")}
												style={`${SWATCH_STYLE}background-color:${statusFill(entry.status)};`}
											>
												{FILLER}
											</td>,
											<td
												key={entry.label}
												class="mail-muted"
												style={`padding:0 12px 0 4px;${LABEL_STYLE}`}
											>
												{entry.label}
											</td>,
										])}
									</tr>
								</tbody>
							</table>
						</td>
					</tr>
				</tbody>
			</table>
		);
	};
}
