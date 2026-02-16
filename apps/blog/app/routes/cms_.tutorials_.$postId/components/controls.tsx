import { Description, Heading, Input, Label, TextArea, TextField } from "@pkg/ui";
import { parameterize } from "inflected";
import { useHydrated } from "remix-utils/use-hydrated";

import { useValue } from "~/hooks/use-value";

interface ControlsProps {
	tutorial: {
		id: string | null;
		title: string;
		slug: string | null;
		excerpt?: string;
		tags: string[];
	};
}

export function Controls({ tutorial }: ControlsProps) {
	let isHydrated = useHydrated();

	let [title, setTitle] = useValue(
		tutorial.id ? Symbol.for(`tutorial:${tutorial.id}:title`) : Symbol.for("tutorial:new:title"),
		tutorial.title,
	);

	let slug = tutorial.slug || parameterize(title);

	return (
		<div className="flex max-w-sm grow flex-col items-stretch gap-4">
			<Heading className="text-2xl font-medium capitalize">Write a Tutorial</Heading>

			<TextField name="title" onChange={setTitle} value={title} maxLength={140}>
				<Label>Title</Label>
				<Input />
				<Description>
					A title should summarize the tip and explain what it is about clearly.
				</Description>
			</TextField>

			<TextField
				name="slug"
				onChange={setTitle}
				value={slug}
				maxLength={140}
				isReadOnly={isHydrated}
			>
				<Label>Slug</Label>
				<Input />
				<Description>Automatically generated based on the title.</Description>
			</TextField>

			<TextField name="tags" defaultValue={tutorial.tags?.join(" ")}>
				<Label>Tags</Label>
				<Input />
				<Description>
					A blank space separated list of tags to help suggest similar tutorials.
				</Description>
			</TextField>

			<TextField name="excerpt" maxLength={140} defaultValue={tutorial.excerpt}>
				<Label>Excerpt</Label>
				<TextArea className="resize-none" />
			</TextField>
		</div>
	);
}
