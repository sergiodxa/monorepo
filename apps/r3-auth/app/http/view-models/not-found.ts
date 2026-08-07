/**
 * View model for the 404 page, normalizing the title the fallback document renders.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export namespace NotFoundViewModel {
	export interface DefaultInput {
		title?: string;
	}

	export interface DefaultOutput {
		title: string;
	}
}

export default class NotFoundViewModel {
	static default(input: NotFoundViewModel.DefaultInput): NotFoundViewModel.DefaultOutput {
		return { title: input.title || "Not Found" };
	}
}
