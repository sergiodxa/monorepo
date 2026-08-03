/**
 * A horizontally scrolling collection of slides riding native CSS scroll
 * snap, so swiping or scrolling advances between slides with no script
 * anywhere in the baseline. {@link Carousel.Viewport} is the scrolling
 * surface, {@link Carousel.Track} lays its {@link Carousel.Slide} children out
 * in a row, and {@link Carousel.Previous}/{@link Carousel.Next} are static
 * invoker buttons a paired mixin can wire into working controls.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { ChevronLeftIcon, ChevronRightIcon } from "@pkg/lucide-remix";
import { outline } from "@pkg/u/color";
import { raw, vars } from "@pkg/u/general";
import { flex, flexCol, gap, grow, items, justify, shrink } from "@pkg/u/layout";
import { media } from "@pkg/u/responsive";
import { bs, is, minIs, pi } from "@pkg/u/size";
import { when } from "@pkg/u/state";
import { attrs } from "remix/ui";

import { Button } from "./button";

/** Native ARIA role applied to {@link Carousel.Viewport} unless a consumer overrides it. */
const DEFAULT_VIEWPORT_ROLE = "group";

/** Native tab-stop index applied to {@link Carousel.Viewport} unless a consumer overrides it, so the scrollable region is reachable by keyboard even before any control is wired up. */
const DEFAULT_VIEWPORT_TAB_INDEX = 0;

/** Native ARIA role applied to {@link Carousel.Slide} unless a consumer overrides it. */
const DEFAULT_SLIDE_ROLE = "group";

/** Visual weight {@link Carousel.Previous} and {@link Carousel.Next} fall back to when `variant` is omitted. */
const DEFAULT_CONTROL_VARIANT: Button.Variant = "ghost";

/** Semantic color role {@link Carousel.Previous} and {@link Carousel.Next} fall back to when `color` is omitted. */
const DEFAULT_CONTROL_COLOR: Button.Color = "neutral";

/** Size variant {@link Carousel.Previous} and {@link Carousel.Next} fall back to when `size` is omitted. */
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
	 * passthrough. The root exposes its slide gap, slide size, and scroll
	 * padding as the `--ui-carousel-gap`, `--ui-carousel-slide-size`, and
	 * `--ui-carousel-padding` custom properties, each overridable per instance
	 * through the inherited `style` prop.
	 */
	export interface Props extends TagProps<"section"> {}

	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 * Give it an `id` for {@link Carousel.Previous} and {@link Carousel.Next}
	 * to target through their `commandfor` prop, and pair a `carouselControls()`
	 * mixin on it to make those controls scroll it.
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
	 * Every {@link Button.Props} field except `commandfor`/`command`, which
	 * this type narrows.
	 */
	export interface PreviousProps extends Omit<Button.Props, "commandfor" | "command"> {
		/** `id` of the {@link Carousel.Viewport} this control scrolls back through. */
		commandfor: string;
		/** Invoker Commands verb a `carouselControls()` mixin listens for. Defaults to `"--ui-prev"`. */
		command?: "--ui-prev";
	}

	/**
	 * Every {@link Button.Props} field except `commandfor`/`command`, which
	 * this type narrows.
	 */
	export interface NextProps extends Omit<Button.Props, "commandfor" | "command"> {
		/** `id` of the {@link Carousel.Viewport} this control scrolls forward through. */
		commandfor: string;
		/** Invoker Commands verb a `carouselControls()` mixin listens for. Defaults to `"--ui-next"`. */
		command?: "--ui-next";
	}
}

/**
 * Renders the carousel's root, a `<section>` stacking its
 * {@link Carousel.Viewport} and, when present, {@link Carousel.Controls} in a
 * column with a small gap. Declares the `--ui-carousel-gap`,
 * `--ui-carousel-slide-size`, and `--ui-carousel-padding` custom properties
 * its descendants read, each with a sensible default that a consumer can
 * override per instance.
 *
 * The scroll-snap behavior riding {@link Carousel.Viewport} and
 * {@link Carousel.Slide} works with no script at all — swiping or scrolling
 * the viewport already snaps between slides. Pairing a `carouselControls()`
 * mixin on the viewport turns {@link Carousel.Previous} and
 * {@link Carousel.Next} into working buttons and keeps their disabled state in
 * sync with the scroll position; without it, those controls simply render
 * inert.
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
 */
export function Carousel(handle: Handle<Carousel.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<section
				{...rest}
				data-slot="carousel"
				mix={[
					flex(),
					flexCol(),
					gap(3),
					vars({
						"ui-carousel-gap": "1rem",
						"ui-carousel-slide-size": "18rem",
						"ui-carousel-padding": "0px",
					}),
					mix,
				]}
			/>
		);
	};
}

/**
 * Renders the carousel's scrolling surface: a `<div>` clipping its
 * {@link Carousel.Track} child to its own inline size and scrolling it along
 * the inline axis with mandatory scroll-snap-stops, so a swipe, a scroll
 * wheel, or a trackpad gesture already advances one slide at a time with no
 * script involved. Its scroll padding reads `--ui-carousel-padding` so a
 * snapped slide clears any inline padding the track carries. Reachable in Tab
 * order through its own tab stop (arrow-key scrolling itself needs a paired
 * mixin, since HTML has no declarative way to bind arrow keys to scrolling), and
 * gains a focus-visible ring in the primary color once focused that way.
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
				mix={[
					attrs({ role: DEFAULT_VIEWPORT_ROLE, tabIndex: DEFAULT_VIEWPORT_TAB_INDEX }),
					when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
					// `@pkg/u/overflow` only exposes physical `overflowX`/`overflowY` —
					// no logical-property equivalent — and this viewport deliberately
					// scrolls along the inline axis regardless of writing direction, so
					// it stays on the logical `overflowInline`/`overflowBlock` pair here.
					raw({
						overflowInline: "auto",
						overflowBlock: "hidden",
						scrollBehavior: "smooth",
						scrollSnapType: "inline mandatory",
						scrollPaddingInline: "var(--ui-carousel-padding, 0px)",
						"-webkit-overflow-scrolling": "touch",
					}),
					media("(prefers-reduced-motion: reduce)", raw({ scrollBehavior: "auto" })),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders the carousel's slide row: a `<div>` laying its
 * {@link Carousel.Slide} children out in a single inline row, gapped by
 * `--ui-carousel-gap` and padded inline by `--ui-carousel-padding` so the
 * first and last slide can still center under scroll-snap.
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
				mix={[
					flex(),
					gap("var(--ui-carousel-gap, 1rem)"),
					pi("var(--ui-carousel-padding, 0px)"),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a single slide: a `<div>` sized by `--ui-carousel-slide-size` along
 * the inline axis and prevented from shrinking below it, with a mandatory
 * scroll-snap stop at its own inline-start edge so the viewport always
 * settles on a slide boundary rather than a partial scroll position.
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
				mix={[
					attrs({ role: DEFAULT_SLIDE_ROLE }),
					grow(0),
					shrink(0),
					raw({
						flexBasis: "var(--ui-carousel-slide-size, 18rem)",
						scrollSnapAlign: "start",
						scrollSnapStop: "always",
					}),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders the carousel's control row: a `<div>` laying {@link Carousel.Previous}
 * and {@link Carousel.Next} out as an end-aligned, vertically centered row.
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
				mix={[
					flex(),
					items("center"),
					gap(2),
					// `justify("end")` resolves to `justify-content: end`, which CSS Box
					// Alignment treats as equivalent to `flex-end` in this non-reversed
					// row flex container.
					justify("end"),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a static control that scrolls the {@link Carousel.Viewport} named by
 * `commandfor` back one slide: a small, ghost-styled {@link Button} carrying a
 * leading-direction chevron by default. `command` defaults to `"--ui-prev"`,
 * the verb a `carouselControls()` mixin on the target viewport listens for —
 * without that mixin applied and hydrated, the control renders but does
 * nothing yet, since Invoker Commands prefixed with `--` carry no built-in
 * behavior of their own.
 *
 * Pass `children` to replace the default chevron with custom content; Button's
 * own dev-mode check still applies, so an icon-only replacement still needs
 * its own `aria-label`.
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
				mix={[minIs(0), when("& > svg", [is(4), bs(4)]), mix]}
			>
				{children ?? <ChevronLeftIcon />}
			</Button>
		);
	};
};

/**
 * Renders a static control that scrolls the {@link Carousel.Viewport} named by
 * `commandfor` forward one slide: a small, ghost-styled {@link Button}
 * carrying a trailing-direction chevron by default. `command` defaults to
 * `"--ui-next"`, the verb a `carouselControls()` mixin on the target viewport
 * listens for — without that mixin applied and hydrated, the control renders
 * but does nothing yet, since Invoker Commands prefixed with `--` carry no
 * built-in behavior of their own.
 *
 * Pass `children` to replace the default chevron with custom content; Button's
 * own dev-mode check still applies, so an icon-only replacement still needs
 * its own `aria-label`.
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
				mix={[minIs(0), when("& > svg", [is(4), bs(4)]), mix]}
			>
				{children ?? <ChevronRightIcon />}
			</Button>
		);
	};
};
