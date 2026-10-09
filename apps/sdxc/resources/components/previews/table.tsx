/**
 * Live preview island for `Table`. A two-column table shows none of what the
 * component does, so the example is a real invoice list: a scrolling container,
 * sort links on the headers with `aria-sort` on the active one, aligned numeric
 * columns, a status badge per row, and a trailing load-more link. Row selection has
 * no native state to ride, so the island keeps it in a `SelectionModel` and mirrors
 * the set onto each row's `aria-selected`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { hstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { Badge, Checkbox, Table, Text } from "@sdxc/ui";
import { SelectionModel } from "@sdxc/ui/behaviors";
import { clientEntry, on } from "remix/component";

import { readSort, sortHref, sortInvoices } from "~/app/services/invoice-sort";

/** One invoice, so every column carries a different kind of value. */
interface Invoice {
	id: string;
	customer: string;
	/** The issue date as a machine can order it, which is what the sort reads. */
	issued: string;
	/** The same date as the cell shows it. */
	issuedLabel: string;
	status: "paid" | "open" | "overdue";
	/** The amount in whole cents, so money orders by value rather than by its digits. */
	total: number;
	/** The same amount as the cell shows it. */
	totalLabel: string;
}

/** The page of invoices the table renders. */
const INVOICES: Invoice[] = [
	{
		id: "INV-2041",
		customer: "Northwind Traders",
		issued: "2026-09-12",
		issuedLabel: "12 Sep",
		status: "paid",
		total: 128000,
		totalLabel: "$1,280.00",
	},
	{
		id: "INV-2040",
		customer: "Acme Design",
		issued: "2026-09-11",
		issuedLabel: "11 Sep",
		status: "open",
		total: 48000,
		totalLabel: "$480.00",
	},
	{
		id: "INV-2039",
		customer: "Globex",
		issued: "2026-09-09",
		issuedLabel: "9 Sep",
		status: "overdue",
		total: 390000,
		totalLabel: "$3,900.00",
	},
	{
		id: "INV-2038",
		customer: "Initech",
		issued: "2026-09-04",
		issuedLabel: "4 Sep",
		status: "paid",
		total: 9600,
		totalLabel: "$96.00",
	},
	{
		id: "INV-2037",
		customer: "Hooli",
		issued: "2026-09-01",
		issuedLabel: "1 Sep",
		status: "paid",
		total: 74000,
		totalLabel: "$740.00",
	},
];

/** The badge color each status reads in. */
const STATUS_COLORS = { paid: "success", open: "warning", overdue: "danger" } as const;

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const TABLE_CODE = `let selection = new SelectionModel({ mode: "multiple", keys, selectedKeys: ["INV-2039"] });
selection.addEventListener("change", () => void handle.update());

// The headers link, so the order is whatever the query asks for. An app would serve
// the page back sorted; a page that is its own server writes the query and re-reads it.
let sort = readSort(globalThis.location?.search ?? "");

function sortFromHeader(event) {
	let link = event.target.closest('th[aria-sort] a');
	if (!link) return;

	event.preventDefault();
	globalThis.history.pushState(null, "", link.href);
	sort = readSort(globalThis.location.search);
	void handle.update();
}

// Only the active column carries a direction; the rest show the idle indicator.
let direction = (key) => (sort.key === key ? sort.direction : undefined);

<div mix={[on("click", sortFromHeader)]}>
	<Table.Container>
		<Table aria-label="Invoices">
			<Table.Header>
				<Table.Row>
					<Table.Column>
						<Checkbox
							aria-label="Select every invoice"
							checked={selection.isAll}
							mix={[on<HTMLInputElement, "change">("change", toggleAll)]}
						/>
					</Table.Column>
					<Table.Column href={sortHref("id", sort)} sortDirection={direction("id")}>
						Invoice
					</Table.Column>
					<Table.Column href={sortHref("customer", sort)} sortDirection={direction("customer")}>
						Customer
					</Table.Column>
					<Table.Column href={sortHref("issued", sort)} sortDirection={direction("issued")}>
						Issued
					</Table.Column>
					<Table.Column>Status</Table.Column>
					<Table.Column align="end" href={sortHref("total", sort)} sortDirection={direction("total")}>
						Total
					</Table.Column>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{sortInvoices(invoices, sort).map((invoice) => (
					<Table.Row
						key={invoice.id}
						aria-selected={selection.isSelected(invoice.id) ? "true" : undefined}
					>
						<Table.Cell>
							<Checkbox
								aria-label={\`Select \${invoice.id}\`}
								checked={selection.isSelected(invoice.id)}
								mix={[
									on<HTMLInputElement, "change">("change", () => selection.toggle(invoice.id)),
								]}
							/>
						</Table.Cell>
						<Table.Cell>{invoice.id}</Table.Cell>
						<Table.Cell>{invoice.customer}</Table.Cell>
						<Table.Cell>{invoice.issuedLabel}</Table.Cell>
						<Table.Cell>
							<Badge color={statusColors[invoice.status]} variant="secondary">
								{invoice.status}
							</Badge>
						</Table.Cell>
						<Table.Cell>{invoice.totalLabel}</Table.Cell>
					</Table.Row>
				))}
				<Table.LoadMore href="?page=2" colSpan={6}>
					Load the next 25 invoices
				</Table.LoadMore>
			</Table.Body>
		</Table>
	</Table.Container>
	<div mix={[hstack({ gap: 2, align: "center", justify: "end" })]}>
		<Text>
			{selection.size} of {invoices.length} selected
		</Text>
	</div>
</div>`;

/** A sortable, selectable invoice list, hydrated so the selection set drives the rows. */
export const TablePreview = clientEntry(import.meta.url, function TablePreview(handle: Handle) {
	let selection = new SelectionModel({
		mode: "multiple",
		keys: INVOICES.map((invoice) => invoice.id),
		selectedKeys: ["INV-2039"],
	});

	// `handle.signal` is an inert stub during the server render, so the
	// subscription is plain: it dies with the island that owns the model.
	selection.addEventListener("change", () => void handle.update());

	/*
	 * The headers link rather than listen, so which column is active is whatever the
	 * query asked for, exactly as it would be for a page an app served sorted.
	 */
	let sort = readSort(globalThis.location?.search ?? "");

	/** Re-reads the order from the URL, however the URL came to say something else. */
	function readUrl() {
		sort = readSort(globalThis.location.search);
		void handle.update();
	}

	// The window outlives the island, so the subscription is dropped when the
	// island disconnects rather than through an options signal, which is an
	// inert stub during the server render.
	globalThis.addEventListener("popstate", readUrl);
	handle.signal.addEventListener("abort", () =>
		globalThis.removeEventListener("popstate", readUrl),
	);

	/**
	 * Answers a header's own navigation: the page this preview lives on is a document
	 * rather than the table's server, so the island writes the query the header asked
	 * for and orders the rows from it.
	 */
	function sortFromHeader(event: MouseEvent) {
		let target = event.target as Element | null;
		let link = target?.closest<HTMLAnchorElement>("th[aria-sort] a");
		if (!link) return;

		event.preventDefault();
		globalThis.history.pushState(null, "", link.href);
		readUrl();
	}

	/** Selects every invoice, or clears the set once they all are. */
	function toggleAll() {
		if (selection.isAll) selection.clear();
		else selection.selectAll();
	}

	return () => (
		<div mix={[is("100%"), on<HTMLDivElement, "click">("click", sortFromHeader)]}>
			<Table.Container>
				<Table aria-label="Invoices">
					<Table.Header>
						<Table.Row>
							<Table.Column>
								<Checkbox
									aria-label="Select every invoice"
									checked={selection.isAll}
									mix={[on<HTMLInputElement, "change">("change", toggleAll)]}
								/>
							</Table.Column>
							<Table.Column
								href={sortHref("id", sort)}
								sortDirection={sort.key === "id" ? sort.direction : undefined}
							>
								Invoice
							</Table.Column>
							<Table.Column
								href={sortHref("customer", sort)}
								sortDirection={sort.key === "customer" ? sort.direction : undefined}
							>
								Customer
							</Table.Column>
							<Table.Column
								href={sortHref("issued", sort)}
								sortDirection={sort.key === "issued" ? sort.direction : undefined}
							>
								Issued
							</Table.Column>
							<Table.Column>Status</Table.Column>
							<Table.Column
								align="end"
								href={sortHref("total", sort)}
								sortDirection={sort.key === "total" ? sort.direction : undefined}
							>
								Total
							</Table.Column>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{sortInvoices(INVOICES, sort).map((invoice) => (
							<Table.Row
								key={invoice.id}
								aria-selected={selection.isSelected(invoice.id) ? "true" : undefined}
							>
								<Table.Cell>
									<Checkbox
										aria-label={`Select ${invoice.id}`}
										checked={selection.isSelected(invoice.id)}
										mix={[
											on<HTMLInputElement, "change">("change", () => selection.toggle(invoice.id)),
										]}
									/>
								</Table.Cell>
								<Table.Cell>{invoice.id}</Table.Cell>
								<Table.Cell>{invoice.customer}</Table.Cell>
								<Table.Cell>{invoice.issuedLabel}</Table.Cell>
								<Table.Cell>
									<Badge color={STATUS_COLORS[invoice.status]} variant="secondary">
										{invoice.status}
									</Badge>
								</Table.Cell>
								<Table.Cell>{invoice.totalLabel}</Table.Cell>
							</Table.Row>
						))}
						<Table.LoadMore href="?page=2" colSpan={6}>
							Load the next 25 invoices
						</Table.LoadMore>
					</Table.Body>
				</Table>
			</Table.Container>
			<div mix={[hstack({ gap: 2, align: "center", justify: "end" })]}>
				<Text>
					{selection.size} of {INVOICES.length} selected
				</Text>
			</div>
		</div>
	);
});

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: TABLE_CODE, render: () => <TablePreview /> };
