/**
 * View model for the glossary index route. Normalizes glossary repository rows into
 * the render-ready `Page` shape and sorts entries alphabetically by term, degrading a
 * missing `id` to the entry slug. It exists to keep glossary controllers thin by
 * centralizing template-facing mapping and deterministic ordering.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { GlossaryPost as GlossaryPostRepository } from "~/app/repositories/posts/glossary";

/**
 * Type contracts consumed by the glossary route renderer.
 *
 * These shapes define the normalized payload expected by templates.
 */
export namespace GlossaryViewModel {
	/**
	 * One normalized glossary record rendered by the page.
	 */
	export interface Entry {
		/**
		 * Stable list key for rendering.
		 *
		 * Falls back to `slug` when a repository row does not expose `id`.
		 */
		id: string;
		/**
		 * URL-safe identifier used in links and anchors.
		 */
		slug: string;
		/**
		 * Canonical term used for alphabetical ordering in the view.
		 */
		term: string;
		/**
		 * Optional long-form heading when different from `term`.
		 */
		title?: string;
		/**
		 * Human-readable definition shown in the glossary body.
		 */
		definition: string;
	}

	/**
	 * Full payload required to render the glossary index page.
	 */
	export interface Page {
		/**
		 * Glossary entries already normalized and sorted for display.
		 */
		entries: Array<Entry>;
	}
}

/**
 * Maps glossary repository rows into the route-facing view model.
 */
export class GlossaryViewModel {
	/**
	 * Normalizes records and sorts them by `meta.term` for deterministic output.
	 *
	 * The input array is never mutated; missing `id` values degrade to `meta.slug`.
	 *
	 * @param entries Repository records returned by `GlossaryPostRepository.findAll`.
	 * @returns Page payload ready for direct template consumption.
	 */
	static index(
		entries: Array<Awaited<ReturnType<typeof GlossaryPostRepository.findAll>>[number]>,
	): GlossaryViewModel.Page {
		let list = [...entries]
			.sort((a, b) => a.meta.term.localeCompare(b.meta.term))
			.map((entry) => {
				let record = entry as { id?: string };
				let id = record.id ?? entry.meta.slug;

				return {
					id,
					slug: entry.meta.slug,
					term: entry.meta.term,
					title: entry.meta.title,
					definition: entry.meta.definition,
				};
			});

		return { entries: list };
	}
}
