/**
 * Client island per the approved-islands list: a circular user avatar,
 * composing `@sdxc/ui`'s compound `Avatar` for its fallback/image layering.
 *
 * `@sdxc/ui`'s own `size` prop only accepts `"sm"/"md"/"lg"` variants, so
 * host dimensions and the fallback's font size are set directly through
 * `mix`, keeping this component's numeric `size` exact for any pixel value
 * callers pass (24, 40, 48, …).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { is, bs } from "@sdxc/u/size";
import { fontSize } from "@sdxc/u/typography";
import { Avatar as UIAvatar } from "@sdxc/ui";
import { clientEntry, on } from "remix/ui";

/** Props are declared as a `type` alias to satisfy `SerializableProps`. */
type AvatarProps = { src: string | null; name: string; size?: number };

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
