/**
 * A brand mark rendered as a fixed-size, softly rounded host stacking an
 * image layer, an initials fallback, and an optional corner status badge,
 * plus a way to overlap several instances into one group with a trailing
 * overflow count. It specializes the shared image-with-fallback foundation
 * to always render with soft square corners, since a logo's corner shape
 * never varies the way a profile picture's might.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { ImagePlaceholder } from "./image-placeholder";

/**
 * Prop types for {@link Logo} and its compound parts. Every compound part
 * is an alias of {@link ImagePlaceholder}'s matching part, since {@link Logo}
 * renders straight through to {@link ImagePlaceholder} — fixed to its soft
 * square shape — rather than declaring an independent markup shape of its
 * own.
 */
export namespace Logo {
	/**
	 * Size variant controlling the host's rendered dimensions and, through
	 * ordinary inheritance, the fallback initials' font size. Re-exports
	 * {@link ImagePlaceholder.Size}.
	 */
	export type Size = ImagePlaceholder.Size;

	/**
	 * Props accepted by {@link Logo}: every prop {@link ImagePlaceholder.Props}
	 * accepts except `shape`, which stays fixed to a soft square.
	 */
	export interface Props extends Omit<ImagePlaceholder.Props, "shape"> {}

	/**
	 * Props accepted by {@link Logo.Image}, unchanged from
	 * {@link ImagePlaceholder.ImageProps}.
	 */
	export interface ImageProps extends ImagePlaceholder.ImageProps {}

	/**
	 * Props accepted by {@link Logo.Fallback}, unchanged from
	 * {@link ImagePlaceholder.FallbackProps}.
	 */
	export interface FallbackProps extends ImagePlaceholder.FallbackProps {}

	/**
	 * Props accepted by {@link Logo.Badge}, unchanged from
	 * {@link ImagePlaceholder.BadgeProps}.
	 */
	export interface BadgeProps extends ImagePlaceholder.BadgeProps {}

	/**
	 * Props accepted by {@link Logo.Group}, unchanged from
	 * {@link ImagePlaceholder.GroupProps}.
	 */
	export interface GroupProps extends ImagePlaceholder.GroupProps {}

	/**
	 * Props accepted by {@link Logo.Group.Count}: every prop
	 * {@link ImagePlaceholder.GroupCountProps} accepts except `shape`, which
	 * stays fixed to the same soft square the logos it trails render with.
	 */
	export interface GroupCountProps extends Omit<ImagePlaceholder.GroupCountProps, "shape"> {}
}

/**
 * Renders a fixed-size, softly rounded brand-mark host, sized through the
 * `data-size` attribute contract (`"sm"`, `"md"`, or `"lg"`) that
 * {@link ImagePlaceholder} carries along unchanged, stacking whichever of
 * {@link Logo.Image}, {@link Logo.Fallback}, and {@link Logo.Badge} a
 * consumer composes as children. The square corner rounding is fixed here
 * rather than left to a `shape` prop, since a brand mark never renders with
 * the full circle {@link ImagePlaceholder} otherwise allows.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the brand-mark host's markup.
 * @example
 * <Logo>
 * 	<Logo.Image src={org.logoUrl} alt={org.name} />
 * 	<Logo.Fallback>{initials}</Logo.Fallback>
 * </Logo>
 * @example
 * <Logo size="lg">
 * 	<Logo.Image src={org.logoUrl} alt={org.name} />
 * 	<Logo.Fallback>{initials}</Logo.Fallback>
 * 	<Logo.Badge aria-label={t("status.verified")} />
 * </Logo>
 */
export function Logo(handle: Handle<Logo.Props>) {
	return () => <ImagePlaceholder {...handle.props} shape="square" />;
}

/**
 * Renders the logo's image layer: identical to {@link ImagePlaceholder.Image},
 * an absolutely positioned `<img>` filling the host edge to edge and cropped
 * with `object-fit: cover`, clipped to {@link Logo}'s fixed soft-square shape.
 * Stack it above or below {@link Logo.Fallback} — whichever a consumer
 * renders decides which layer shows, since this component carries no
 * image-load detection of its own.
 *
 * @param handle Runtime handle carrying the host `<img>`'s props.
 * @returns The render function producing the image layer's markup.
 * @example
 * <Logo.Image src={org.logoUrl} alt={org.name} />
 */
Logo.Image = ImagePlaceholder.Image;

/**
 * Renders the logo's fallback layer: identical to
 * {@link ImagePlaceholder.Fallback}, an absolutely positioned `<span>`
 * filling the host edge to edge, centering whatever content a consumer
 * supplies (typically initials) in uppercase, medium-weight text. Its font
 * size inherits from {@link Logo}'s `data-size`-driven font size, so
 * initials stay in proportion at every size instead of rendering at one
 * fixed scale.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the fallback layer's markup.
 * @example
 * <Logo.Fallback>{initials}</Logo.Fallback>
 */
Logo.Fallback = ImagePlaceholder.Fallback;

/**
 * Renders a small status dot pinned to the host's block-end/inline-end
 * corner: identical to {@link ImagePlaceholder.Badge}, always fully rounded,
 * ringed with a border matching the surrounding background so it reads as
 * cut out from whatever sits beneath it.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the badge's markup.
 * @example
 * <Logo.Badge aria-label={t("status.verified")} />
 */
Logo.Badge = ImagePlaceholder.Badge;

/**
 * Renders {@link Logo.GroupProps.children} as a row of overlapping logos: a
 * flex container that pulls every child but the first back over its
 * predecessor and rings each direct {@link Logo} child, so the overlap reads
 * as stacked cutouts rather than flat overlapping edges. Trail it with
 * {@link Logo.Group.Count} for a "+N" overflow indicator that picks up the
 * same overlap and ring treatment.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the group's markup.
 * @example
 * <Logo.Group>
 * 	<Logo>…</Logo>
 * 	<Logo>…</Logo>
 * 	<Logo.Group.Count>+3</Logo.Group.Count>
 * </Logo.Group>
 */
function LogoGroup(handle: Handle<Logo.GroupProps>) {
	return () => <ImagePlaceholder.Group {...handle.props} />;
}

/**
 * Renders the "+N" overflow indicator that trails {@link Logo.Group}: a
 * fixed medium-size box matching {@link Logo}'s default dimensions, ringed
 * the same way a grouped logo is, fixed to the same soft square every
 * {@link Logo} renders with instead of exposing the full-circle variant
 * {@link ImagePlaceholder.GroupCount} otherwise allows.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the overflow indicator's markup.
 * @example
 * <Logo.Group.Count>+3</Logo.Group.Count>
 */
function LogoGroupCount(handle: Handle<Logo.GroupCountProps>) {
	return () => <ImagePlaceholder.GroupCount {...handle.props} shape="square" />;
}

LogoGroup.Count = LogoGroupCount;
Logo.Group = LogoGroup;
