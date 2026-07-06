/**
 * View model for the r3-uptime not-found page. It defines the input and output shapes
 * for the 404 view and exposes a `default` factory that normalizes an optional title
 * into a concrete one, falling back to "Not Found". It exists to keep 404 presentation
 * data preparation out of the controller and view.
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
