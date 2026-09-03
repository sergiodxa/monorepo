/**
 * A person's or entity's picture rendered as a fixed-size, fully circular
 * host stacking an image layer, an initials fallback, and an optional corner
 * status badge, plus a way to overlap several instances into one group with
 * a trailing overflow count. The circular shape stays fixed, since a profile
 * picture always renders fully rounded.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { ImagePlaceholder } from "./image-placeholder.js";

/**
 * Prop types for {@link Avatar} and its compound parts. Each part aliases
 * {@link ImagePlaceholder}'s matching part, since {@link Avatar} renders
 * straight through to it with the shape fixed to a full circle.
 */
export namespace Avatar {
	/**
	 * Size variant controlling the host's rendered dimensions and, through
	 * ordinary inheritance, the fallback initials' font size. Re-exports
	 * {@link ImagePlaceholder.Size}.
	 */
	export type Size = ImagePlaceholder.Size;

	/**
	 * Props accepted by {@link Avatar}: every prop {@link ImagePlaceholder.Props}
	 * accepts except `shape`, which stays fixed to a full circle.
	 */
	export interface Props extends Omit<ImagePlaceholder.Props, "shape"> {}

	/**
	 * Props accepted by {@link Avatar.Image}, unchanged from
	 * {@link ImagePlaceholder.ImageProps}.
	 */
	export interface ImageProps extends ImagePlaceholder.ImageProps {}

	/**
	 * Props accepted by {@link Avatar.Fallback}, unchanged from
	 * {@link ImagePlaceholder.FallbackProps}.
	 */
	export interface FallbackProps extends ImagePlaceholder.FallbackProps {}

	/**
	 * Props accepted by {@link Avatar.Badge}, unchanged from
	 * {@link ImagePlaceholder.BadgeProps}.
	 */
	export interface BadgeProps extends ImagePlaceholder.BadgeProps {}

	/**
	 * Props accepted by {@link Avatar.Group}, unchanged from
	 * {@link ImagePlaceholder.GroupProps}.
	 */
	export interface GroupProps extends ImagePlaceholder.GroupProps {}

	/**
	 * Props accepted by {@link Avatar.Group.Count}: every prop
	 * {@link ImagePlaceholder.GroupCountProps} accepts except `shape`, which
	 * stays fixed to the same full circle the avatars it trails render with.
	 */
	export interface GroupCountProps extends Omit<ImagePlaceholder.GroupCountProps, "shape"> {}
}

/**
 * Renders a fixed-size, fully circular picture host sized through the
 * `data-size` attribute contract (`"sm"`, `"md"`, or `"lg"`), stacking
 * whichever image, fallback, and badge parts a consumer composes as children.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the picture host's markup.
 * @example
 * <Avatar>
 * 	<Avatar.Image src={user.avatarUrl} alt={user.name} />
 * 	<Avatar.Fallback>{initials}</Avatar.Fallback>
 * </Avatar>
 * @example
 * <Avatar size="lg">
 * 	<Avatar.Image src={user.avatarUrl} alt={user.name} />
 * 	<Avatar.Fallback>{initials}</Avatar.Fallback>
 * 	<Avatar.Badge aria-label={t("status.online")} />
 * </Avatar>
 */
export function Avatar(handle: Handle<Avatar.Props>) {
	return () => <ImagePlaceholder {...handle.props} shape="circle" />;
}

/**
 * Renders the avatar's image layer: an absolutely positioned `<img>` filling
 * the host edge to edge, cropped with `object-fit: cover` and clipped to
 * {@link Avatar}'s circular shape. Stacking order decides which layer shows.
 *
 * @param handle Runtime handle carrying the host `<img>`'s props.
 * @returns The render function producing the image layer's markup.
 * @example
 * <Avatar.Image src={user.avatarUrl} alt={user.name} />
 */
Avatar.Image = ImagePlaceholder.Image;

/**
 * Renders the avatar's fallback layer: an absolutely positioned `<span>`
 * centering its content (typically initials) in uppercase, medium-weight
 * text whose size inherits from the host, staying in proportion at any size.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the fallback layer's markup.
 * @example
 * <Avatar.Fallback>{initials}</Avatar.Fallback>
 */
Avatar.Fallback = ImagePlaceholder.Fallback;

/**
 * Renders a small status dot pinned to the host's block-end/inline-end
 * corner: always fully rounded and ringed with a border matching the
 * surrounding background, so it reads as cut out from what sits beneath it.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the badge's markup.
 * @example
 * <Avatar.Badge aria-label={t("status.online")} />
 */
Avatar.Badge = ImagePlaceholder.Badge;

/**
 * Renders {@link Avatar.GroupProps.children} as a row of overlapping
 * avatars, pulling every child but the first back over its predecessor and
 * ringing it, so the overlap reads as stacked cutouts.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the group's markup.
 * @example
 * <Avatar.Group>
 * 	<Avatar>…</Avatar>
 * 	<Avatar>…</Avatar>
 * 	<Avatar.Group.Count>+3</Avatar.Group.Count>
 * </Avatar.Group>
 */
function AvatarGroup(handle: Handle<Avatar.GroupProps>) {
	return () => <ImagePlaceholder.Group {...handle.props} />;
}

/**
 * Renders the "+N" overflow indicator that trails {@link Avatar.Group}: a
 * fixed medium-size box matching {@link Avatar}'s default dimensions, ringed
 * the same way a grouped avatar is and fixed to the same full circle.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the overflow indicator's markup.
 * @example
 * <Avatar.Group.Count>+3</Avatar.Group.Count>
 */
function AvatarGroupCount(handle: Handle<Avatar.GroupCountProps>) {
	return () => <ImagePlaceholder.GroupCount {...handle.props} shape="circle" />;
}

AvatarGroup.Count = AvatarGroupCount;
Avatar.Group = AvatarGroup;
