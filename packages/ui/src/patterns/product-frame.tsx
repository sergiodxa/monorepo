/**
 * Window or device chrome around a product screenshot or staged UI, optionally
 * set on a tinted stage. Traffic lights, title, URL bar and footer stay
 * decorative; the page supplies every string and the framed children.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { container, gap, hstack, inlineFlex, items, vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { atMax } from "@sdxc/u/responsive";
import { bs, is, m, p, pi } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font, text, truncate, weight } from "@sdxc/u/typography";

/** Chrome density {@link ProductFrame} applies when `variant` is omitted. */
const DEFAULT_VARIANT: ProductFrame.Variant = "window";

/** Stage {@link ProductFrame} applies when `stage` is omitted. */
const DEFAULT_STAGE: ProductFrame.Stage = "none";

/** Translucent line the frame's ring, chrome edge and footer edge draw with. */
const HAIRLINE = "var(--ui-marketing-hairline, color-mix(in oklch, CanvasText 8%, transparent))";

/** Fill of the frame and its body, one step above the band behind it. */
const SURFACE = "var(--ui-surface-raised, Canvas)";

/** Chrome bar and footer fill: a hair darker than the body in both schemes. */
const CHROME_FILL = `color-mix(in oklch, ${SURFACE} 96%, black)`;

/** Brand 20% the tinted lift casts. */
const TINT = "color-mix(in oklch, var(--ui-brand-bg-solid) 20%, transparent)";

/** Edge each shadow treatment draws; every one carries a ring so the frame reads on any band. */
const SHADOWS: Record<ProductFrame.Shadow | "device", string> = {
	stage: "var(--ui-shadow-stage)",
	tinted: `0 0 0 1px ${HAIRLINE}, 0 20px 25px -5px ${TINT}, 0 8px 10px -6px ${TINT}`,
	device: `0 0 0 1px ${HAIRLINE}, 0 25px 50px -12px rgb(0 0 0 / 0.25)`,
};

/** Fill of a neutral traffic-light dot: ink at 15%, quiet enough to leave the shot the focus. */
const NEUTRAL_LIGHT = "color-mix(in oklch, var(--ui-neutral-fg-emphasis) 15%, transparent)";

/** Container the framed body declares so a design-width canvas can measure its crop. */
const BODY_CONTAINER = "ui-product-frame-body";

/** Width of the fade a cropped canvas draws at its clipped edge. */
const CROP_FADE = "2rem";

/**
 * Container width under which a stage drops to a thin pad and lets the frame take its full
 * width, so a phone spends its few pixels on the product rather than on the panel.
 */
const STAGE_COMPACT_BELOW = "md";

/** Glow a `backdrop` stage paints when the page passes no backdrop of its own. */
const BACKDROP_GLOW =
	"radial-gradient(ellipse 80% 70% at 50% 0%, color-mix(in oklch, var(--ui-brand-bg-solid) 12%, transparent), transparent 70%)";

/**
 * Prop types for {@link ProductFrame} and its compound parts.
 */
export namespace ProductFrame {
	/**
	 * Outer chrome: a desktop window with a title bar, or a phone-proportioned
	 * device rim.
	 */
	export type Variant = "window" | "device";

	/**
	 * What the frame sits on: the band itself, a tinted panel, or a panel with a
	 * backdrop image or brand glow behind the frame.
	 */
	export type Stage = "none" | "panel" | "backdrop";

	/**
	 * Lift under the frame: the neutral stage shadow, or a brand-tinted two-layer
	 * lift that suits brand and inverse bands.
	 */
	export type Shadow = "stage" | "tinted";

	/**
	 * How a body narrower than `designWidth` shows its content: cropped at the end edge
	 * under a fade, or scaled down whole.
	 */
	export type Fit = "crop" | "scale";

	/**
	 * Per-part styling for chrome the frame renders besides its host.
	 */
	export interface PartsProps {
		/** Styling for the frame itself when a stage wraps it. */
		frame?: TagProps<"div">["mix"];
		/** Styling for the title-bar row. */
		chrome?: TagProps<"div">["mix"];
		/** Styling for the framed body that holds children. */
		body?: TagProps<"div">["mix"];
		/** Styling for the footer strip. */
		footer?: TagProps<"div">["mix"];
	}

	/**
	 * Props accepted by {@link ProductFrame}.
	 */
	export interface Props extends Omit<TagProps<"div">, "title"> {
		/** Outer chrome. Defaults to {@link DEFAULT_VARIANT}. */
		variant?: Variant;
		/**
		 * Panel the frame is staged on, centred at 86% of its width, and at full width
		 * under a thin pad below the `md` container. Host props and `mix` land on the stage.
		 * Defaults to {@link DEFAULT_STAGE}.
		 */
		stage?: Stage;
		/**
		 * Image or gradient painted behind the frame on `stage="backdrop"`; a
		 * radial brand glow fills the stage when omitted. Always `aria-hidden`.
		 */
		backdrop?: RemixNode;
		/**
		 * Lift under the frame. Defaults to `"stage"`, and to a deep drop shadow
		 * on the device variant.
		 */
		shadow?: Shadow;
		/**
		 * Draws three decorative `aria-hidden` dots in the title bar: neutral ink
		 * with `true`, the red/amber/green set with `"color"`.
		 */
		lights?: boolean | "color";
		/** Optional window title shown in the chrome bar. */
		title?: RemixNode;
		/** Optional URL or path shown as a quiet mono field in the chrome bar. */
		url?: RemixNode;
		/** Optional caption row under the body, set as a 12px muted strip. */
		footer?: RemixNode;
		/**
		 * Narrowest width the framed UI lays out at, such as `"56rem"`. A narrower body keeps
		 * the desktop composition and shows it through `fit`, so nothing inside reflows or
		 * truncates on a phone.
		 */
		designWidth?: string;
		/** How a body narrower than `designWidth` shows it. Defaults to `"crop"`. */
		fit?: Fit;
		/** Per-part styling for frame, chrome, body and footer. */
		parts?: PartsProps;
		/** Product UI, screenshot, or staged sample inside the frame. */
		children: RemixNode;
	}
}

/**
 * Wraps children in soft window or device chrome so a landing media slot reads
 * as a product surface rather than a bare image; `stage` sets it on a tinted
 * panel with room around it.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the frame's markup.
 * @example
 * <ProductFrame lights title={t("frame.app")} url="app.example.com">
 * 	<img src={shot} alt={t("frame.alt")} />
 * </ProductFrame>
 * @example
 * <ProductFrame stage="panel" shadow="tinted" footer={t("frame.caption")}>{ui}</ProductFrame>
 */
export function ProductFrame(handle: Handle<ProductFrame.Props>) {
	return () => {
		let {
			backdrop,
			children,
			designWidth,
			fit,
			footer,
			lights,
			mix,
			parts,
			shadow,
			stage,
			title,
			url,
			variant,
			...rest
		} = handle.props;
		let resolvedVariant = variant ?? DEFAULT_VARIANT;
		let resolvedStage = stage ?? DEFAULT_STAGE;
		let isStaged = resolvedStage !== "none";
		let isDevice = resolvedVariant === "device";
		let showChrome = Boolean(lights || title || url);
		let edge = SHADOWS[shadow ?? (isDevice ? "device" : "stage")];

		let frame = (
			<div
				{...(isStaged ? {} : rest)}
				data-slot="product-frame"
				data-variant={resolvedVariant}
				data-shadow={shadow}
				mix={[
					vstack({ gap: 0, align: "stretch" }),
					overflow("hidden"),
					raw({
						backgroundColor: SURFACE,
						borderRadius: isDevice ? "16% / 8%" : "0.75rem",
						boxShadow: edge,
					}),
					isStaged
						? [
								raw({
									position: "relative",
									marginInline: "auto",
									maxInlineSize: "86%",
								}),
								atMax(STAGE_COMPACT_BELOW, raw({ maxInlineSize: "100%" })),
								parts?.frame,
							]
						: mix,
				]}
			>
				{showChrome ? (
					<div
						data-slot="product-frame-chrome"
						mix={[
							hstack({ gap: 3, align: "center", justify: "between" }),
							p(2, 3),
							raw({
								backgroundColor: CHROME_FILL,
								borderBlockEnd: `1px solid ${HAIRLINE}`,
							}),
							parts?.chrome,
						]}
					>
						<span
							mix={[
								hstack({ gap: 3, align: "center" }),
								raw({ flex: "1 1 0", minInlineSize: "0" }),
								overflow("hidden"),
							]}
						>
							{lights ? <FrameLights color={lights === "color"} /> : null}

							{title ? (
								<span mix={[text("xs"), weight("medium"), fg("neutral"), truncate(), m(0)]}>
									{title}
								</span>
							) : null}
						</span>

						{url ? (
							<span
								mix={[
									font("mono"),
									text("xs"),
									fg("neutral.muted"),
									truncate(),
									pi(2),
									raw({ flexShrink: "0", maxInlineSize: "50%" }),
								]}
							>
								{url}
							</span>
						) : null}
					</div>
				) : null}

				<div
					data-slot="product-frame-body"
					mix={[
						overflow("hidden"),
						raw({ backgroundColor: SURFACE }),
						when("& > img, & > video", [
							is("100%"),
							bs("auto"),
							raw({ display: "block", verticalAlign: "middle" }),
						]),
						designWidth ? container(BODY_CONTAINER) : [],
						parts?.body,
					]}
				>
					{designWidth ? (
						<DesignCanvas width={designWidth} fit={fit ?? "crop"}>
							{children}
						</DesignCanvas>
					) : (
						children
					)}
				</div>

				{footer ? (
					<div
						data-slot="product-frame-footer"
						mix={[
							p(2, 3),
							text("xs"),
							fg("neutral.muted"),
							raw({
								backgroundColor: CHROME_FILL,
								borderBlockStart: `1px solid ${HAIRLINE}`,
							}),
							parts?.footer,
						]}
					>
						{footer}
					</div>
				) : null}
			</div>
		);

		if (!isStaged) return frame;

		let isBackdrop = resolvedStage === "backdrop";

		return (
			<div
				{...rest}
				data-slot="product-frame-stage"
				data-stage={resolvedStage}
				mix={[
					raw({
						/**
						 * Ink at 4% sits one step off whatever band holds the stage, light or dark,
						 * where the tint token matches a light page exactly.
						 */
						backgroundColor: "color-mix(in oklch, var(--ui-neutral-fg-emphasis) 4%, transparent)",
						boxShadow: "inset 0 0 0 1px var(--ui-marketing-hairline)",
						position: "relative",
						isolation: "isolate",
						overflow: "hidden",
						borderRadius: "var(--ui-marketing-radius-surface, 1rem)",
						paddingInline: "clamp(1rem, 4cqi, 4rem)",
						paddingBlock: "clamp(1rem, 3cqi, 3rem)",
						backgroundImage: isBackdrop && !backdrop ? BACKDROP_GLOW : "none",
					}),
					atMax(STAGE_COMPACT_BELOW, raw({ padding: "0.75rem" })),
					mix,
				]}
			>
				{isBackdrop && backdrop ? (
					<div
						aria-hidden="true"
						data-slot="product-frame-backdrop"
						mix={[
							raw({ position: "absolute", inset: "0", zIndex: "-1" }),
							when("& > img, & > video, & > svg", [
								raw({
									display: "block",
									inlineSize: "100%",
									blockSize: "100%",
									objectFit: "cover",
								}),
							]),
						]}
					>
						{backdrop}
					</div>
				) : null}
				{frame}
			</div>
		);
	};
}

/**
 * Props accepted by {@link DesignCanvas}.
 */
interface DesignCanvasProps {
	/** Narrowest width the children lay out at. */
	width: string;
	/** Crop or scale once the body is narrower than `width`. */
	fit: ProductFrame.Fit;
	/** The framed UI. */
	children: RemixNode;
}

/**
 * Lays the framed UI out at least `width` wide inside the body. A body that narrow or wider
 * shows it at full size; a narrower one crops its end edge under a fade, or with `scale`
 * zooms the whole composition down to the body's width.
 *
 * @param handle Runtime handle carrying the design width and fit.
 * @returns The render function producing the canvas.
 */
function DesignCanvas(handle: Handle<DesignCanvasProps>) {
	return () => {
		let { children, fit, width } = handle.props;
		let narrow =
			fit === "scale"
				? raw({
						inlineSize: width,
						zoom: `tan(atan2(100cqi, ${width}))`,
					})
				: [
						raw({
							maskImage: `linear-gradient(to right, #000 calc(100cqi - ${CROP_FADE}), transparent 100cqi)`,
						}),
						when(
							"&:dir(rtl)",
							raw({
								maskImage: `linear-gradient(to left, #000 calc(100cqi - ${CROP_FADE}), transparent 100cqi)`,
							}),
						),
					];

		return (
			<div
				data-slot="product-frame-canvas"
				data-fit={fit}
				mix={[
					raw({ inlineSize: "100%", minInlineSize: fit === "scale" ? "0" : width }),
					atMax(width, BODY_CONTAINER, narrow),
				]}
			>
				{children}
			</div>
		);
	};
}

/**
 * Props accepted by {@link FrameLights}.
 */
interface FrameLightsProps {
	/** Paints the red/amber/green set instead of neutral ink dots. */
	color: boolean;
}

/**
 * The three decorative title-bar dots. Neutral by default so the chrome never
 * pulls the eye ahead of the product inside the frame.
 *
 * @param handle Runtime handle carrying whether the dots take status colors.
 * @returns The render function producing the dots.
 */
function FrameLights(handle: Handle<FrameLightsProps>) {
	return () => {
		let neutral = raw({ backgroundColor: NEUTRAL_LIGHT });
		let fills = handle.props.color
			? [bg("danger.solid"), bg("warning.solid"), bg("success.solid")]
			: [neutral, neutral, neutral];

		return (
			<span
				aria-hidden="true"
				data-slot="product-frame-lights"
				data-color={handle.props.color ? "true" : undefined}
				mix={[inlineFlex(), items("center"), gap(1.5), raw({ flexShrink: "0" })]}
			>
				{fills.map((fill) => (
					<span mix={[is(2.5), bs(2.5), rounded("full"), fill]} />
				))}
			</span>
		);
	};
}
