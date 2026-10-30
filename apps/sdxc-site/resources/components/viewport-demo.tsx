/**
 * A stage that shows a page-wide demo at a desktop or a phone width, picked with two radios
 * and no script. Landing bands lay out by their own width, so the desktop view renders them
 * at 1200px and zooms the result down to the stage, keeping the layout a visitor's screen gets.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, borderEdge, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { container, hstack, justify, vstack } from "@sdxc/u/layout";
import { clip } from "@sdxc/u/overflow";
import { at } from "@sdxc/u/responsive";
import { is, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";

/** The width the desktop view lays a demo out at before zooming it to fit the stage. */
const DESKTOP_WIDTH = 1200;

/** The width the phone view lays a demo out at, a common phone's CSS width. */
const PHONE_WIDTH = 390;

/**
 * The tallest the phone view grows, a common phone's CSS height. A longer demo scrolls inside
 * it the way a page scrolls on the device, rather than stretching the guide around it.
 */
const PHONE_HEIGHT = 760;

/**
 * The stage widths the desktop view steps its zoom at, each paired with the zoom that fits
 * {@link DESKTOP_WIDTH} inside it, so the zoomed demo never overflows the stage. They run
 * narrowest first, so the widest step a stage reaches is the one that applies.
 */
const ZOOM_STEPS = Array.from({ length: 26 }, (_, index) => 160 + index * 40).map(
	(width) => [width, Math.floor((width / DESKTOP_WIDTH) * 1000) / 1000] as const,
);

/** The container name the zoom steps query, set on the stage the demo sits in. */
const STAGE = "viewport-stage";

/** The two views, in the order their radios read. */
const VIEWPORTS = [
	["desktop", "Desktop"],
	["phone", "Phone"],
] as const;

namespace ViewportDemo {
	export interface Props {
		/** The radio group's name, unique on the page so two stages switch independently. */
		name: string;
		/** The demo, drawn once and laid out at whichever width is picked. */
		children: RemixNode;
	}
}

/** Renders the view switch above a stage holding the demo at the picked width. */
export default function ViewportDemo(handle: Handle<ViewportDemo.Props>) {
	return () => {
		let { name, children } = handle.props;
		let checked = (value: string) =>
			`[data-slot="viewport-demo"]:has(input[value="${value}"]:checked) &`;

		return (
			<div data-slot="viewport-demo" mix={[vstack({ gap: 0, align: "stretch" }), is("100%")]}>
				<div
					role="radiogroup"
					aria-label="Viewport"
					mix={[
						hstack({ gap: 0, align: "center" }),
						justify("end"),
						p(0, 2),
						borderEdge("block-end", { color: "neutral", width: 1, style: "solid" }),
					]}
				>
					{VIEWPORTS.map(([value, label]) => (
						<label
							key={value}
							mix={[
								p(2, 3),
								text("xs"),
								weight("medium"),
								fg("neutral"),
								raw({ cursor: "pointer" }),
								borderEdge("block-end", { color: "transparent", width: 2, style: "solid" }),
								when("&:has(input:checked)", [
									fg("brand"),
									borderEdge("block-end", { color: "brand", width: 2, style: "solid" }),
								]),
								when(
									"&:has(input:focus-visible)",
									raw({ outline: "2px solid var(--ui-brand-ring)" }),
								),
							]}
						>
							<input
								type="radio"
								name={name}
								value={value}
								defaultChecked={value === "desktop"}
								mix={[visuallyHidden()]}
							/>
							{label}
						</label>
					))}
				</div>

				<div
					mix={[
						container(STAGE),
						hstack({ gap: 0, align: "start" }),
						justify("center"),
						clip(),
						bg("neutral.tint"),
						when(checked("desktop"), p(3)),
						when(checked("phone"), p(3)),
					]}
				>
					<div
						data-slot="viewport-screen"
						mix={[
							raw({ flex: "none" }),
							bg(),
							border({ color: "neutral", width: 1, style: "solid" }),
							rounded("lg"),
							when(checked("desktop"), [
								clip(),
								raw({ width: `${DESKTOP_WIDTH}px`, zoom: String(ZOOM_STEPS[0]?.[1] ?? 0.3) }),
								...ZOOM_STEPS.map(([width, zoom]) =>
									at(`${width}px`, STAGE, raw({ zoom: String(zoom) })),
								),
								at(`${DESKTOP_WIDTH}px`, STAGE, raw({ zoom: "1" })),
							]),
							when(
								checked("phone"),
								raw({
									width: `min(${PHONE_WIDTH}px, 100%)`,
									maxBlockSize: `${PHONE_HEIGHT}px`,
									overflowX: "clip",
									overflowY: "auto",
									overscrollBehavior: "contain",
								}),
							),
						]}
					>
						{children}
					</div>
				</div>
			</div>
		);
	};
}
