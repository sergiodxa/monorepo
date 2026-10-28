/**
 * Stylized reading-queue plane for the signed-out landing hero. Mirrors the
 * timeline row chrome (unread mark, title, source, time) as static markup so
 * visitors see the product surface without inventing screenshots or metrics.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { CircleCheckIcon, CircleIcon } from "@sdxc/icons";
import { bg, borderEdge, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { flex, gap, grow, hstack, items, shrink, vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { bs, is, m, maxIs, minIs, p } from "@sdxc/u/size";
import { font, leading, nowrap, text, truncate, weight } from "@sdxc/u/typography";

/** One illustrative row inside the framed queue preview. */
export interface LandingQueuePreviewRow {
	/** Whether the row has already been marked read. */
	read: boolean;
	/** Post title shown as the row's primary words. */
	title: string;
	/** Feed or publisher name in the quiet source column. */
	source: string;
	/** Relative time shown at the row's trailing edge. */
	time: string;
}

namespace LandingQueuePreview {
	export interface Props {
		/** Accessible name for the decorative product plane. */
		label: string;
		/** Quiet chrome label above the rows (the reading surface name). */
		chrome: string;
		/** Rows rendered inside the frame, newest-first like the real queue. */
		rows: LandingQueuePreviewRow[];
	}
}

/**
 * Renders a non-interactive queue mock sized for a {@link ProductFrame} media
 * slot. Decorative only — links and forms stay on the page CTAs.
 */
export default function LandingQueuePreview(handle: Handle<LandingQueuePreview.Props>) {
	return () => {
		let { chrome, label, rows } = handle.props;

		return (
			<div
				role="img"
				aria-label={label}
				mix={[
					vstack({ gap: 0, align: "stretch" }),
					bg(),
					overflow("hidden"),
					raw({ minBlockSize: "18rem" }),
				]}
			>
				<div
					mix={[
						hstack({ gap: 3, align: "center", justify: "between" }),
						p(3, 4),
						borderEdge("block-end", { color: "neutral", width: 1, style: "solid" }),
						bg("neutral.tint"),
					]}
				>
					<span mix={[text("sm"), weight("semibold"), fg("neutral.emphasis"), m(0)]}>{chrome}</span>
					<span
						aria-hidden="true"
						mix={[
							is(2),
							bs(2),
							raw({
								borderRadius: "9999px",
								backgroundColor: "var(--ui-brand-fg)",
							}),
						]}
					/>
				</div>

				<ol
					aria-hidden="true"
					mix={[vstack({ gap: 0, align: "stretch" }), m(0), p(0), raw({ listStyle: "none" })]}
				>
					{rows.map((row) => (
						<li
							key={`${row.source}-${row.title}`}
							mix={[
								flex(),
								items("center"),
								gap(3),
								p(3.5, 4),
								borderEdge("block-end", { color: "neutral", width: 1, style: "solid" }),
							]}
						>
							<span mix={[shrink(0), fg(row.read ? "neutral.muted" : "brand")]}>
								{row.read ? (
									<CircleCheckIcon size={16} strokeWidth={1.5} />
								) : (
									<CircleIcon size={16} strokeWidth={1.5} />
								)}
							</span>

							<div mix={[grow(), minIs(0), vstack({ gap: 1, align: "stretch" })]}>
								<span
									mix={[
										font("reading"),
										text("sm"),
										leading("snug"),
										weight("medium"),
										truncate(),
										fg(row.read ? "neutral" : "brand"),
									]}
								>
									{row.title}
								</span>
								<span
									mix={[hstack({ gap: 2, align: "baseline" }), text("xs"), fg("neutral.muted")]}
								>
									<span mix={[truncate(), maxIs("9rem")]}>{row.source}</span>
									<span aria-hidden="true">·</span>
									<span mix={[nowrap(), shrink(0)]}>{row.time}</span>
								</span>
							</div>
						</li>
					))}
				</ol>
			</div>
		);
	};
}
