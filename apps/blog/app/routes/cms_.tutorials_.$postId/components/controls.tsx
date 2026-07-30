/**
 * Controls sidebar for the tutorial CMS editor, rendering the metadata form
 * fields (title, auto-generated slug, tags, excerpt, and publish date) inside a
 * Card. It derives the slug from the title via slugify and drives publish
 * scheduling with a DatePicker so authors can set or reschedule when a tutorial
 * goes live.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parseDate, today } from "@internationalized/date";
import { useValue } from "@pkg/hooks";
import { slugify } from "@pkg/strings";
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
import { Dialog } from "react-aria-components";
import { useHydrated } from "remix-utils/use-hydrated";

interface ControlsProps {
	tutorial: {
		id: string | null;
		title: string;
		slug: string | null;
		excerpt?: string;
		tags: string[];
		publishedAt: string | null;
		isPublished: boolean;
	};
}

export function Controls({ tutorial }: ControlsProps) {
	let isHydrated = useHydrated();

	let [title, setTitle] = useValue(
		tutorial.id ? Symbol.for(`tutorial:${tutorial.id}:title`) : Symbol.for("tutorial:new:title"),
		tutorial.title,
	);

	let slug = tutorial.slug || slugify(title);

	return (
		<Card className="h-fit max-w-sm">
			<Card.Header>
				<Card.Title>Write a Tutorial</Card.Title>
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

				<DatePicker
					name="publishedAt"
					defaultValue={
						tutorial.isPublished
							? undefined
							: tutorial.publishedAt
								? parseDate(tutorial.publishedAt)
								: undefined
					}
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
						{tutorial.isPublished
							? "This tutorial is already published. Leave it empty to keep it published immediately, or pick a new date to reschedule."
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
