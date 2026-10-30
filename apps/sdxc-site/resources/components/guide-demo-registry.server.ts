/**
 * Resolves the live demos guides frame. Each lives in `guide-demos/<guide>/<demo>.tsx`, named
 * by the guide's own slug, and draws the markup of the snippet the guide prints beside it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

/**
 * What a guide demo module publishes. The guide prints the source, so a demo carries only
 * the node to draw, whether it meets its frame's edges, and whether it is page-wide.
 */
export interface GuideDemo {
	render: () => RemixNode;
	flush?: boolean;
	viewports?: boolean;
}

const modules = import.meta.glob<GuideDemo>("./guide-demos/*/*.tsx", {
	eager: true,
	import: "default",
});

/** Every demo keyed by `<guide>/<demo>`, the two segments its frame's URL carries. */
const DEMOS = new Map<string, GuideDemo>(
	Object.entries(modules).flatMap(([path, demo]) => {
		let [, guide, slug] = /\/guide-demos\/([^/]+)\/([^/]+)\.tsx$/.exec(path) ?? [];
		return guide && slug ? [[`${guide}/${slug}`, demo] as const] : [];
	}),
);

/** One guide's demo, or `null` when the guide frames no demo by that name. */
export function findGuideDemo(guide: string, demo: string): GuideDemo | null {
	return DEMOS.get(`${guide}/${demo}`) ?? null;
}

/** Every demo's `<guide>/<demo>` key, which is what the destination test walks. */
export function guideDemoKeys(): string[] {
	return [...DEMOS.keys()].sort();
}
