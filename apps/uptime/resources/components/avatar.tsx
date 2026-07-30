/**
 * Client island: a circular user avatar. Renders `src` if given, falling back to
 * the name's initials (first letter of up to two words) when there's no image or
 * the image fails to load at runtime (a real `error` listener via the `on` mixin,
 * not a raw `onerror` HTML string — that's not a typed `<img>` prop here). Per the
 * approved-islands list.
 *
 * Composes `@pkg/r3-ui`'s compound `Avatar` internally: `Avatar.Fallback` renders
 * first (so it paints underneath), and `Avatar.Image` renders on top of it when
 * `src` is given, hiding itself on the same `error` listener the original markup
 * used to reveal the fallback beneath. `@pkg/r3-ui`'s own `size` prop is a
 * `"sm"/"md"/"lg"` variant rather than this component's arbitrary pixel `size`,
 * so the host's dimensions and the fallback's inherited font size are overridden
 * directly through `mix` instead, keeping this component's numeric `size` API
 * exact for every value callers already pass (24, 40, 48, …), not just the three
 * built-in buckets.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { Avatar as UIAvatar } from "@pkg/r3-ui";
import { is, bs } from "@pkg/u/size";
import { fontSize } from "@pkg/u/typography";
import { clientEntry, on } from "remix/ui";

/** Props must be a `type` (not `interface`) to satisfy `SerializableProps`. */
type AvatarProps = { src: string | null; name: string; size?: number };

/** First letter of up to the first two words of `name`, uppercased. */
function getInitials(name: string): string {
	let words = name.split(" ").filter(Boolean);
	if (words.length === 0) return "?";
	return words
		.slice(0, 2)
		.map((word) => word[0])
		.join("")
		.toUpperCase();
}

/** Renders `src` if given, falling back to {@link getInitials} when there's no image or it fails to load. */
export const Avatar = clientEntry(
	"/resources/components/avatar.tsx#Avatar",
	function Avatar(handle: Handle<AvatarProps>) {
		return () => {
			let { src, name, size = 24 } = handle.props;
			let initials = getInitials(name);

			return (
				<UIAvatar
					mix={[is(`${size}px`), bs(`${size}px`), fontSize(`${Math.round(size * 0.42)}px`)]}
				>
					<UIAvatar.Fallback>{initials}</UIAvatar.Fallback>
					{src && (
						<UIAvatar.Image
							src={src}
							alt={name}
							width={size}
							height={size}
							mix={[
								on<HTMLImageElement>("error", (event) => {
									let img = event.currentTarget as HTMLImageElement;
									img.style.display = "none";
								}),
							]}
						/>
					)}
				</UIAvatar>
			);
		};
	},
);

export default Avatar;
