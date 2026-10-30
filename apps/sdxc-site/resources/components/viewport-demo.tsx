/**
 * A stage that shows a page-wide demo on a desktop screen or a phone, picked with two radios
 * and no script. The demo loads once, in an iframe of its standalone URL, so every media query
 * inside it answers to the 1280px or 390px viewport the stage draws rather than to the guide's.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ArrowUpRightIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, borderEdge, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { container, hstack, justify, vstack } from "@sdxc/u/layout";
import { clip } from "@sdxc/u/overflow";
import { is, mis, p } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";

import ViewportFrame, { FRAME_HEIGHT } from "~/resources/components/viewport-frame";

/** One screen the stage can draw: the viewport a demo lays out at, and the chrome around it. */
interface Screen {
	/** The demo's viewport width, which every media query inside it answers to. */
	width: number;
	/** The tallest the viewport grows; a longer demo scrolls inside it as it would there. */
	height: number;
	/** The chrome's inline and block thickness, added once on each side of the viewport. */
	chrome: { inline: number; block: number };
}

/** The desktop window bar, which carries the three window controls. */
const WINDOW_BAR = 28;

/** A laptop screen below its browser bar, framed by a 1px window border and its bar. */
const DESKTOP: Screen = { width: 1280, height: 800, chrome: { inline: 1, block: WINDOW_BAR + 3 } };

/** The phone's side bezel. */
const PHONE_BEZEL_INLINE = 12;

/** The phone's top and bottom bezel, deep enough to hold the speaker clear of the demo. */
const PHONE_BEZEL_BLOCK = 36;

/** A common phone's CSS viewport inside its bezel. */
const PHONE: Screen = {
	width: 390,
	height: 760,
	chrome: { inline: PHONE_BEZEL_INLINE, block: PHONE_BEZEL_BLOCK * 2 },
};

/** The phone's body colour, the same in both schemes as a device's is. */
const DEVICE_COLOR = "oklch(0.2 0.006 275)";

/** The speaker slot in the phone's top bezel. */
const SPEAKER_COLOR = "oklch(0.32 0.006 275)";

/** The container name the fit is measured against, set on the stage the screen sits in. */
const STAGE = "viewport-stage";

/** The two views, in the order their radios read. */
const VIEWPORTS = [
	["desktop", "Desktop"],
	["phone", "Phone"],
] as const;

/** The device's full width, chrome included. */
function outerWidth(screen: Screen): number {
	return screen.width + 2 * screen.chrome.inline;
}

/**
 * The scale that fits a screen into the stage, and never enlarges it. `atan2` of two lengths
 * and its `tan` give their ratio as a plain number, which `scale()` and `calc()` multiply by.
 */
function fit(screen: Screen): string {
	return `min(1, tan(atan2(100cqi, ${outerWidth(screen)}px)))`;
}

/** The viewport's height: the demo's own, as the frame reports it, up to the screen's. */
function viewportHeight(screen: Screen): string {
	return `min(var(${FRAME_HEIGHT}, ${screen.height}px), ${screen.height}px)`;
}

/**
 * The device at its true size, scaled down to the stage. A transform leaves the iframe's
 * layout width exact, so the demo's viewport is the screen's width at every stage width.
 */
function device(screen: Screen) {
	return [
		raw({
			inlineSize: `${outerWidth(screen)}px`,
			scale: fit(screen),
		}),
		when("& iframe", raw({ inlineSize: `${screen.width}px`, blockSize: viewportHeight(screen) })),
	];
}

/** The space the scaled device takes in the stage, which the transform alone would not claim. */
function screen(screen: Screen) {
	return raw({
		inlineSize: `calc(${outerWidth(screen)}px * ${fit(screen)})`,
		blockSize: `calc((${viewportHeight(screen)} + ${screen.chrome.block}px) * ${fit(screen)})`,
	});
}

namespace ViewportDemo {
	export interface Props {
		/** The radio group's name, unique on the page so two stages switch independently. */
		name: string;
		/** The demo's standalone URL, which the stage draws and links to. */
		src: string;
	}
}

/** Renders the view switch above a stage holding the demo on the picked screen. */
export default function ViewportDemo(handle: Handle<ViewportDemo.Props>) {
	return () => {
		let { name, src } = handle.props;
		let checked = (value: string) =>
			`[data-slot="viewport-demo"]:has(input[value="${value}"]:checked) &`;

		return (
			<div data-slot="viewport-demo" mix={[vstack({ gap: 0, align: "stretch" }), is("100%")]}>
				<div
					mix={[
						hstack({ gap: 0, align: "center" }),
						p(0, 2),
						borderEdge("block-end", { color: "neutral", width: 1, style: "solid" }),
					]}
				>
					<a
						href={src}
						target="_blank"
						mix={[
							hstack({ gap: 1, align: "center" }),
							p(2, 3),
							text("xs"),
							weight("medium"),
							fg("neutral"),
							hover(fg("neutral.emphasis")),
						]}
					>
						Open in a new tab
						<ArrowUpRightIcon size={12} aria-hidden="true" />
					</a>

					<div role="radiogroup" aria-label="Viewport" mix={[hstack({ gap: 0 }), mis("auto")]}>
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
				</div>

				<div
					mix={[
						container(STAGE),
						hstack({ gap: 0, align: "start" }),
						justify("center"),
						p(3),
						bg("neutral.tint"),
					]}
				>
					<div
						data-slot="viewport-screen"
						mix={[
							raw({ flex: "none", position: "relative" }),
							when(checked("desktop"), screen(DESKTOP)),
							when(checked("phone"), screen(PHONE)),
						]}
					>
						<div
							data-slot="viewport-device"
							mix={[
								raw({
									position: "absolute",
									insetBlockStart: 0,
									insetInlineStart: 0,
									boxSizing: "border-box",
									transformOrigin: "0 0",
								}),
								when("& iframe", [
									raw({ display: "block", maxInlineSize: "none", border: 0 }),
									bg(),
								]),
								when(checked("desktop"), [
									device(DESKTOP),
									border({ color: "neutral", width: 1, style: "solid" }),
									rounded("lg"),
									clip(),
									bg("neutral.tint"),
									raw({ paddingBlockStart: `${WINDOW_BAR}px` }),
									when("&::before", [
										raw({
											content: '""',
											position: "absolute",
											insetBlockStart: `${WINDOW_BAR / 2 - 4}px`,
											insetInlineStart: "12px",
											inlineSize: "8px",
											blockSize: "8px",
											borderRadius: "50%",
											backgroundColor: "var(--ui-neutral-border)",
											boxShadow:
												"14px 0 0 var(--ui-neutral-border), 28px 0 0 var(--ui-neutral-border)",
										}),
									]),
									when(
										"& iframe",
										borderEdge("block-start", { color: "neutral", width: 1, style: "solid" }),
									),
								]),
								when(checked("phone"), [
									device(PHONE),
									raw({
										borderStyle: "solid",
										borderColor: DEVICE_COLOR,
										borderWidth: `${PHONE_BEZEL_BLOCK}px ${PHONE_BEZEL_INLINE}px`,
										borderRadius: "2.75rem",
										backgroundColor: DEVICE_COLOR,
										boxShadow: "0 0 0 1px var(--ui-neutral-border)",
									}),
									when("&::before", [
										raw({
											content: '""',
											position: "absolute",
											insetBlockStart: `${-PHONE_BEZEL_BLOCK / 2 - 3}px`,
											insetInlineStart: "50%",
											translate: "-50% 0",
											inlineSize: "56px",
											blockSize: "6px",
											borderRadius: "999px",
											backgroundColor: SPEAKER_COLOR,
										}),
									]),
									when("& iframe", raw({ borderRadius: "0.25rem" })),
								]),
							]}
						>
							<ViewportFrame src={src} title="Live demo" />
						</div>
					</div>
				</div>
			</div>
		);
	};
}
