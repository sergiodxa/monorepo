/**
 * A horizontally scrolling collection of slides riding native CSS scroll snap,
 * so swiping or scrolling advances between slides with no script in the
 * baseline. {@link Carousel.Viewport} is the scrolling surface,
 * {@link Carousel.Track} rows up its {@link Carousel.Slide} children, and
 * {@link Carousel.Previous}/{@link Carousel.Next} are invoker buttons a paired
 * mixin wires into working controls.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps } from "remix/component";

import { ChevronLeftIcon, ChevronRightIcon } from "@sdxc/icons";
import { outline } from "@sdxc/u/color";
import { raw, vars, mergeMix } from "@sdxc/u/general";
import { flex, flexCol, gap, grow, items, justify, shrink } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { bs, is, minIs, pi } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { attrs, clientEntry } from "remix/component";

import { carouselSync } from "../mixins/carousel-controls.js";

import { Button } from "./button.js";

/** Native ARIA role applied to {@link Carousel.Viewport} unless a consumer overrides it. */
const DEFAULT_VIEWPORT_ROLE = "group";

/**
 * Native tab-stop index applied to {@link Carousel.Viewport} unless a consumer
 * overrides it, so the scrollable region is reachable by keyboard even before
 * any control is wired up.
 */
const DEFAULT_VIEWPORT_TAB_INDEX = 0;

/** Native ARIA role applied to {@link Carousel.Slide} unless a consumer overrides it. */
const DEFAULT_SLIDE_ROLE = "group";

/**
 * Visual weight {@link Carousel.Previous} and {@link Carousel.Next} fall back
 * to when `variant` is omitted.
 */
const DEFAULT_CONTROL_VARIANT: Button.Variant = "ghost";

/**
 * Semantic color role {@link Carousel.Previous} and {@link Carousel.Next} fall
 * back to when `color` is omitted.
 */
const DEFAULT_CONTROL_COLOR: Button.Color = "neutral";

/**
 * Size variant {@link Carousel.Previous} and {@link Carousel.Next} fall back to
 * when `size` is omitted.
 */
const DEFAULT_CONTROL_SIZE: Button.Size = "sm";

/** Invoker Commands verb {@link Carousel.Previous} falls back to when `command` is omitted. */
const DEFAULT_PREVIOUS_COMMAND = "--ui-prev";

/** Invoker Commands verb {@link Carousel.Next} falls back to when `command` is omitted. */
const DEFAULT_NEXT_COMMAND = "--ui-next";

/**
 * Prop types for {@link Carousel} and its compound parts.
 */
export namespace Carousel {
	/**
	 * Every native `<section>` attribute, unchanged, plus the `mix`
	 * passthrough. Override `--ui-carousel-gap`, `--ui-carousel-slide-size`, or
	 * `--ui-carousel-padding` per instance through the inherited `style` prop.
	 */
	export interface Props extends TagProps<"section"> {}

	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 * Give it an `id` for the controls' `commandfor` prop to target, and pair a
	 * `carouselControls()` mixin on it to make those controls scroll it.
	 */
	export interface ViewportProps extends TagProps<"div"> {}

	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 */
	export interface TrackProps extends TagProps<"div"> {}

	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 */
	export interface SlideProps extends TagProps<"div"> {}

	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 */
	export interface ControlsProps extends TagProps<"div"> {}

	/**
	 * Every {@link Button.Props} field, with `commandfor` required and `command`
	 * narrowed to the verb the paired mixin listens for.
	 */
	export interface PreviousProps extends Omit<Button.Props, "commandfor" | "command"> {
		/** `id` of the {@link Carousel.Viewport} this control scrolls back through. */
		commandfor: string;
		/** Invoker Commands verb a `carouselControls()` mixin listens for. Defaults to `"--ui-prev"`. */
		command?: "--ui-prev";
	}

	/**
	 * Every {@link Button.Props} field, with `commandfor` required and `command`
	 * narrowed to the verb the paired mixin listens for.
	 */
	/** Every native `<div>` attribute, plus the dots' viewport, count and names. */
	export interface DotsProps extends Omit<TagProps<"div">, "children"> {
		/** `id` of the {@link Carousel.Viewport} the dots move. */
		commandfor: string;
		/** How many slides the viewport holds, one dot each. */
		count: number;
		/** Each dot's accessible name, from its zero-based index, such as "Photo 2 of 3". */
		label: (index: number) => string;
		/** The slide the page renders in view, marked before script runs. @default 0 */
		current?: number;
	}

	/** Every native `<span>` attribute, plus the viewport it reads and its size. */
	export interface CountProps extends Omit<TagProps<"span">, "children"> {
		/** `id` of the {@link Carousel.Viewport} whose position it shows. */
		viewport: string;
		/** How many slides the viewport holds. */
		total: number;
		/** The slide the page renders in view. @default 0 */
		current?: number;
	}

	export interface NextProps extends Omit<Button.Props, "commandfor" | "command"> {
		/** `id` of the {@link Carousel.Viewport} this control scrolls forward through. */
		commandfor: string;
		/** Invoker Commands verb a `carouselControls()` mixin listens for. Defaults to `"--ui-next"`. */
		command?: "--ui-next";
	}
}

/**
 * The carousel root: a `<section>` stacking {@link Carousel.Viewport} and
 * {@link Carousel.Controls} in a column, declaring the `--ui-carousel-*`
 * custom properties its descendants read with per-instance defaults.
 *
 * @param handle Runtime handle carrying the host `<section>`'s props.
 * @returns The render function producing the carousel's markup.
 * @example
 * <Carousel aria-label={t("gallery.label")}>
 * 	<Carousel.Viewport id="gallery-viewport">
 * 		<Carousel.Track>
 * 			<Carousel.Slide><img src={photo.src} alt={photo.alt} /></Carousel.Slide>
 * 		</Carousel.Track>
 * 	</Carousel.Viewport>
 * 	<Carousel.Controls>
 * 		<Carousel.Previous commandfor="gallery-viewport" aria-label={t("gallery.previous")} />
 * 		<Carousel.Next commandfor="gallery-viewport" aria-label={t("gallery.next")} />
 * 	</Carousel.Controls>
 * </Carousel>
 * @example
 * // Landing browser-flow strip: widen `--ui-carousel-slide-size` for product
 * // frames and keep Previous/Next on `size="sm"` so controls stay quiet.
 * <Carousel
 * 	aria-label={t("flows.label")}
 * 	style={{ "--ui-carousel-slide-size": "28rem" }}
 * >
 * 	<Carousel.Viewport id="flows" mix={[carouselControls()]}>
 * 		<Carousel.Track>{slides}</Carousel.Track>
 * 	</Carousel.Viewport>
 * 	<Carousel.Controls>
 * 		<Carousel.Previous commandfor="flows" aria-label={t("flows.previous")} />
 * 		<Carousel.Next commandfor="flows" aria-label={t("flows.next")} />
 * 	</Carousel.Controls>
 * </Carousel>
 */
export function Carousel(handle: Handle<Carousel.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<section
				{...rest}
				data-slot="carousel"
				mix={mergeMix(
					[
						flex(),
						flexCol(),
						gap(3),
						vars({
							"ui-carousel-gap": "1rem",
							"ui-carousel-slide-size": "18rem",
							"ui-carousel-padding": "0px",
						}),
					],
					mix,
				)}
			/>
		);
	};
}

/**
 * A `<div>` scrolling {@link Carousel.Track} along the inline axis via logical
 * properties for correct writing direction, with mandatory scroll-snap stops;
 * scroll padding reads `--ui-carousel-padding` to clear the track's own padding.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the viewport's markup.
 * @example
 * <Carousel.Viewport id="gallery-viewport">
 * 	<Carousel.Track>{slides}</Carousel.Track>
 * </Carousel.Viewport>
 */
Carousel.Viewport = function CarouselViewport(handle: Handle<Carousel.ViewportProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="viewport"
				mix={mergeMix(
					[
						attrs({ role: DEFAULT_VIEWPORT_ROLE, tabIndex: DEFAULT_VIEWPORT_TAB_INDEX }),
						when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
						raw({
							overflowInline: "auto",
							overflowBlock: "hidden",
							scrollBehavior: "smooth",
							scrollSnapType: "inline mandatory",
							scrollPaddingInline: "var(--ui-carousel-padding, 0px)",
							"-webkit-overflow-scrolling": "touch",
						}),
						media("(prefers-reduced-motion: reduce)", raw({ scrollBehavior: "auto" })),
					],
					mix,
				)}
			/>
		);
	};
};

/**
 * The carousel's slide row: a `<div>` laying its {@link Carousel.Slide}
 * children out in one inline row, gapped by `--ui-carousel-gap` and padded by
 * `--ui-carousel-padding` so the first and last slide can still center.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the track's markup.
 * @example
 * <Carousel.Track>
 * 	<Carousel.Slide>{firstSlide}</Carousel.Slide>
 * 	<Carousel.Slide>{secondSlide}</Carousel.Slide>
 * </Carousel.Track>
 */
Carousel.Track = function CarouselTrack(handle: Handle<Carousel.TrackProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="track"
				mix={mergeMix(
					[flex(), gap("var(--ui-carousel-gap, 1rem)"), pi("var(--ui-carousel-padding, 0px)")],
					mix,
				)}
			/>
		);
	};
};

/**
 * A single slide: a `<div>` held at `--ui-carousel-slide-size` along the
 * inline axis, snapping to its inline-start edge so the viewport settles on a
 * slide boundary.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the slide's markup.
 * @example
 * <Carousel.Slide><img src={photo.src} alt={photo.alt} /></Carousel.Slide>
 */
Carousel.Slide = function CarouselSlide(handle: Handle<Carousel.SlideProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="slide"
				data-carousel-slide=""
				mix={mergeMix(
					[
						attrs({ role: DEFAULT_SLIDE_ROLE }),
						grow(0),
						shrink(0),
						/**
						 * The slide snaps to the viewport's start edge and leaves the scroll free to pass it:
						 * `scroll-snap-stop: always` clamps programmatic scrolls too, so every dot would move
						 * one slide and none would reach the slide it names.
						 */
						raw({
							flexBasis: "var(--ui-carousel-slide-size, 18rem)",
							scrollSnapAlign: "start",
						}),
					],
					mix,
				)}
			/>
		);
	};
};

/**
 * The carousel's control row: a `<div>` laying {@link Carousel.Previous} and
 * {@link Carousel.Next} out as an end-aligned, vertically centered row.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the control row's markup.
 * @example
 * <Carousel.Controls>
 * 	<Carousel.Previous commandfor="gallery-viewport" aria-label={t("gallery.previous")} />
 * 	<Carousel.Next commandfor="gallery-viewport" aria-label={t("gallery.next")} />
 * </Carousel.Controls>
 */
Carousel.Controls = function CarouselControls(handle: Handle<Carousel.ControlsProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="controls"
				mix={mergeMix([flex(), items("center"), gap(2), justify("end")], mix)}
			/>
		);
	};
};

/**
 * A static control scrolling {@link Carousel.Viewport} named by `commandfor` back
 * one slide when a hydrated `carouselControls()` mixin handles `"--ui-prev"`; custom
 * `children` replacing the chevron still need their own `aria-label`.
 *
 * @param handle Runtime handle carrying the host button's props.
 * @returns The render function producing the control's markup.
 * @example
 * <Carousel.Previous commandfor="gallery-viewport" aria-label={t("gallery.previous")} />
 */
Carousel.Previous = function CarouselPrevious(handle: Handle<Carousel.PreviousProps>) {
	return () => {
		let { variant, color, size, command, children, mix, ...rest } = handle.props;
		let resolvedVariant = variant ?? DEFAULT_CONTROL_VARIANT;
		let resolvedColor = color ?? DEFAULT_CONTROL_COLOR;
		let resolvedSize = size ?? DEFAULT_CONTROL_SIZE;
		let resolvedCommand = command ?? DEFAULT_PREVIOUS_COMMAND;

		return (
			<Button
				{...rest}
				type="button"
				variant={resolvedVariant}
				color={resolvedColor}
				size={resolvedSize}
				command={resolvedCommand}
				data-slot="previous"
				mix={mergeMix([minIs(0), when("& > svg", [is(4), bs(4)])], mix)}
			>
				{children ?? <ChevronLeftIcon />}
			</Button>
		);
	};
};

/**
 * A static control scrolling {@link Carousel.Viewport} named by `commandfor` forward
 * one slide when a hydrated `carouselControls()` mixin handles `"--ui-next"`; custom
 * `children` replacing the chevron still need their own `aria-label`.
 *
 * @param handle Runtime handle carrying the host button's props.
 * @returns The render function producing the control's markup.
 * @example
 * <Carousel.Next commandfor="gallery-viewport" aria-label={t("gallery.next")} />
 */
Carousel.Next = function CarouselNext(handle: Handle<Carousel.NextProps>) {
	return () => {
		let { variant, color, size, command, children, mix, ...rest } = handle.props;
		let resolvedVariant = variant ?? DEFAULT_CONTROL_VARIANT;
		let resolvedColor = color ?? DEFAULT_CONTROL_COLOR;
		let resolvedSize = size ?? DEFAULT_CONTROL_SIZE;
		let resolvedCommand = command ?? DEFAULT_NEXT_COMMAND;

		return (
			<Button
				{...rest}
				type="button"
				variant={resolvedVariant}
				color={resolvedColor}
				size={resolvedSize}
				command={resolvedCommand}
				data-slot="next"
				mix={mergeMix([minIs(0), when("& > svg", [is(4), bs(4)])], mix)}
			>
				{children ?? <ChevronRightIcon />}
			</Button>
		);
	};
};

/**
 * A row of dots, one `--ui-goto` invoker per slide, the one in view marked with
 * `aria-current`. Each dot draws 6px inside a 24px target, so a row reads as a position
 * indicator and still takes a thumb; it needs `carouselControls()` or {@link CarouselSync}.
 *
 * @example <Carousel.Dots commandfor="photos" count={3} label={(i) => `Photo ${i + 1} of 3`} />
 */
Carousel.Dots = function CarouselDots(handle: Handle<Carousel.DotsProps>) {
	return () => {
		let { commandfor, count, current = 0, label, mix, ...rest } = handle.props;
		return (
			<div
				{...rest}
				data-slot="dots"
				mix={mergeMix([flex(), justify("center"), items("center")], mix)}
			>
				{Array.from({ length: count }, (_, index) => (
					<button
						type="button"
						commandfor={commandfor}
						command="--ui-goto"
						data-slide={String(index)}
						aria-label={label(index)}
						aria-current={index === current ? "true" : undefined}
						mix={[
							raw({
								display: "grid",
								placeItems: "center",
								inlineSize: "var(--ui-carousel-dot-target, 1.5rem)",
								blockSize: "var(--ui-carousel-dot-target, 1.5rem)",
								marginInline: "calc((var(--ui-carousel-dot-target, 1.5rem) - 0.75rem) / -2)",
								padding: "0",
								border: "0",
								background: "transparent",
								cursor: "pointer",
								"&::before": {
									content: '""',
									inlineSize: "0.375rem",
									blockSize: "0.375rem",
									borderRadius: "999px",
									backgroundColor:
										"var(--ui-carousel-dot, color-mix(in oklch, currentColor 45%, transparent))",
									transition: "background-color 150ms ease, scale 150ms ease",
								},
							}),
							when(
								'&[aria-current="true"]::before',
								raw({
									backgroundColor: "var(--ui-carousel-dot-current, currentColor)",
									scale: "1.25",
								}),
							),
							when("&:focus-visible", outline({ color: "brand.ring", offset: 0 })),
							media(
								"(prefers-reduced-motion: reduce)",
								raw({ "&::before": { transition: "none" } }),
							),
						]}
					/>
				))}
			</div>
		);
	};
};

/**
 * The position as `n / N` in tabular figures, rewritten as the viewport scrolls by
 * `carouselControls()` or {@link CarouselSync}. It is hidden from assistive tech, since
 * the dots' current marker already says the same.
 *
 * @example <Carousel.Count viewport="photos" total={3} />
 */
Carousel.Count = function CarouselCount(handle: Handle<Carousel.CountProps>) {
	return () => {
		let { current = 0, mix, total, viewport, ...rest } = handle.props;
		return (
			<span
				{...rest}
				aria-hidden="true"
				data-slot="count"
				data-carousel-count-for={viewport}
				mix={mergeMix([raw({ fontVariantNumeric: "tabular-nums" })], mix)}
			>
				{current + 1} / {total}
			</span>
		);
	};
};

/**
 * The island that runs a Carousel without a page-written island around its viewport: a
 * hidden marker placed anywhere inside the {@link Carousel} root. It loads from
 * `@sdxc/ui/carousel`, which the app's browser entry maps to an import.
 *
 * @example <Carousel>…<CarouselSync /></Carousel>
 */
export const CarouselSync: EntryComponent<Record<never, never>> = clientEntry(
	"@sdxc/ui/carousel#CarouselSync",
	function CarouselSync() {
		return () => <span hidden mix={[carouselSync()]} />;
	},
);
