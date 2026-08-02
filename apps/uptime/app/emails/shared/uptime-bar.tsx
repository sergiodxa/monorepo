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
 * the cheaper of the two. The literal colours below are the same tokens the web
 * component asks for, read out of `resources/css/colors.css`, so the two agree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

/** Fill of a period every check passed; `--ui-color-success-600`, the web bar's `success.solid`. */
const UP_COLOR = "#107f04";

/** Fill of a period that answered but not well; `--ui-color-warning-600`. */
const DEGRADED_COLOR = "#925d00";

/** Fill of a period that failed; `--ui-color-danger-600`. */
const DOWN_COLOR = "#ba2b2e";

/** Fill of a period no check covers; `--ui-color-neutral-200`, the web bar's `neutral.border`. */
const NO_DATA_COLOR = "#dde2e6";

/** Caption and legend copy colour; `--ui-color-neutral-600`. */
const LABEL_COLOR = "#636a71";

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
const LABEL_STYLE = `font-family:inherit;font-size:12px;line-height:1.5;color:${LABEL_COLOR};white-space:nowrap;`;

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

/** Fill for a segment, total over the union so an unfilled state is impossible. */
function fillFor(status: UptimeBar.Status): string {
	if (status === "up") return UP_COLOR;
	if (status === "degraded") return DEGRADED_COLOR;
	if (status === "down") return DOWN_COLOR;
	return NO_DATA_COLOR;
}

/**
 * The four legend entries, each paired with the fill it names. The caller renders them
 * as sibling cells rather than as a nested table per entry — one table level fewer is
 * one less thing for Outlook's renderer to get wrong, and flattening them keeps every
 * cell individually keyed without needing a fragment inside the row.
 */
function legendEntries(labels: UptimeBar.Labels): { color: string; label: string }[] {
	return [
		{ color: UP_COLOR, label: labels.legend.up },
		{ color: DEGRADED_COLOR, label: labels.legend.degraded },
		{ color: DOWN_COLOR, label: labels.legend.down },
		{ color: NO_DATA_COLOR, label: labels.legend.noData },
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
										<td align="left" style={LABEL_STYLE}>
											{labels.start}
										</td>
										<td align="center" style={LABEL_STYLE}>
											{labels.uptime}
										</td>
										<td align="right" style={LABEL_STYLE}>
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
													style={`height:${BAR_HEIGHT}px;background-color:${fillFor(status)};border-radius:1px;font-size:0;line-height:0;`}
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
												style={`${SWATCH_STYLE}background-color:${entry.color};`}
											>
												{FILLER}
											</td>,
											<td key={entry.label} style={`padding:0 12px 0 4px;${LABEL_STYLE}`}>
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
