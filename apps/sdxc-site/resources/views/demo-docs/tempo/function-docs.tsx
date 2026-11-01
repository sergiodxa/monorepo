/**
 * The shape every Tempo reference page is written in: one record per function, from which
 * the page draws a section per function (signature, parameters, returns, example) and the
 * rail lists the same functions, so a heading and its rail entry can never drift apart.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PropsTable } from "@sdxc/ui/docs";
import type { RemixNode } from "remix/component";

import type { DemoDocsPage } from "~/resources/views/demo-docs";

import { Code, Fields, Heading, Signature } from "~/resources/views/demo-docs/blocks";

/** One documented function of the library. */
export interface TempoFunction {
	/** The name a reader imports, which is also the section's fragment. */
	name: string;
	/** The call as written, such as `addDays(date, amount)`. */
	signature: string;
	/** The return type, drawn after the signature's arrow. */
	returns: string;
	/** One sentence saying what the function is for. */
	summary: RemixNode;
	params: PropsTable.Row[];
	/** What comes back, and in which edge cases. */
	returnsText: RemixNode;
	/** A runnable call with its result written as a comment. */
	example: string;
	/** An options object documented under its own subheading. */
	options?: { title: string; rows: PropsTable.Row[] };
}

/** Everything a reference page says besides its functions. */
interface ReferencePageOptions extends Omit<DemoDocsPage, "toc" | "render" | "mono"> {
	/** The paragraph above the first function, saying what the group shares. */
	intro: RemixNode;
	functions: TempoFunction[];
}

/** The fragment an options subheading answers to, under its function's own. */
function optionsId(fn: TempoFunction): string {
	return `${fn.name}-options`;
}

/**
 * Builds a reference page from its functions: a mono title, one `h2` per function with an
 * `h3` for an options object, and a rail that lists exactly those headings in order.
 *
 * @param options The page's header, intro, functions and next steps.
 * @returns The page the site registers under its path.
 */
export function referencePage(options: ReferencePageOptions): DemoDocsPage {
	let { functions, intro, ...page } = options;

	return {
		...page,
		mono: true,
		toc: functions.flatMap((fn) => [
			{ id: fn.name, text: fn.name, level: 2 },
			...(fn.options ? [{ id: optionsId(fn), text: fn.options.title, level: 3 }] : []),
		]),
		render: () => [
			<p key="intro">{intro}</p>,
			...functions.flatMap((fn) => [
				<Heading key={`${fn.name}-heading`} id={fn.name} mono>
					{fn.name}
				</Heading>,
				<Signature key={`${fn.name}-signature`} code={fn.signature} returns={fn.returns} />,
				<p key={`${fn.name}-summary`}>{fn.summary}</p>,
				<Fields key={`${fn.name}-params`} label={`${fn.name} parameters`} rows={fn.params} />,
				<p key={`${fn.name}-returns`}>
					<strong>Returns</strong> {fn.returnsText}
				</p>,
				...(fn.options
					? [
							<Heading key={`${fn.name}-options-heading`} id={optionsId(fn)} level={3}>
								{fn.options.title}
							</Heading>,
							<Fields
								key={`${fn.name}-options`}
								label={`${fn.name} options`}
								rows={fn.options.rows}
							/>,
						]
					: []),
				<Code key={`${fn.name}-example`} title="Example" language="ts" code={fn.example} />,
			]),
		],
	};
}

/** The `date` parameter most functions take first. */
export const DATE_PARAM: PropsTable.Row = {
	name: "date",
	type: "Date | number | string",
	required: true,
	description: "The moment to start from: a Date, epoch milliseconds or an ISO 8601 string.",
};
