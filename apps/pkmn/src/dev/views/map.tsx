/**
 * Map tool view — placeholder for the tile-map editor. Establishes the tool-view
 * shape (a component taking a `Handle`) so the real map-composition surface can
 * slot in during its own phase without changing how the client mounts it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

/**
 * Placeholder map editor. Renders a stub message until the tile-map surface is
 * implemented in a later phase.
 *
 * @param _handle Component handle (no props for this placeholder).
 * @returns The render function for the map tool view.
 */
export function MapTool(_handle: Handle<Record<string, never>>) {
	return () => (
		<section mix={css({ display: "grid", gap: "0.5rem" })}>
			<h2 mix={css({ margin: 0, fontSize: "1.25rem" })}>Map</h2>
			<p mix={css({ margin: 0, color: "#9ca3af" })}>Tile-map editor coming in a later phase.</p>
		</section>
	);
}
