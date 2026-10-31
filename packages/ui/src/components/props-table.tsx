/**
 * The reference table a docs page prints for props, options, fields or a request body:
 * name, type, default, required and description, with nested fields behind a native
 * disclosure that expands in place. In a narrow column each row stacks into a card.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { mergeMix, raw } from "@sdxc/u/general";
import { container } from "@sdxc/u/layout";
import { font, text, weight } from "@sdxc/u/typography";

import type { CSSStyles } from "../utils/css-styles.js";

/** Container the table queries, so it stacks by the width it is given rather than the viewport. */
const CONTAINER = "ui-props-table";

/** The container width at or under which rows stack into cards. */
const STACK_BELOW = "36rem";

/** Muted ink for column labels, empty cells and the disclosure. */
const MUTED = "var(--ui-neutral-fg-muted)";

/** Hairline between rows. */
const RULE = "1px solid var(--ui-neutral-border)";

/**
 * Prop types for {@link PropsTable}.
 */
export namespace PropsTable {
	/**
	 * One documented field. The shape follows a JSON Schema property: `type` is the type as
	 * it should read, `default` its serialized default, `required` whether the parent's
	 * `required` list names it, and `children` the properties of an object or array item.
	 */
	export interface Row {
		name: string;
		type: string;
		default?: string;
		required?: boolean;
		description?: RemixNode;
		children?: readonly Row[];
	}

	/** Every string the table prints; the library ships no copy of its own. */
	export interface Labels {
		name: string;
		type: string;
		default: string;
		required: string;
		description: string;
		/** The cell value of a required field, such as "Yes" or "Required". */
		yes: string;
		/** The cell value of an optional field, such as "No" or "Optional". */
		no: string;
		/** The closed disclosure's summary, such as "Show child parameters". */
		showChildren: string;
		/** The open disclosure's summary, such as "Hide child parameters". Defaults to `showChildren`. */
		hideChildren?: string;
	}

	/** Props accepted by {@link PropsTable}. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		rows: readonly Row[];
		labels: Labels;
		/** Names the table for a reader who reaches it without the heading above it. */
		"aria-label"?: string;
	}
}

/**
 * Renders the table inside a box that is its own size container. Above 36rem it reads as
 * five columns; at or below, each row stacks with the column label before each value. A
 * long type wraps inside its cell, so the table never widens the page.
 *
 * @param handle Runtime handle carrying the table's props.
 * @returns The render function producing the table.
 * @example
 * <PropsTable aria-label={t("props")} labels={labels} rows={[
 * 	{ name: "title", type: "string", description: "The file the block belongs to." },
 * 	{ name: "retry", type: "object", children: [{ name: "attempts", type: "number", default: "3" }] },
 * ]} />
 */
export function PropsTable(handle: Handle<PropsTable.Props>) {
	return () => {
		let { "aria-label": label, labels, mix, rows, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="props-table"
				mix={mergeMix([container(CONTAINER), raw({ minInlineSize: 0, overflowX: "auto" })], mix)}
			>
				<RowsTable rows={rows} labels={labels} label={label} nested={false} />
			</div>
		);
	};
}

/** Props for {@link RowsTable}. */
interface RowsTableProps {
	rows: readonly PropsTable.Row[];
	labels: PropsTable.Labels;
	label: string | undefined;
	/** A nested table hides its header row visually; screen readers still read its columns. */
	nested: boolean;
}

/**
 * One level of rows. A row with children is followed by a row spanning every column that
 * holds a `<details>` with the next level, so the children expand right under their parent.
 */
function RowsTable(handle: Handle<RowsTableProps>) {
	return () => {
		let { label, labels, nested, rows } = handle.props;
		let columns = [labels.name, labels.type, labels.default, labels.required, labels.description];

		return (
			<table aria-label={label} mix={[text("sm"), tableRules(nested)]}>
				<thead mix={nested ? [visuallyHidden()] : []}>
					<tr>
						{columns.map((column) => (
							<th key={column} scope="col">
								{column}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.flatMap((row) => [
						<tr key={row.name} data-row="">
							<th scope="row" data-cell="name">
								<code mix={[font("mono"), weight("semibold")]}>{row.name}</code>
							</th>
							<td data-cell="type" data-label={labels.type}>
								<code mix={[font("mono")]}>{row.type}</code>
							</td>
							<td data-cell="default" data-label={labels.default}>
								{row.default === undefined ? (
									<span data-empty="">—</span>
								) : (
									<code mix={[font("mono")]}>{row.default}</code>
								)}
							</td>
							<td
								data-cell="required"
								data-label={labels.required}
								data-required={row.required ? "" : undefined}
							>
								{row.required ? labels.yes : labels.no}
							</td>
							<td data-cell="description" data-label={labels.description}>
								{row.description}
							</td>
						</tr>,
						row.children && row.children.length > 0 ? (
							<tr key={`${row.name}-children`} data-children="">
								<td colSpan={columns.length}>
									<details>
										<summary>
											<span data-summary="closed">{labels.showChildren}</span>
											<span data-summary="open">{labels.hideChildren ?? labels.showChildren}</span>
										</summary>
										<RowsTable rows={row.children} labels={labels} label={row.name} nested />
									</details>
								</td>
							</tr>
						) : null,
					])}
				</tbody>
			</table>
		);
	};
}

/**
 * Every rule a table level follows, in one block so the stacked layout's `display`
 * overrides resolve by specificity. Child selectors keep each level's rules off the
 * tables nested inside it, which answer to their own container query.
 *
 * @param nested Whether this level sits inside a parent row's disclosure.
 */
function tableRules(nested: boolean) {
	let stacked: CSSStyles = {
		"& > thead": { display: "none" },
		"&, & > tbody, & > tbody > tr, & > tbody > tr > :is(th, td)": { display: "block" },
		"& > tbody > tr[data-row]": { paddingBlock: "0.75rem", borderBlockStart: RULE },
		"& > tbody > tr[data-children]": { borderBlockStart: 0 },
		"& > tbody > tr > :is(th, td)": {
			borderBlockStart: 0,
			paddingBlock: "0.125rem",
			paddingInline: 0,
		},
		"& > tbody > tr > td[data-label]": {
			display: "grid",
			gridTemplateColumns: "minmax(5.5rem, 30%) minmax(0, 1fr)",
			columnGap: "0.75rem",
		},
		"& > tbody > tr > td[data-label]::before": { content: "attr(data-label)", color: MUTED },
		'& > tbody > tr > td[data-cell="description"]': {
			display: "block",
			paddingBlockStart: "0.375rem",
		},
		'& > tbody > tr > td[data-cell="description"]::before': { content: "none" },
		"& > tbody > tr > td[colspan]": { paddingBlock: 0 },
	};

	return raw({
		inlineSize: "100%",
		borderCollapse: "collapse",
		textAlign: "start",
		color: "var(--ui-neutral-fg)",
		"& > thead > tr > th": {
			paddingBlock: "0.5rem",
			paddingInline: "0.75rem",
			textAlign: "start",
			fontWeight: 600,
			color: MUTED,
			borderBlockEnd: RULE,
			whiteSpace: "nowrap",
		},
		"& > tbody > tr > :is(th, td)": {
			paddingBlock: "0.625rem",
			paddingInline: "0.75rem",
			verticalAlign: "top",
			textAlign: "start",
			fontWeight: "inherit",
			borderBlockStart: RULE,
			overflowWrap: "anywhere",
		},
		"& > tbody > tr > :is(th, td):first-child": { paddingInlineStart: nested ? "0.75rem" : 0 },
		'& > tbody > tr > th[data-cell="name"]': {
			color: "var(--ui-neutral-fg-emphasis)",
			minInlineSize: "7rem",
		},
		'& > tbody > tr > td[data-cell="type"]': { minInlineSize: "7rem", maxInlineSize: "16rem" },
		'& > tbody > tr > td[data-cell="description"]': { minInlineSize: "12rem" },
		'& > tbody > tr > td[data-cell="required"][data-required]': {
			color: "var(--ui-warning-fg)",
			fontWeight: 500,
		},
		"& [data-empty]": { color: MUTED },
		"& > tbody > tr[data-children] > td": { borderBlockStart: 0, paddingBlockStart: 0 },
		"& > tbody > tr[data-children] > td > details": {
			borderInlineStart: RULE,
			marginInlineStart: "0.25rem",
		},
		"& > tbody > tr[data-children] > td > details > summary": {
			paddingBlock: "0.25rem",
			paddingInline: "0.75rem",
			cursor: "pointer",
			color: "var(--ui-brand-fg)",
			fontWeight: 500,
			"&:focus-visible": { outline: "2px solid var(--ui-brand-ring)", borderRadius: "0.25rem" },
		},
		'& > tbody > tr[data-children] > td > details > summary > [data-summary="open"]': {
			display: "none",
		},
		'& > tbody > tr[data-children] > td > details[open] > summary > [data-summary="open"]': {
			display: "inline",
		},
		'& > tbody > tr[data-children] > td > details[open] > summary > [data-summary="closed"]': {
			display: "none",
		},
		[`@container ${CONTAINER} (max-width: ${STACK_BELOW})`]: stacked,
	});
}
