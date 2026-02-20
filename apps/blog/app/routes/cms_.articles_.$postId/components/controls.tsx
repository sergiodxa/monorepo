import { useValue } from "@pkg/hooks";
import { Card, Description, Input, Label, TextArea, TextField } from "@pkg/ui";
import { parameterize } from "inflected";
import { useHydrated } from "remix-utils/use-hydrated";

interface ControlsProps {
	article: {
		id: string | null;
		title: string;
		slug: string | null;
		excerpt?: string;
	};
}

export function Controls({ article }: ControlsProps) {
	let isHydrated = useHydrated();

	let [title, setTitle] = useValue(
		article.id ? Symbol.for(`article:${article.id}:title`) : Symbol.for("article:new:title"),
		article.title,
	);

	let slug = article.slug || parameterize(title);

	return (
		<Card className="h-fit max-w-sm">
			<Card.Header>
				<Card.Title>Write an Article</Card.Title>
			</Card.Header>
			<Card.Content className="flex flex-col gap-4">
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

				<TextField name="excerpt" maxLength={140} defaultValue={article.excerpt}>
					<Label>Excerpt</Label>
					<TextArea className="resize-none" />
				</TextField>
			</Card.Content>
		</Card>
	);
}
