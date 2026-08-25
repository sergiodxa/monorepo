/**
 * View model for the 404 page. Holds the render-ready `Page` contract (title,
 * description, emoji) and the `page` factory controllers call to build it, so
 * not-found template data comes from one canonical mapper.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Contracts for not-found page data exchanged between controllers and
 * templates.
 */
export namespace NotFoundViewModel {
	/**
	 * Render-ready 404 page content consumed by the server-rendered template.
	 */
	export interface Page {
		/** Primary heading, used for both the document title and the hero text. */
		title: string;
		description: string;
		emoji: string;
	}

	/**
	 * Caller-provided values used to construct a `Page`. It matches `Page` field
	 * for field, keeping the transformation boundary explicit at call sites.
	 */
	export interface Input {
		title: string;
		description: string;
		emoji: string;
	}
}

/**
 * Factory for 404 page view data, giving controllers one place to build the
 * template payload.
 */
export class NotFoundViewModel {
	/**
	 * Copies every field verbatim, so callers own the exact copy rendered on the
	 * page.
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
