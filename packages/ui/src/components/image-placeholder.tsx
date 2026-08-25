/**
 * The shared foundation for a fixed-size image-with-fallback box — a user
 * avatar, a brand logo, or any other picture that needs a graceful stand-in
 * before it loads or when it's missing. It renders a sized, shaped host that
 * an image and a fallback layer both stack into, plus a corner status badge
 * and a group of overlapping instances with a trailing overflow count.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { bg, border, fg, outline } from "@pkg/u/color";
import { ringShadow, rounded } from "@pkg/u/effects";
import { userSelect } from "@pkg/u/general";
import {
	absolute,
	center,
	flex,
	inlineFlex,
	insBe,
	insIe,
	inset,
	items,
	justify,
	relative,
	shrink,
} from "@pkg/u/layout";
import { overflow } from "@pkg/u/overflow";
import { bs, fit, is, mis } from "@pkg/u/size";
import { data, when } from "@pkg/u/state";
import { text, textTransform, weight } from "@pkg/u/typography";

/** Size variant {@link ImagePlaceholder} falls back to when `size` is omitted. */
const DEFAULT_SIZE: ImagePlaceholder.Size = "md";

/**
 * Shape variant {@link ImagePlaceholder} and {@link ImagePlaceholder.GroupCount}
 * fall back to when `shape` is omitted.
 */
const DEFAULT_SHAPE: ImagePlaceholder.Shape = "circle";

/**
 * Prop types for {@link ImagePlaceholder} and its compound parts.
 */
export namespace ImagePlaceholder {
	/**
	 * Size variant controlling the host's rendered dimensions and, through
	 * ordinary inheritance, the fallback initials' font size.
	 */
	export type Size = "sm" | "md" | "lg";

	/**
	 * Shape variant controlling the corner rounding of the host, its image,
	 * and its fallback layer: `"circle"` renders a fully rounded disc, and
	 * `"square"` renders a softly rounded square.
	 */
	export type Shape = "circle" | "square";

	/**
	 * Props accepted by {@link ImagePlaceholder}.
	 */
	export interface Props extends TagProps<"span"> {
		/** Size variant. Defaults to {@link DEFAULT_SIZE}. */
		size?: Size;
		/** Shape variant. Defaults to {@link DEFAULT_SHAPE}. */
		shape?: Shape;
		/** The host's compound parts: {@link ImagePlaceholder.Image}, {@link ImagePlaceholder.Fallback}, and an optional {@link ImagePlaceholder.Badge}. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link ImagePlaceholder.Image}.
	 */
	export interface ImageProps extends Omit<
		TagProps<"img">,
		"src" | "alt" | "role" | "aria-label" | "aria-labelledby" | "title"
	> {
		/** Image source URL. */
		src: string;
		/**
		 * Accessible text description of the image. Required, since a
		 * consumer's own localized description drives what assistive
		 * technology announces.
		 */
		alt: string;
	}

	/**
	 * Props accepted by {@link ImagePlaceholder.Fallback}.
	 */
	export interface FallbackProps extends TagProps<"span"> {
		/** Fallback content, typically the subject's initials. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link ImagePlaceholder.Badge}.
	 */
	export interface BadgeProps extends TagProps<"span"> {}

	/**
	 * Props accepted by {@link ImagePlaceholder.Group}.
	 */
	export interface GroupProps extends TagProps<"div"> {
		/** A run of {@link ImagePlaceholder} instances, optionally trailed by {@link ImagePlaceholder.GroupCount}. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link ImagePlaceholder.GroupCount}.
	 */
	export interface GroupCountProps extends TagProps<"span"> {
		/** Shape variant, matching the shape of the sibling placeholders it trails. Defaults to {@link DEFAULT_SHAPE}. */
		shape?: Shape;
		/** The overflow count text, e.g. `"+3"`. */
		children: RemixNode;
	}
}

/**
 * Renders the placeholder host: a fixed-size, centered box whose `data-shape`
 * attribute styles it, its image, and its fallback together, leaving room
 * for {@link ImagePlaceholder.Badge} to sit unclipped on the corner.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the placeholder's markup.
 * @example
 * <ImagePlaceholder>
 * 	<ImagePlaceholder.Image src={user.avatarUrl} alt={user.name} />
 * 	<ImagePlaceholder.Fallback>{initials}</ImagePlaceholder.Fallback>
 * </ImagePlaceholder>
 * @example
 * <ImagePlaceholder size="lg" shape="square">
 * 	<ImagePlaceholder.Image src={org.logoUrl} alt={org.name} />
 * 	<ImagePlaceholder.Badge />
 * </ImagePlaceholder>
 */
export function ImagePlaceholder(handle: Handle<ImagePlaceholder.Props>) {
	return () => {
		let { size, shape, children, mix, ...rest } = handle.props;
		let resolvedSize = size ?? DEFAULT_SIZE;
		let resolvedShape = shape ?? DEFAULT_SHAPE;

		return (
			<span
				{...rest}
				data-slot="image-placeholder"
				data-size={resolvedSize}
				data-shape={resolvedShape}
				mix={[
					when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
					relative(),
					inlineFlex(),
					items("center"),
					justify("center"),
					bg("neutral.bg-tint-hover"),
					fg("neutral.emphasis"),
					shrink(),
					userSelect(),
					is("var(--ui-image-placeholder-size-md, 2.5rem)"),
					bs("var(--ui-image-placeholder-size-md, 2.5rem)"),
					text("sm"),
					data("size", "sm", [
						is("var(--ui-image-placeholder-size-sm, 2rem)"),
						bs("var(--ui-image-placeholder-size-sm, 2rem)"),
						text("xs"),
					]),
					data("size", "lg", [
						is("var(--ui-image-placeholder-size-lg, 3rem)"),
						bs("var(--ui-image-placeholder-size-lg, 3rem)"),
						text("base"),
					]),
					data("shape", "circle", [
						rounded("full"),
						when('& > [data-slot="image"]', rounded("full")),
						when('& > [data-slot="fallback"]', rounded("full")),
					]),
					data("shape", "square", [
						rounded("lg"),
						when('& > [data-slot="image"]', rounded("lg")),
						when('& > [data-slot="fallback"]', rounded("lg")),
					]),
					mix,
				]}
			>
				{children}
			</span>
		);
	};
}

/**
 * Renders the placeholder's image layer: an `<img>` cropped with
 * `object-fit: cover`, clipped to {@link ImagePlaceholder}'s `data-shape`.
 * Stacking above or below {@link ImagePlaceholder.Fallback} decides what shows.
 *
 * @param handle Runtime handle carrying the host `<img>`'s props.
 * @returns The render function producing the image layer's markup.
 * @example
 * <ImagePlaceholder.Image src={user.avatarUrl} alt={user.name} />
 */
ImagePlaceholder.Image = function ImagePlaceholderImage(
	handle: Handle<ImagePlaceholder.ImageProps>,
) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<img
				{...rest}
				data-slot="image"
				mix={[
					absolute(),
					is("full"),
					bs("full"),
					fit("cover"),
					inset(0, 0, 0, 0),
					overflow("hidden"),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders the placeholder's fallback layer: a `<span>` centering a consumer's
 * content in uppercase text. Font size inherits {@link ImagePlaceholder}'s
 * `data-size` via CSS, keeping initials proportional at every size.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the fallback layer's markup.
 * @example
 * <ImagePlaceholder.Fallback>{initials}</ImagePlaceholder.Fallback>
 */
ImagePlaceholder.Fallback = function ImagePlaceholderFallback(
	handle: Handle<ImagePlaceholder.FallbackProps>,
) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<span
				{...rest}
				data-slot="fallback"
				mix={[
					absolute(),
					center(),
					weight("medium"),
					bg("neutral.bg-tint-pressed"),
					fg("neutral"),
					inset(0, 0, 0, 0),
					overflow("hidden"),
					textTransform("uppercase"),
					mix,
				]}
			>
				{children}
			</span>
		);
	};
};

/**
 * Renders a small status dot pinned to the host's block-end/inline-end
 * corner, always fully rounded regardless of {@link ImagePlaceholder}'s own
 * shape, and ringed to read as cut from whatever sits beneath it.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the badge's markup.
 * @example
 * <ImagePlaceholder.Badge />
 */
ImagePlaceholder.Badge = function ImagePlaceholderBadge(
	handle: Handle<ImagePlaceholder.BadgeProps>,
) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<span
				{...rest}
				data-slot="badge"
				mix={[
					absolute(),
					is(3),
					bs(3),
					rounded("full"),
					border({ color: "neutral.tint", width: 2 }),
					bg("neutral.strong"),
					insBe("0"),
					insIe("0"),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a row of overlapping placeholders: a flex container that pulls each
 * child back over the previous one and rings each in the neutral tint background,
 * so the overlap reads as stacked cutouts.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the group's markup.
 * @example
 * <ImagePlaceholder.Group>
 * 	<ImagePlaceholder>…</ImagePlaceholder>
 * 	<ImagePlaceholder>…</ImagePlaceholder>
 * 	<ImagePlaceholder.GroupCount>+3</ImagePlaceholder.GroupCount>
 * </ImagePlaceholder.Group>
 */
ImagePlaceholder.Group = function ImagePlaceholderGroup(
	handle: Handle<ImagePlaceholder.GroupProps>,
) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="group"
				mix={[
					flex(),
					when("& > * + *", mis(-3)),
					when('& > [data-slot="image-placeholder"]', ringShadow("neutral.tint")),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
};

/**
 * Renders the "+N" overflow indicator trailing {@link ImagePlaceholder.Group}:
 * a fixed medium-size box matching {@link ImagePlaceholder}'s dimensions and
 * ring treatment, taking its own `shape` prop to match the sibling placeholders.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the overflow indicator's markup.
 * @example
 * <ImagePlaceholder.GroupCount>+3</ImagePlaceholder.GroupCount>
 */
ImagePlaceholder.GroupCount = function ImagePlaceholderGroupCount(
	handle: Handle<ImagePlaceholder.GroupCountProps>,
) {
	return () => {
		let { shape, children, mix, ...rest } = handle.props;
		let resolvedShape = shape ?? DEFAULT_SHAPE;

		return (
			<span
				{...rest}
				data-slot="group-count"
				data-shape={resolvedShape}
				mix={[
					relative(),
					inlineFlex(),
					items("center"),
					justify("center"),
					overflow("hidden"),
					weight("medium"),
					bg("neutral.bg-tint-hover"),
					fg("neutral"),
					when('&[data-shape="circle"]', rounded("full")),
					when('&[data-shape="square"]', rounded("lg")),
					shrink(),
					userSelect(),
					is("var(--ui-image-placeholder-size-md, 2.5rem)"),
					bs("var(--ui-image-placeholder-size-md, 2.5rem)"),
					text("sm"),
					ringShadow("neutral.tint"),
					mix,
				]}
			>
				{children}
			</span>
		);
	};
};
