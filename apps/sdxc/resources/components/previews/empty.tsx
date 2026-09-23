/**
 * Live preview island for `Empty`. An empty state is worth showing against the thing that
 * produced it, so the preview is a real filter over a real list: type something no invoice
 * matches and the dashed panel takes over, naming the query it found nothing for and
 * offering the two ways out — widen the search, or create the thing that is missing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { FileTextIcon, SearchIcon } from "@sdxc/icons";
import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { Button, Empty, Group, Input, Item } from "@sdxc/ui";
import { clientEntry, on } from "remix/ui";

/** The invoices the filter runs over, so the empty state has something to be empty of. */
const INVOICES = [
	{ id: "INV-2041", client: "Northwind Traders", amount: "$4,200.00" },
	{ id: "INV-2042", client: "Contoso", amount: "$1,150.00" },
	{ id: "INV-2043", client: "Fabrikam", amount: "$780.00" },
];

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const EMPTY_CODE = `let query = "";
let matches = INVOICES.filter((invoice) =>
	\`\${invoice.id} \${invoice.client}\`.toLowerCase().includes(query.trim().toLowerCase()),
);

<Group>
	<Input
		name="q"
		type="search"
		value={query}
		placeholder="Search invoices"
		aria-label="Search invoices"
		mix={[
			on<HTMLInputElement, "input">("input", (event) => {
				query = event.currentTarget.value;
				void handle.update();
			}),
		]}
	/>
</Group>

{matches.length > 0 ? (
	matches.map((invoice) => (
		<Item key={invoice.id}>
			<Item.Media>
				<FileTextIcon aria-hidden="true" />
			</Item.Media>
			<Item.Content>
				<Item.Title>{invoice.id}</Item.Title>
				<Item.Description>{invoice.client}</Item.Description>
			</Item.Content>
			<Item.Actions>{invoice.amount}</Item.Actions>
		</Item>
	))
) : (
	<Empty>
		<Empty.Icon>
			<SearchIcon />
		</Empty.Icon>
		<Empty.Title>No invoices match “{query.trim()}”</Empty.Title>
		<Empty.Description>
			Search runs over the invoice number and the client's name. Nothing in this workspace
			matches either.
		</Empty.Description>
		<Empty.Action>
			<Button variant="outline" color="neutral" mix={[on("click", clearQuery)]}>
				Clear the search
			</Button>
			<Button>New invoice</Button>
		</Empty.Action>
	</Empty>
)}`;

/** A filtered invoice list, hydrated so the empty state is reached by typing. */
export const EmptyPreview = clientEntry(
	"/resources/components/previews/empty.tsx#EmptyPreview",
	function EmptyPreview(handle: Handle) {
		let query = "";

		/** Puts the list back, which is the way out the empty state's first action offers. */
		function clearQuery() {
			query = "";
			void handle.update();
		}

		return () => {
			let matches = INVOICES.filter((invoice) =>
				`${invoice.id} ${invoice.client}`.toLowerCase().includes(query.trim().toLowerCase()),
			);

			return (
				<div mix={[vstack({ gap: 3, align: "stretch" }), is("26rem")]}>
					<Group>
						<Input
							name="q"
							type="search"
							value={query}
							placeholder="Search invoices"
							aria-label="Search invoices"
							mix={[
								on<HTMLInputElement, "input">("input", (event) => {
									query = event.currentTarget.value;
									void handle.update();
								}),
							]}
						/>
					</Group>

					{matches.length > 0 ? (
						<div mix={[vstack({ gap: 2, align: "stretch" })]}>
							{matches.map((invoice) => (
								<Item key={invoice.id}>
									<Item.Media>
										<FileTextIcon aria-hidden="true" />
									</Item.Media>
									<Item.Content>
										<Item.Title>{invoice.id}</Item.Title>
										<Item.Description>{invoice.client}</Item.Description>
									</Item.Content>
									<Item.Actions>{invoice.amount}</Item.Actions>
								</Item>
							))}
						</div>
					) : (
						<Empty>
							<Empty.Icon>
								<SearchIcon />
							</Empty.Icon>
							<Empty.Title>No invoices match “{query.trim()}”</Empty.Title>
							<Empty.Description>
								Search runs over the invoice number and the client&rsquo;s name. Nothing in this
								workspace matches either.
							</Empty.Description>
							<Empty.Action>
								<Button
									variant="outline"
									color="neutral"
									mix={[on<HTMLButtonElement, "click">("click", clearQuery)]}
								>
									Clear the search
								</Button>
								<Button>New invoice</Button>
							</Empty.Action>
						</Empty>
					)}
				</div>
			);
		};
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: EMPTY_CODE, render: () => <EmptyPreview /> };
