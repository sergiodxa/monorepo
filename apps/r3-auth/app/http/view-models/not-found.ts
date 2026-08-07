/**
 * View model for the 404 page, normalizing the title and description the fallback
 * document renders so the view never has to reason about a missing translation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export namespace NotFoundViewModel {
	/** What the handler knows about the page it is rendering. */
	export interface DefaultInput {
		title?: string;
		description?: string;
	}

	/** What the view renders. */
	export interface DefaultOutput {
		title: string;
		description: string;
	}
}

export default class NotFoundViewModel {
	/**
	 * Fills in the copy the 404 page shows.
	 *
	 * Falls back to English literals when a string is missing, because a 404 rendering
	 * an empty heading would be a worse answer than an untranslated one.
	 */
	static default(input: NotFoundViewModel.DefaultInput): NotFoundViewModel.DefaultOutput {
		return {
			title: input.title || "Not Found",
			description: input.description || "The page you are looking for does not exist.",
		};
	}
}
