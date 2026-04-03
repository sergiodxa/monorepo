export namespace NotFoundViewModel {
	export interface Page {
		title: string;
		description: string;
		emoji: string;
	}

	export interface Input {
		title: string;
		description: string;
		emoji: string;
	}
}

export class NotFoundViewModel {
	static page(input: NotFoundViewModel.Input): NotFoundViewModel.Page {
		return {
			title: input.title,
			description: input.description,
			emoji: input.emoji,
		};
	}
}
