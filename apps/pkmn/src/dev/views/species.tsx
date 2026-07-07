/**
 * Species tool view — placeholder for the species-content editor. Establishes
 * the tool-view shape (a component taking a `Handle`) so the real content-authoring
 * form can slot in during its own phase without changing how the client mounts it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

/**
 * Placeholder species editor. Renders a stub message until the content-authoring
 * surface is implemented in a later phase.
 *
 * @param _handle Component handle (no props for this placeholder).
 * @returns The render function for the species tool view.
 */
export function SpeciesTool(_handle: Handle<Record<string, never>>) {
	return () => (
		<section mix={css({ display: "grid", gap: "0.5rem" })}>
			<h2 mix={css({ margin: 0, fontSize: "1.25rem" })}>Species</h2>
			<p mix={css({ margin: 0, color: "#9ca3af" })}>
				Species-content editor coming in a later phase.
			</p>
		</section>
	);
}
