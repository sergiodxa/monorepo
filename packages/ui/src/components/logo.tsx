/**
 * A brand mark rendered as a fixed-size, softly rounded host stacking an
 * image layer, an initials fallback, and an optional corner status badge,
 * plus a way to overlap several instances into one group with a trailing
 * overflow count.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { ImagePlaceholder } from "./image-placeholder.js";

/**
 * Prop types for {@link Logo} and its compound parts, each an alias of
 * {@link ImagePlaceholder}'s matching part since {@link Logo} renders
 * straight through to {@link ImagePlaceholder} fixed to its soft square shape.
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
 * Renders a fixed-size, softly rounded brand-mark host that stacks whichever
 * of {@link Logo.Image}, {@link Logo.Fallback}, and {@link Logo.Badge} a
 * consumer composes as children, with square corner rounding fixed in place.
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
 * Renders the logo's image layer: an absolutely positioned `<img>` filling
 * the host edge to edge, cropped with `object-fit: cover` and clipped to
 * {@link Logo}'s soft-square shape.
 *
 * @param handle Runtime handle carrying the host `<img>`'s props.
 * @returns The render function producing the image layer's markup.
 * @example
 * <Logo.Image src={org.logoUrl} alt={org.name} />
 */
Logo.Image = ImagePlaceholder.Image;

/**
 * Renders the logo's fallback layer: a `<span>` centering a consumer's
 * initials in uppercase, medium-weight text sized to {@link Logo}'s
 * `data-size` so they stay in proportion at every size.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the fallback layer's markup.
 * @example
 * <Logo.Fallback>{initials}</Logo.Fallback>
 */
Logo.Fallback = ImagePlaceholder.Fallback;

/**
 * Renders a small status dot pinned to the host's block-end/inline-end
 * corner, fully rounded and ringed with a border matching the surrounding
 * background so it reads as cut out.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the badge's markup.
 * @example
 * <Logo.Badge aria-label={t("status.verified")} />
 */
Logo.Badge = ImagePlaceholder.Badge;

/**
 * Renders {@link Logo.GroupProps.children} as overlapping logos, pulling
 * every child but the first back over its predecessor and ringing each
 * {@link Logo} child so the overlap reads as stacked cutouts.
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
 * the same way a grouped logo is and fixed to the same soft square shape.
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
