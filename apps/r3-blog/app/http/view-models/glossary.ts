import { GlossaryPost as GlossaryPostRepository } from "~/app/repositories/posts/glossary";

export namespace GlossaryViewModel {
	export interface Entry {
		id: string;
		slug: string;
		term: string;
		title?: string;
		definition: string;
	}

	export interface Page {
		entries: Array<Entry>;
	}
}

export class GlossaryViewModel {
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
