import { parseDate, today } from "@internationalized/date";
import { useValue } from "@pkg/hooks";
import {
	Calendar,
	Card,
	DateField,
	DatePicker,
	Description,
	FieldError,
	Input,
	Label,
	Popover,
	TextArea,
	TextField,
} from "@pkg/ui";
import { parameterize } from "inflected";
import { Dialog } from "react-aria-components";
import { useHydrated } from "remix-utils/use-hydrated";

interface ControlsProps {
	article: {
		id: string | null;
		title: string;
		slug: string | null;
		excerpt?: string;
		publishedAt?: string | null;
		isPublished: boolean;
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

				<DatePicker
					name="publishedAt"
					defaultValue={article.isPublished ? undefined : article.publishedAt ? parseDate(article.publishedAt) : undefined}
					minValue={today("UTC")}
				>
					<Label>Publish Date</Label>
					<DatePicker.Group>
						<DateField.Input>
							{(segment) => <DateField.Segment segment={segment} />}
						</DateField.Input>
						<DatePicker.Button />
					</DatePicker.Group>
					<FieldError />
					<Description>
						{article.isPublished
							? "This article is already published. Leave it empty to keep it published immediately, or pick a new date to reschedule."
							: "Leave empty to publish immediately. Publishes at 5pm UTC / 10am PT on the selected date."}
					</Description>
					<Popover>
						<Dialog>
							<Calendar>
								<Calendar.Header>
									<Calendar.PreviousButton />
									<Calendar.Heading />
									<Calendar.NextButton />
								</Calendar.Header>
								<Calendar.Grid>
									<Calendar.GridHeader>
										{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
									</Calendar.GridHeader>
									<Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
								</Calendar.Grid>
							</Calendar>
						</Dialog>
					</Popover>
				</DatePicker>
			</Card.Content>
		</Card>
	);
}
