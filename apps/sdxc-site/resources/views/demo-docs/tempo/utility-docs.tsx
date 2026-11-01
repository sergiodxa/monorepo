/**
 * The shape every Tempo reference page is written in: one record per utility, from which
 * the page draws its section (signature, drawing with its code, and the calls beside the CSS
 * they emit) and the rail lists the same utilities, so a heading and its entry never drift.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";

import type { DemoDocsPage } from "~/resources/views/demo-docs";

import { Heading, Signature } from "~/resources/views/demo-docs/blocks";
import { Example } from "~/resources/views/demo-docs/tempo/visuals";

/** One call in a utility's quick reference, beside the CSS it emits. */
export interface UtilityCall {
	call: string;
	css: string;
	/** A small drawing of the value, for a scale a reader compares by eye. */
	sample?: RemixNode;
}

/** One documented utility of the library. */
export interface TempoUtility {
	/** The name a reader imports, which is also the section's fragment. */
	name: string;
	/** The call as written, such as `pad(step, inline?)`. */
	signature: string;
	/** One or two sentences saying what the utility is for. */
	summary: RemixNode;
	/** The drawing and the code that made it. */
	example: { code: string; column?: boolean; preview: RemixNode };
	calls: UtilityCall[];
}

/** A section a page draws before its utilities, such as the scale they share. */
export interface PageSection {
	id: string;
	title: string;
	content: RemixNode;
}

/** Everything a reference page says besides its utilities. */
interface UtilityPageOptions extends Omit<DemoDocsPage, "toc" | "render" | "mono"> {
	/** The paragraph above everything else, saying what the group shares. */
	intro: RemixNode;
	sections?: PageSection[];
	utilities: TempoUtility[];
}

/**
 * Builds a reference page from its utilities: one `h2` per shared section and per utility,
 * the utility's set in the mono face, and a rail that lists exactly those headings in order.
 *
 * @param options The page's header, intro, sections, utilities and next steps.
 * @returns The page the site registers under its path.
 */
export function utilityPage(options: UtilityPageOptions): DemoDocsPage {
	let { intro, sections = [], utilities, ...page } = options;

	return {
		...page,
		toc: [
			...sections.map((section) => ({ id: section.id, text: section.title, level: 2 as const })),
			...utilities.map((utility) => ({ id: utility.name, text: utility.name, level: 2 as const })),
		],
		render: () => [
			<p key="intro">{intro}</p>,
			...sections.flatMap((section) => [
				<Heading key={`${section.id}-heading`} id={section.id}>
					{section.title}
				</Heading>,
				<div key={`${section.id}-content`}>{section.content}</div>,
			]),
			...utilities.flatMap((utility) => [
				<Heading key={`${utility.name}-heading`} id={utility.name} mono>
					{utility.name}
				</Heading>,
				<p key={`${utility.name}-summary`}>{utility.summary}</p>,
				<Signature
					key={`${utility.name}-signature`}
					code={utility.signature}
					returns="ClassName"
				/>,
				<Example
					key={`${utility.name}-example`}
					code={utility.example.code}
					column={utility.example.column}
				>
					{utility.example.preview}
				</Example>,
				<CallTable key={`${utility.name}-calls`} name={utility.name} calls={utility.calls} />,
			]),
		],
	};
}

namespace CallTable {
	export interface Props {
		/** The utility the calls belong to, which names the table. */
		name: string;
		calls: UtilityCall[];
	}
}

/**
 * The quick reference: every documented call beside the CSS it emits, with a drawing column
 * only when a call carries a sample. Long CSS wraps inside its cell so the table fits a phone.
 */
function CallTable(handle: Handle<CallTable.Props>) {
	return () => {
		let { calls, name } = handle.props;
		let samples = calls.some((call) => call.sample !== undefined);
		return (
			<table aria-label={`${name} quick reference`}>
				<thead>
					<tr>
						<th>Call</th>
						<th>CSS</th>
						{samples ? <th>Preview</th> : null}
					</tr>
				</thead>
				<tbody>
					{calls.map((call) => (
						<tr key={call.call}>
							<td>
								<code>{call.call}</code>
							</td>
							<td mix={[raw({ overflowWrap: "anywhere" })]}>
								<code>{call.css}</code>
							</td>
							{samples ? <td>{call.sample}</td> : null}
						</tr>
					))}
				</tbody>
			</table>
		);
	};
}
