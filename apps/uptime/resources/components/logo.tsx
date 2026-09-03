/**
 * Client island: a rounded-square ("squircle") team/brand logo. Renders
 * `src` when given, falling back to the name's initials when there's no
 * image or it fails to load, detected through a typed `error` listener via
 * the `on` mixin. Per the approved-islands list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { bg, fg } from "@sdxc/u/color";
import { bs, is } from "@sdxc/u/size";
import { fontSize } from "@sdxc/u/typography";
import { Logo as UILogo } from "@sdxc/ui";
import { clientEntry, on } from "remix/ui";

/** Props must be a `type` (not `interface`) to satisfy `SerializableProps`. */
type LogoProps = { src: string | null; name: string; size?: number };

function getInitials(name: string): string {
	return name.slice(0, 2).toUpperCase() || "?";
}

/** Renders `src` if given, falling back to {@link getInitials} when there's no image or it fails to load. */
export const Logo = clientEntry(
	"/resources/components/logo.tsx#Logo",
	function Logo(handle: Handle<LogoProps>) {
		let displayImage = true;

		return () => {
			let { src, name, size = 24 } = handle.props;
			let initials = getInitials(name);

			return (
				<UILogo mix={[is(`${size}px`), bs(`${size}px`), fontSize(`${Math.round(size * 0.42)}px`)]}>
					<UILogo.Fallback mix={[bg("brand.tint"), fg("brand")]}>{initials}</UILogo.Fallback>
					{src && displayImage && (
						<UILogo.Image
							src={src}
							alt={name}
							width={size}
							height={size}
							mix={[
								on<HTMLImageElement>("error", () => {
									displayImage = false;
									void handle.update();
								}),
							]}
						/>
					)}
				</UILogo>
			);
		};
	},
);

export default Logo;
