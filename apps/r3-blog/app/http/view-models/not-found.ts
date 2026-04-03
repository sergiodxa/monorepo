/**
 * Contracts for not-found page data exchanged between controllers and templates.
 *
 * Keeping these types grouped clarifies the public shape used by `NotFoundViewModel`.
 */
export namespace NotFoundViewModel {
	/**
	 * Render-ready 404 page content consumed by the server-rendered template.
	 */
	export interface Page {
		/** Primary heading shown in the not-found page `<title>` and/or hero text. */
		title: string;
		/** Short supporting copy explaining the missing resource state. */
		description: string;
		/** Decorative or expressive glyph used as the page visual accent. */
		emoji: string;
	}

	/**
	 * Caller-provided values used to construct a `Page` object.
	 *
	 * This currently mirrors `Page` to keep call sites explicit about transformation boundaries.
	 */
	export interface Input {
		/** Desired page title for the missing-resource response. */
		title: string;
		/** Human-readable explanation displayed under the title. */
		description: string;
		/** Emoji rendered as part of the page mood and emphasis. */
		emoji: string;
	}
}

/**
 * Factory for 404 page view data.
 *
 * The class centralizes mapping rules so controllers do not construct template models ad hoc.
 */
export class NotFoundViewModel {
	/**
	 * Maps caller input into the canonical not-found page contract.
	 *
	 * The method performs a direct field copy and intentionally does not mutate or normalize values.
	 *
	 * @param input Values to display on the not-found page.
	 * @returns Render-ready page payload for the 404 template.
	 *
	 * @example NotFoundViewModel.page({ title: "Not found", description: "Try another URL.", emoji: "🔎" })
	 */
	static page(input: NotFoundViewModel.Input): NotFoundViewModel.Page {
		return {
			title: input.title,
			description: input.description,
			emoji: input.emoji,
		};
	}
}
