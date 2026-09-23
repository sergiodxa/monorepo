/**
 * Resolves the live preview a component page opens with. A preview lives in its own module
 * under `previews/`, which is what lets several of them be written at once and what keeps
 * each hydrated one in its own client chunk; the older shared map is consulted for the
 * components that have not been moved yet, so a slug is answered by whichever of the two
 * holds it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ComponentPreview } from "~/resources/components/ui-previews.server";

import { COMPONENT_PREVIEWS } from "~/resources/components/ui-previews.server";

/**
 * What a preview module publishes: the markup a reader copies, and the node to draw. A
 * module whose component needs script returns its island from `render`, so the page holds
 * the hydration boundary and the module holds the example.
 */
export interface PreviewModule {
	code: string;
	render: ComponentPreview["render"];
	flush?: boolean;
}

const modules = import.meta.glob<PreviewModule>("./previews/*.tsx", {
	eager: true,
	import: "default",
});

/** The slug a preview module answers to, which is its filename. */
function slugOf(path: string): string {
	return path.replace(/^.*\/(.*)\.tsx$/, "$1");
}

const owned = new Map<string, ComponentPreview>(
	Object.entries(modules).map(([path, preview]) => [
		slugOf(path),
		{ code: preview.code, render: preview.render, flush: preview.flush },
	]),
);

/**
 * The preview for one component, or `null` when neither source holds one. A component with
 * no preview shows its documented example as source instead, which is the honest fallback:
 * inventing a fixture would show the fixture rather than the component.
 */
export function findPreview(slug: string): ComponentPreview | null {
	return owned.get(slug) ?? COMPONENT_PREVIEWS[slug] ?? null;
}

/** Every slug that has a preview, from either source. */
export function previewSlugs(): string[] {
	return [...new Set([...owned.keys(), ...Object.keys(COMPONENT_PREVIEWS)])].sort();
}
