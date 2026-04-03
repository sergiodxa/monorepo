import { parameterize } from "inflected";

import routes from "~/routes/web";

export namespace TutorialViewModel {
	export interface SourceIndexItem {
		id: string;
		title: string;
		slug: string;
		preview: boolean;
		tags?: string | Array<string>;
	}

	export interface SourceEditItem {
		id: string;
		title?: string;
		slug?: string;
		excerpt?: string;
		tags?: string | Array<string>;
		content?: string;
		published_at: string | null;
	}

	export interface SourceFormData {
		title: string;
		slug?: string;
		excerpt: string;
		tags?: string;
		content: string;
		published_at?: string;
	}

	export interface InputIndex {
		items: Array<SourceIndexItem>;
	}

	export interface InputNew {}

	export interface InputNotFound {
		id?: string;
	}

	export interface InputEdit {
		tutorial: SourceEditItem;
	}

	export interface InputForm {
		data: SourceFormData;
	}
}

export class TutorialViewModel {
	static index(input: TutorialViewModel.InputIndex) {
		return input.items.map((tutorial) => ({
			id: tutorial.id,
			title: tutorial.title,
			publicHref: routes.post.href({ postType: "tutorials", postSlug: tutorial.slug }),
			preview: tutorial.preview,
			tags: this.parseTags(tutorial.tags).join(", "),
			href: routes.cms.tutorials.edit.href({ id: tutorial.id }),
			deleteAction: routes.cms.tutorials.destroy.href({ id: tutorial.id }),
		}));
	}

	static new(_input: TutorialViewModel.InputNew) {
		return {
			title: "New Tutorial",
			description: "Write a new tutorial to share your knowledge with the world.",
			mode: "new" as const,
			action: routes.cms.tutorials.index.href(),
			submitLabel: "Create Tutorial",
			values: {
				title: "",
				slug: "",
				excerpt: "",
				tags: "",
				content: "",
				published_at: "",
			},
		};
	}

	static notFound(input: TutorialViewModel.InputNotFound) {
		return {
			title: "Tutorial Not Found",
			description: `Tutorial ${input.id} was not found.`,
			mode: "new" as const,
			action: routes.cms.tutorials.index.href(),
			submitLabel: "Create Tutorial",
			values: {
				title: "",
				slug: "",
				excerpt: "",
				tags: "",
				content: "",
				published_at: "",
			},
		};
	}

	static edit(input: TutorialViewModel.InputEdit) {
		let { tutorial } = input;

		return {
			title: `Edit Tutorial ${tutorial.title ?? ""}`,
			description: `Editing tutorial at ${routes.post.href({ postType: "tutorials", postSlug: tutorial.slug ?? "" })}.`,
			mode: "edit" as const,
			action: routes.cms.tutorials.update.href({ id: tutorial.id }),
			submitLabel: "Save Tutorial",
			deleteAction: routes.cms.tutorials.destroy.href({ id: tutorial.id }),
			values: {
				title: tutorial.title ?? "",
				slug: tutorial.slug ?? "",
				excerpt: tutorial.excerpt ?? "",
				tags: this.parseTags(tutorial.tags).join(", "),
				content: tutorial.content ?? "",
				published_at: this.toDateInputValue(tutorial.published_at),
			},
		};
	}

	static input(input: TutorialViewModel.InputForm) {
		let { data } = input;

		return {
			published_at: this.parsePublishedAt(data.published_at),
			meta: {
				title: data.title,
				slug: data.slug || parameterize(data.title),
				excerpt: data.excerpt,
				tags: this.parseTags(data.tags),
				content: data.content,
			},
		};
	}

	private static parsePublishedAt(value: string | undefined): string | null {
		if (!value) return null;
		if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
			let parsed = new Date(`${value}T00:00:00.000Z`);
			if (Number.isNaN(parsed.getTime())) return null;
			return parsed.toISOString();
		}
		let parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return null;
		return parsed.toISOString();
	}

	private static toDateInputValue(value: string | null): string {
		if (!value) return "";
		let parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return "";
		return parsed.toISOString().slice(0, 10);
	}

	private static parseTags(value: string | string[] | undefined) {
		if (!value) return [];
		if (Array.isArray(value)) {
			return value.map((tag) => tag.trim()).filter(Boolean);
		}
		return value
			.split(",")
			.map((tag) => tag.trim())
			.filter(Boolean);
	}
}
