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
