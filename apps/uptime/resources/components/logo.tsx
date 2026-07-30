/**
 * Client island: a rounded-square ("squircle") team/brand logo. Renders `src` if
 * given, falling back to the name's initials (its first two characters) when
 * there's no image or the image fails to load at runtime (a real `error` listener
 * via the `on` mixin, not a raw `onerror` HTML string — that's not a typed `<img>`
 * prop here). Per the approved-islands list.
 *
 * Composes `@pkg/r3-ui`'s compound `Logo` internally — the same shared
 * image-with-fallback foundation {@link Avatar} composes, fixed to a soft
 * square instead of a full circle, which already matches this component's
 * "squircle" shape. Its fallback keeps the app's original primary-tinted brand
 * color (routed through `--ui-primary-bg-tint`/`--ui-primary-fg` instead of the
 * hardcoded `oklch(...)` literals this file used to carry, which also means it
 * now follows dark mode like every other component here, unlike the original's
 * fixed light-mode-only tint) rather than `@pkg/r3-ui`'s own neutral default.
 * Its `size` prop is a `"sm"/"md"/"lg"` variant rather than this component's
 * arbitrary pixel `size`, so the host's dimensions and the fallback's inherited
 * font size are overridden directly through `mix` instead, keeping this
 * component's numeric `size` API exact for every value callers already pass.
 *
 * Unlike {@link Avatar} (which hides a broken image with a direct style
 * mutation), this component keeps its original approach of tracking whether to
 * render the `<img>` at all in a local `displayImage` variable, re-rendering
 * through `handle.update()` once it fails to load so the element leaves the
 * tree entirely instead of merely being hidden.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { Logo as UILogo } from "@pkg/r3-ui";
import { bg, fg } from "@pkg/u/color";
import { bs, is } from "@pkg/u/size";
import { fontSize } from "@pkg/u/typography";
import { clientEntry, on } from "remix/ui";

/** Props must be a `type` (not `interface`) to satisfy `SerializableProps`. */
type LogoProps = { src: string | null; name: string; size?: number };

/** The name's first two characters, uppercased. */
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
