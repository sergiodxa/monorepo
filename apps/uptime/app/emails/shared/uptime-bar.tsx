/**
 * Email-safe uptime bar: a caption naming the range, one row of equal-width
 * table cells filled with each period's status colour, and a legend naming the
 * colours. Every part of it is a table with inline styles from `shared/palette`,
 * the one construction every mail client agrees on.
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

/** Height of the bar row in pixels. */
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

const LABEL_STYLE = `font-family:inherit;font-size:12px;line-height:1.5;color:${MUTED_COLOR};white-space:nowrap;`;

/** Legend swatch style; the entry appends the fill it names. */
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
 * Fill for a status, total over the union so every state has a colour. Exported
 * so a digest painting the same four states shares this one mapping, which keeps
 * both of them on the same green.
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
 * The class `palette`'s dark rules aim at, for the two properties a status is
 * painted in: `fill` for a box, `ink` for the word. The inline colour stays as
 * {@link statusFill} returned it, so a stripped stylesheet keeps the light bar.
 *
 * @param status - Status being painted.
 * @param property - Whether it is being painted as a fill or as copy.
 * @returns The class name; an unchecked period names a fill only, since the
 * muted copy colour the kit already flips covers it as a word.
 * @example <td class={statusClass(status, "fill")} style={`background-color:${statusFill(status)};`} />
 */
export function statusClass(status: UptimeBar.Status, property: "fill" | "ink"): string {
	if (status === null) return property === "fill" ? "uptime-fill-none" : "";
	return `uptime-${property}-${status}`;
}

/**
 * The four legend entries, each paired with the fill it names. The caller
 * renders them as sibling cells, which keeps Outlook to a single table level and
 * leaves every cell individually keyed.
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
 * Renders `segments` as a row of coloured cells between its caption and its
 * legend; an empty range renders caption and legend alone. `table-layout:fixed`
 * with no per-cell width divides the card evenly however many segments there are.
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
