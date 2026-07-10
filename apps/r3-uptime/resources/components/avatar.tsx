/**
 * Client island: a circular user avatar. Renders `src` if given, falling back to
 * the name's initials (first letter of up to two words) when there's no image or
 * the image fails to load at runtime (a real `error` listener via the `on` mixin,
 * not a raw `onerror` HTML string — that's not a typed `<img>` prop here). Per the
 * approved-islands list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { clientEntry, css, on } from "remix/ui";

/** Props must be a `type` (not `interface`) to satisfy `SerializableProps`. */
type AvatarProps = { src: string | null; name: string; size?: number };

const neutral = {
	50: "oklch(0.98 0.005 145)",
	200: "oklch(0.91 0.008 145)",
	800: "oklch(0.32 0.006 145)",
	900: "oklch(0.24 0.005 145)",
};

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

export const Avatar = clientEntry(
	"/resources/components/avatar.tsx#Avatar",
	function Avatar(handle: Handle<AvatarProps>) {
		return () => {
			let { src, name, size = 24 } = handle.props;
			let initials = getInitials(name);

			return (
				<span
					mix={[
						css({
							position: "relative",
							display: "inline-flex",
							width: size,
							height: size,
							flexShrink: 0,
						}),
					]}
				>
					<span
						mix={[
							css({
								position: "absolute",
								inset: 0,
								display: "inline-flex",
								alignItems: "center",
								justifyContent: "center",
								borderRadius: 999,
								background: neutral[200],
								color: neutral[900],
								fontSize: `${Math.round(size * 0.42)}px`,
								fontWeight: 700,
								"@media (prefers-color-scheme: dark)": {
									background: neutral[800],
									color: neutral[50],
								},
							}),
						]}
					>
						{initials}
					</span>
					{src && (
						<img
							src={src}
							alt={name}
							width={size}
							height={size}
							mix={[
								css({ position: "absolute", inset: 0, borderRadius: 999, objectFit: "cover" }),
								on<HTMLImageElement>("error", (event) => {
									let img = event.currentTarget as HTMLImageElement;
									img.style.display = "none";
								}),
							]}
						/>
					)}
				</span>
			);
		};
	},
);

export default Avatar;
