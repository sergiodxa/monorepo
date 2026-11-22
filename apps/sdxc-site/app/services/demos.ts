/**
 * Which kind of demo a showcase slug names. Landings, docs sites and apps share one address,
 * `/showcase/:slug/demo`, so the slug alone decides which renderer answers it, and a slug is
 * unique across every kind.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { listDemoAppSlugs } from "~/resources/views/demo-apps";
import { listDemoDocsSlugs } from "~/resources/views/demo-docs";
import { listDemoSlugs } from "~/resources/views/demos";

/** The three shapes a demo comes in, each drawn by its own renderer. */
export type DemoKind = "landing" | "docs" | "app";

/**
 * The generic names the landing demos had before each took its product's name, so an old
 * address still reaches the same page.
 */
export const LEGACY_LANDING_SLUGS: Readonly<Record<string, string>> = {
	ai: "margin",
	app: "rooftree",
	bakery: "hollyhock",
	book: "the-measure",
	conference: "overprint",
	course: "centered",
	hardware: "strata-two",
	library: "plumb",
	newsletter: "undercurrent",
	saas: "keel",
	studio: "quoin",
};

/**
 * Every demo slug with its kind, read from the folder names alone so no demo module loads.
 *
 * @returns One entry per demo, landings first, then docs sites, then apps.
 */
export function listDemoKinds(): Array<{ slug: string; kind: DemoKind }> {
	return [
		...listDemoSlugs().map((slug) => ({ slug, kind: "landing" as const })),
		...listDemoDocsSlugs().map((slug) => ({ slug, kind: "docs" as const })),
		...listDemoAppSlugs().map((slug) => ({ slug, kind: "app" as const })),
	];
}

/**
 * The kind of demo a slug names.
 *
 * @param slug The `:slug` a showcase address carries.
 * @returns Its kind, or `null` for a slug with no demo, such as an application in production.
 */
export function findDemoKind(slug: string): DemoKind | null {
	return listDemoKinds().find((entry) => entry.slug === slug)?.kind ?? null;
}
