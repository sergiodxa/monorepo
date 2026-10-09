/**
 * Resolves the live preview a component page opens with, and the live examples under it.
 * A preview lives in its own module under `previews/` and an example under
 * `previews/<component>/`, which keeps each hydrated one in its own client chunk; the older
 * shared map answers for the components whose preview has not been moved yet.
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

/**
 * An example beyond the opening preview. `title` names it on the page, so several examples
 * stay distinguishable, and the examples read in the order of their file names.
 */
export interface ExampleModule extends PreviewModule {
	title: string;
}

/** One live example of a component, as its page lists it. */
export interface PreviewExample extends ComponentPreview {
	/** The file name, which is the example's segment in its frame's URL. */
	slug: string;
	title: string;
}

const modules = import.meta.glob<PreviewModule>("./previews/*.tsx", {
	eager: true,
	import: "default",
});

/** The slug a preview module answers to, which is its filename. */
function slugOf(path: string): string {
	return path.replace(/^.*\/(.*)\.tsx$/, "$1");
}

const exampleModules = import.meta.glob<ExampleModule>("./previews/*/*.tsx", {
	eager: true,
	import: "default",
});

/** Every component's examples, keyed by the component's slug and sorted by file name. */
const examples = new Map<string, PreviewExample[]>();

for (let [path, example] of Object.entries(exampleModules).sort(([a], [b]) => a.localeCompare(b))) {
	let [, component, slug] = /\/previews\/([^/]+)\/([^/]+)\.tsx$/.exec(path) ?? [];
	if (!component || !slug) continue;
	let list = examples.get(component) ?? [];
	list.push({
		slug,
		title: example.title,
		code: example.code,
		render: example.render,
		flush: example.flush,
	});
	examples.set(component, list);
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

/**
 * A component's live examples, in the order its page shows them. An empty list means the
 * page shows the component's documented examples as source instead.
 */
export function listExamples(component: string): PreviewExample[] {
	return examples.get(component) ?? [];
}

/** One live example, or `null` when the component has no example by that slug. */
export function findExample(component: string, slug: string): PreviewExample | null {
	return listExamples(component).find((example) => example.slug === slug) ?? null;
}

/** Every component that has live examples, which is what the coverage test walks. */
export function exampleComponents(): string[] {
	return [...examples.keys()].sort();
}
