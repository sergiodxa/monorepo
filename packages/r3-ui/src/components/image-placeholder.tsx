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

import { css } from "remix/ui";

import { focusRingPrimary } from "../styles/focus-ring";

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
		 * Accessible text description of the image. Required — the component
		 * ships no built-in copy, so a consumer's own localized description
		 * always drives what assistive technology announces.
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
 * Renders the placeholder host: a fixed-size, centered box tinted with the
 * neutral tint background and emphasis foreground, sized through the
 * `data-size` attribute contract (`"sm"`, `"md"`, or `"lg"`) and shaped
 * through `data-shape` (`"circle"` or `"square"`). The shape choice also
 * governs the corner rounding of any {@link ImagePlaceholder.Image} or
 * {@link ImagePlaceholder.Fallback} nested directly inside it, so a consumer
 * sets the shape once on the host rather than on every part.
 *
 * The host itself carries no `overflow: hidden`, leaving room for
 * {@link ImagePlaceholder.Badge} to sit on its corner unclipped while
 * {@link ImagePlaceholder.Image} and {@link ImagePlaceholder.Fallback} clip
 * themselves to the chosen shape independently.
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
					focusRingPrimary(),
					css({
						position: "relative",
						display: "inline-flex",
						flexShrink: 0,
						alignItems: "center",
						justifyContent: "center",
						userSelect: "none",
						inlineSize: "var(--ui-image-placeholder-size-md, 2.5rem)",
						blockSize: "var(--ui-image-placeholder-size-md, 2.5rem)",
						fontSize: "0.875rem",
						lineHeight: "calc(1.25 / 0.875)",
						backgroundColor: "var(--ui-neutral-bg-tint-hover)",
						color: "var(--ui-neutral-fg-emphasis)",

						'&[data-size="sm"]': {
							inlineSize: "var(--ui-image-placeholder-size-sm, 2rem)",
							blockSize: "var(--ui-image-placeholder-size-sm, 2rem)",
							fontSize: "0.75rem",
							lineHeight: "calc(1 / 0.75)",
						},
						'&[data-size="lg"]': {
							inlineSize: "var(--ui-image-placeholder-size-lg, 3rem)",
							blockSize: "var(--ui-image-placeholder-size-lg, 3rem)",
							fontSize: "1rem",
							lineHeight: "1.5",
						},

						'&[data-shape="circle"]': {
							borderRadius: "var(--ui-radius-full, 9999px)",
							'& > [data-slot="image"]': {
								borderRadius: "var(--ui-radius-full, 9999px)",
							},
							'& > [data-slot="fallback"]': {
								borderRadius: "var(--ui-radius-full, 9999px)",
							},
						},
						'&[data-shape="square"]': {
							borderRadius: "var(--ui-radius-lg, 0.5rem)",
							'& > [data-slot="image"]': {
								borderRadius: "var(--ui-radius-lg, 0.5rem)",
							},
							'& > [data-slot="fallback"]': {
								borderRadius: "var(--ui-radius-lg, 0.5rem)",
							},
						},
					}),
					mix,
				]}
			>
				{children}
			</span>
		);
	};
}

/**
 * Renders the placeholder's image layer: an absolutely positioned `<img>`
 * filling its host edge to edge and cropped with `object-fit: cover`, clipped
 * to the shape {@link ImagePlaceholder} chose through its own `data-shape`
 * attribute. Stack it above or below {@link ImagePlaceholder.Fallback} —
 * whichever a consumer renders decides which layer shows, since this
 * component carries no image-load detection of its own.
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
					css({
						position: "absolute",
						insetBlockStart: "0",
						insetBlockEnd: "0",
						insetInlineStart: "0",
						insetInlineEnd: "0",
						inlineSize: "100%",
						blockSize: "100%",
						overflow: "hidden",
						objectFit: "cover",
					}),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders the placeholder's fallback layer: an absolutely positioned
 * `<span>` filling its host edge to edge, centering whatever content a
 * consumer supplies (typically initials) in uppercase, medium-weight text,
 * tinted with the neutral pressed-tint background. Its font size is never
 * fixed on its own — it inherits {@link ImagePlaceholder}'s `data-size`-driven
 * font size through ordinary CSS inheritance, so initials stay in proportion
 * at every size instead of rendering at one fixed scale.
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
					css({
						position: "absolute",
						insetBlockStart: "0",
						insetBlockEnd: "0",
						insetInlineStart: "0",
						insetInlineEnd: "0",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						overflow: "hidden",
						fontWeight: "500",
						textTransform: "uppercase",
						backgroundColor: "var(--ui-neutral-bg-tint-pressed)",
						color: "var(--ui-neutral-fg)",
					}),
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
 * shape, ringed with a border the width of the neutral tint background so it
 * reads as cut out from whatever sits beneath it. Its fill color defaults to
 * the neutral strong border tone; override it (a presence color, for
 * example) through `style` or an additional `mix`.
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
					css({
						position: "absolute",
						insetBlockEnd: "0",
						insetInlineEnd: "0",
						inlineSize: "0.75rem",
						blockSize: "0.75rem",
						borderRadius: "var(--ui-radius-full, 9999px)",
						borderWidth: "2px",
						borderStyle: "solid",
						borderColor: "var(--ui-neutral-bg-tint)",
						backgroundColor: "var(--ui-neutral-border-strong)",
					}),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a row of overlapping placeholders: a flex container that pulls
 * every child but the first back over its predecessor and rings each direct
 * {@link ImagePlaceholder} child in the neutral tint background color, so the
 * overlap reads as stacked cutouts rather than flat overlapping edges.
 * Trail it with {@link ImagePlaceholder.GroupCount} for a "+N" overflow
 * indicator that picks up the same overlap and ring treatment.
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
					css({
						display: "flex",

						"& > * + *": {
							marginInlineStart: "-0.75rem",
						},
						'& > [data-slot="image-placeholder"]': {
							boxShadow: "0 0 0 2px var(--ui-neutral-bg-tint)",
						},
					}),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
};

/**
 * Renders the "+N" overflow indicator that trails
 * {@link ImagePlaceholder.Group}: a fixed medium-size box matching
 * {@link ImagePlaceholder}'s default dimensions, ringed the same way a
 * grouped placeholder is, shaped through its own `shape` prop since it
 * renders as a sibling rather than nesting inside a placeholder host.
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
					css({
						position: "relative",
						display: "inline-flex",
						flexShrink: 0,
						alignItems: "center",
						justifyContent: "center",
						userSelect: "none",
						overflow: "hidden",
						inlineSize: "var(--ui-image-placeholder-size-md, 2.5rem)",
						blockSize: "var(--ui-image-placeholder-size-md, 2.5rem)",
						fontSize: "0.875rem",
						lineHeight: "calc(1.25 / 0.875)",
						fontWeight: "500",
						boxShadow: "0 0 0 2px var(--ui-neutral-bg-tint)",
						backgroundColor: "var(--ui-neutral-bg-tint-hover)",
						color: "var(--ui-neutral-fg)",

						'&[data-shape="circle"]': {
							borderRadius: "var(--ui-radius-full, 9999px)",
						},
						'&[data-shape="square"]': {
							borderRadius: "var(--ui-radius-lg, 0.5rem)",
						},
					}),
					mix,
				]}
			>
				{children}
			</span>
		);
	};
};
