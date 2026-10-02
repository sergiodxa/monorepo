/**
 * Live preview island for `SearchField`. It narrows the result list as you type,
 * which is what the field is for, and pairs the input with the field's own clear
 * button so a reader sees both halves of the control working together.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Empty, Item, Label, SearchField, Text } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

/** What the field searches, so the example narrows real rows rather than a placeholder. */
const PACKAGES = [
	{ name: "@sdxc/result", summary: "A Result type for fallible calls" },
	{ name: "@sdxc/dates", summary: "Plain date and time helpers" },
	{ name: "@sdxc/highlight", summary: "Server-side syntax highlighting" },
	{ name: "@sdxc/icons", summary: "Lucide icons as components" },
	{ name: "@sdxc/spec", summary: "Executable specifications" },
];

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const SEARCH_FIELD_CODE = `<div mix={[vstack({ gap: 3, align: "stretch" })]}>
	<SearchField>
		<Label htmlFor="preview-package-search">Search packages</Label>
		<SearchField.Control>
			<SearchField.Input
				id="preview-package-search"
				name="q"
				placeholder="result, dates, icons…"
				mix={[on<HTMLInputElement, "input">("input", readQuery)]}
			/>
			<SearchField.Clear commandfor="preview-package-search" aria-label="Clear the search" />
		</SearchField.Control>
	</SearchField>

	{matches.length === 0 ? (
		<Empty>
			<Empty.Title>No packages match</Empty.Title>
			<Empty.Description>Try a shorter term, or clear the field.</Empty.Description>
		</Empty>
	) : (
		<div mix={[vstack({ gap: 1, align: "stretch" })]}>
			{matches.map((entry) => (
				<Item key={entry.name}>
					<Item.Content>
						<Item.Title>{entry.name}</Item.Title>
						<Item.Description>{entry.summary}</Item.Description>
					</Item.Content>
				</Item>
			))}
		</div>
	)}

	<Text>
		{matches.length} of {packages.length} packages
	</Text>
</div>`;

/** A package search that narrows and clears, hydrated so both halves of that work. */
export const SearchFieldPreview = clientEntry(
	"/resources/components/previews/search-field.tsx#SearchFieldPreview",
	function SearchFieldPreview(handle: Handle) {
		let query = "";

		/** Re-renders the list against the live field value, including after a clear. */
		function readQuery(event: Event) {
			let target = event.target;
			if (!(target instanceof HTMLInputElement)) return;

			query = target.value.trim().toLowerCase();
			void handle.update();
		}

		return () => {
			let matches = PACKAGES.filter(
				(entry) =>
					entry.name.toLowerCase().includes(query) || entry.summary.toLowerCase().includes(query),
			);

			return (
				<div mix={[vstack({ gap: 3, align: "stretch" }), is("24rem")]}>
					<SearchField>
						<Label htmlFor="preview-package-search">Search packages</Label>
						<SearchField.Control>
							<SearchField.Input
								id="preview-package-search"
								name="q"
								placeholder="result, dates, icons…"
								mix={[on<HTMLInputElement, "input">("input", readQuery)]}
							/>
							<SearchField.Clear
								commandfor="preview-package-search"
								aria-label="Clear the search"
							/>
						</SearchField.Control>
					</SearchField>

					{matches.length === 0 ? (
						<Empty>
							<Empty.Title>No packages match</Empty.Title>
							<Empty.Description>Try a shorter term, or clear the field.</Empty.Description>
						</Empty>
					) : (
						<div mix={[vstack({ gap: 1, align: "stretch" }), text("sm")]}>
							{matches.map((entry) => (
								<Item key={entry.name}>
									<Item.Content>
										<Item.Title>{entry.name}</Item.Title>
										<Item.Description>{entry.summary}</Item.Description>
									</Item.Content>
								</Item>
							))}
						</div>
					)}

					<Text>
						{matches.length} of {PACKAGES.length} packages
					</Text>
				</div>
			);
		};
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: SEARCH_FIELD_CODE, render: () => <SearchFieldPreview /> };
