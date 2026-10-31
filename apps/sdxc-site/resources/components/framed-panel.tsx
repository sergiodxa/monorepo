/**
 * A window for the media side of a landing split that holds data rather than code: a
 * 40px titled header and a body, inside the same thin brand-tinted frame as the home's
 * runtime showcase, so a roster or a chart reads as the same object as a code sample.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { container, hstack, vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { font, text, weight } from "@sdxc/u/typography";
import { marketingSurface } from "@sdxc/ui/styles";

/** The ruling between the header, body and footer, the hairline every marketing surface uses. */
const HAIRLINE = "var(--ui-marketing-hairline, color-mix(in oklch, CanvasText 8%, transparent))";

/** The size container a panel's body queries, so its layout follows the window rather than the page. */
export const FRAMED_PANEL_CONTAINER = "framed-panel";

/** The inline padding the header, body and footer share, so their text starts on one edge. */
const INSET = "1rem";

namespace FramedPanel {
	export interface Props {
		/** The header's label, set like a code window's file name; the window's `h2` in the page outline. */
		title: RemixNode;
		/** A short value on the header's far end, such as a count. */
		meta?: RemixNode;
		/** A ruled line under the body, for where the data comes from or what follows it. */
		footer?: RemixNode;
		/** Accessible name for the whole window, when the title alone does not say it. */
		label?: string;
		children: RemixNode;
	}
}

/** Renders the framed window; the body brings its own padding so a ruled list can run edge to edge. */
export default function FramedPanel(handle: Handle<FramedPanel.Props>) {
	return () => {
		let { children, footer, label, meta, title } = handle.props;

		return (
			<section
				aria-label={label}
				mix={[
					raw({
						padding: "0.25rem",
						borderRadius: "calc(var(--ui-marketing-radius-frame, 0.75rem) + 0.25rem)",
						backgroundColor: "color-mix(in oklch, var(--ui-brand-bg-solid) 7%, transparent)",
						boxShadow:
							"inset 0 0 0 1px color-mix(in oklch, var(--ui-brand-bg-solid) 12%, transparent)",
						minInlineSize: 0,
					}),
				]}
			>
				<div
					mix={[
						marketingSurface(),
						container(FRAMED_PANEL_CONTAINER),
						vstack({ align: "stretch" }),
						raw({ borderRadius: "var(--ui-marketing-radius-frame, 0.75rem)", overflow: "hidden" }),
					]}
				>
					<div
						mix={[
							hstack({ gap: 2, align: "center", justify: "between" }),
							raw({
								boxSizing: "border-box",
								blockSize: "2.5rem",
								paddingInline: INSET,
								borderBlockEnd: `1px solid ${HAIRLINE}`,
								backgroundColor: "color-mix(in oklch, CanvasText 3%, transparent)",
							}),
						]}
					>
						<h2
							mix={[
								m(0),
								font("mono"),
								text("xs"),
								weight("medium"),
								fg("neutral"),
								raw({ minInlineSize: 0, overflow: "hidden", textOverflow: "ellipsis" }),
								raw({ whiteSpace: "nowrap" }),
							]}
						>
							{title}
						</h2>
						{meta ? (
							<span
								mix={[
									font("mono"),
									text("xs"),
									fg("neutral"),
									raw({ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }),
								]}
							>
								{meta}
							</span>
						) : null}
					</div>

					{children}

					{footer ? (
						<div
							mix={[
								text("xs"),
								fg("neutral"),
								raw({
									paddingBlock: "0.75rem",
									paddingInline: INSET,
									borderBlockStart: `1px solid ${HAIRLINE}`,
								}),
							]}
						>
							{footer}
						</div>
					) : null}
				</div>
			</section>
		);
	};
}
