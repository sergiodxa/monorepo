/**
 * The props, parameters or members a generated reference page prints, drawn as the shared
 * props table. A type that resolves to a union of strings lists those strings, since which
 * ones are allowed is what the type name leaves open.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { PropsTable } from "@sdxc/ui";

import type { PropRow } from "~/app/services/components";

import { PROPS_LABELS } from "~/resources/components/docs-labels";
import ReferenceProse from "~/resources/components/reference-prose";

namespace PropsReference {
	export interface Props {
		/** What the table is, for a reader who reaches it without the heading above. */
		label: string;
		rows: PropRow[];
		/** What the first column names, such as "Parameter". Defaults to "Name". */
		nameLabel?: string;
	}
}

/** Renders one props table; a field is required wherever its declaration is not optional. */
export default function PropsReference(handle: Handle<PropsReference.Props>) {
	return () => {
		let { label, nameLabel, rows } = handle.props;

		return (
			<PropsTable
				aria-label={label}
				labels={nameLabel ? { ...PROPS_LABELS, name: nameLabel } : PROPS_LABELS}
				rows={rows.map((row) => ({
					name: row.name,
					type: row.values.length > 0 ? row.values.join(" | ") : row.type,
					required: !row.optional,
					description: <ReferenceProse>{row.description}</ReferenceProse>,
				}))}
			/>
		);
	};
}
