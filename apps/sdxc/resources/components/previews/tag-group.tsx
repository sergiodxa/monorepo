/**
 * Live preview island for `TagGroup`. A tag's remove control is a real form submit,
 * named and valued so the server knows which one to drop — so the example is the
 * applied-filters row above a job list, inside the form that owns it. The island
 * answers that submission in place, which is what makes the round trip visible on a
 * page with nowhere to post to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { Button, Label, TagGroup, Text } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

/** One applied filter, with the color its pill reads in. */
interface Filter {
	value: string;
	label: string;
	color: "brand" | "neutral" | "success" | "warning";
}

/** The filters the row starts with. */
const FILTERS: Filter[] = [
	{ value: "remote", label: "Remote", color: "brand" },
	{ value: "typescript", label: "TypeScript", color: "brand" },
	{ value: "senior", label: "Senior", color: "neutral" },
	{ value: "hiring", label: "Hiring now", color: "success" },
	{ value: "eu", label: "EU timezones", color: "warning" },
];

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const TAG_GROUP_CODE = `<form method="post" action="/jobs/filters">
	<TagGroup aria-labelledby="preview-filters-label">
		<Label id="preview-filters-label">Applied filters</Label>
		<TagGroup.List>
			{filters.map((filter) => (
				<TagGroup.Tag key={filter.value} color={filter.color}>
					{filter.label}
					<TagGroup.Remove
						name="remove"
						value={filter.value}
						aria-label={\`Remove the \${filter.label} filter\`}
					/>
				</TagGroup.Tag>
			))}
		</TagGroup.List>
	</TagGroup>
</form>`;

/** An applied-filters row, hydrated so each remove control has somewhere to land. */
export const TagGroupPreview = clientEntry(
	"/resources/components/previews/tag-group.tsx#TagGroupPreview",
	function TagGroupPreview(handle: Handle) {
		let filters = FILTERS;

		/** Drops whichever tag's remove control submitted, the way the server would. */
		function removeSubmitted(event: SubmitEvent) {
			event.preventDefault();

			let submitter = event.submitter;
			if (!(submitter instanceof HTMLButtonElement)) return;

			filters = filters.filter((filter) => filter.value !== submitter.value);
			void handle.update();
		}

		/** Puts every filter back, so a reader who cleared the row can look again. */
		function restore() {
			filters = FILTERS;
			void handle.update();
		}

		return () => (
			<form
				method="post"
				action="/jobs/filters"
				mix={[
					vstack({ gap: 3, align: "start" }),
					is("24rem"),
					on<HTMLFormElement, "submit">("submit", removeSubmitted),
				]}
			>
				<TagGroup aria-labelledby="preview-filters-label">
					<Label id="preview-filters-label">Applied filters</Label>
					<TagGroup.List>
						{filters.map((filter) => (
							<TagGroup.Tag key={filter.value} color={filter.color}>
								{filter.label}
								<TagGroup.Remove
									name="remove"
									value={filter.value}
									aria-label={`Remove the ${filter.label} filter`}
								/>
							</TagGroup.Tag>
						))}
					</TagGroup.List>
				</TagGroup>

				{filters.length === 0 ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						mix={[on<HTMLButtonElement, "click">("click", restore)]}
					>
						Restore every filter
					</Button>
				) : (
					<Text>
						{filters.length} of {FILTERS.length} filters applied
					</Text>
				)}
			</form>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: TAG_GROUP_CODE, render: () => <TagGroupPreview /> };
