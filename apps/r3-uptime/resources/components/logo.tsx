/**
 * Client island: a rounded-square ("squircle") team/brand logo. Renders `src` if
 * given, falling back to the name's initials (its first two characters) when
 * there's no image or the image fails to load at runtime (a real `error` listener
 * via the `on` mixin, not a raw `onerror` HTML string — that's not a typed `<img>`
 * prop here). Per the approved-islands list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { clientEntry, css, on } from "remix/ui";

/** Props must be a `type` (not `interface`) to satisfy `SerializableProps`. */
type LogoProps = { src: string | null; name: string; size?: number };

const primary100 = "oklch(0.92 0.08 142)";
const primary600 = "oklch(0.6 0.16 142)";

/** The name's first two characters, uppercased. */
function getInitials(name: string): string {
	return name.slice(0, 2).toUpperCase() || "?";
}

export const Logo = clientEntry(
	"/resources/components/logo.tsx#Logo",
	function Logo(handle: Handle<LogoProps>) {
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
								borderRadius: 6,
								background: primary100,
								color: primary600,
								fontSize: `${Math.round(size * 0.42)}px`,
								fontWeight: 700,
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
								css({ position: "absolute", inset: 0, borderRadius: 6, objectFit: "cover" }),
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

export default Logo;
