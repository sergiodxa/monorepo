/**
 * The pieces every Parcelo endpoint page shares: the method and path line under the title,
 * the example request in three languages, and the error codes an endpoint answers with, so
 * each page reads the same way from top to bottom.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { font, text, weight } from "@sdxc/u/typography";

import { LanguageTabs } from "~/resources/views/demo-docs/blocks";

/** The HTTP methods the API answers. */
export type Method = "GET" | "POST" | "PATCH" | "DELETE";

/** Each method's pill colour, read from the theme so it holds in light and dark. */
const METHOD_TONE: Record<Method, string> = {
	GET: "var(--ui-success-fg, oklch(0.55 0.13 150))",
	POST: "var(--ui-brand-fg)",
	PATCH: "var(--ui-warning-fg, oklch(0.6 0.13 70))",
	DELETE: "var(--ui-danger-fg, oklch(0.55 0.18 25))",
};

/** The API's base URL, which every example request names. */
export const BASE_URL = "https://api.parcelo.dev";

/** The test key every example authenticates with, shaped like a real one. */
export const TEST_KEY = "sk_test_4eC39HqLyjWDarjtT1zdp7dc";

namespace Endpoint {
	export interface Props {
		method: Method;
		/** The path after the base URL, such as `/v1/shipments/{id}`. */
		path: string;
	}
}

/**
 * The method as a coloured pill and the path in the monospace face. The path breaks at any
 * character, so a long one wraps on a phone instead of scrolling the page.
 */
export function Endpoint(handle: Handle<Endpoint.Props>) {
	return () => {
		let { method, path } = handle.props;
		return (
			<p
				data-not-typeset=""
				mix={[
					m(0),
					hstack({ gap: 3, align: "center" }),
					raw({
						flexWrap: "wrap",
						padding: "0.625rem 0.875rem",
						borderRadius: "var(--ui-radius-md, 0.375rem)",
						backgroundColor: "var(--ui-neutral-bg-tint)",
						boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
					}),
				]}
			>
				<span
					mix={[
						font("mono"),
						text("xs"),
						weight("semibold"),
						raw({
							paddingInline: "0.5rem",
							paddingBlock: "0.125rem",
							borderRadius: "999px",
							color: METHOD_TONE[method],
							boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${METHOD_TONE[method]} 45%, transparent)`,
							backgroundColor: `color-mix(in oklch, ${METHOD_TONE[method]} 10%, transparent)`,
							letterSpacing: "0.04em",
						}),
					]}
				>
					{method}
				</span>
				<code
					mix={[
						font("mono"),
						text("sm"),
						fg("neutral.emphasis"),
						raw({ minInlineSize: 0, overflowWrap: "anywhere" }),
					]}
				>
					{path}
				</code>
			</p>
		);
	};
}

namespace RequestExample {
	export interface Props {
		method: Method;
		path: string;
		/** The JSON body a write sends, written as the object the JavaScript passes. */
		body?: Record<string, unknown>;
		/** Query parameters a read sends. */
		query?: Record<string, string>;
	}
}

/**
 * The same request as cURL, JavaScript and Python, synced with every other example on the
 * demo, so a reader who picks Python once reads every endpoint in Python.
 */
export function RequestExample(handle: Handle<RequestExample.Props>) {
	return () => {
		let { body, method, path, query } = handle.props;
		let search = query ? `?${new URLSearchParams(query)}` : "";
		let url = `${BASE_URL}${path}${search}`;
		let json = body ? JSON.stringify(body, null, 2) : undefined;

		let curl = [
			`curl ${method === "GET" ? "" : `-X ${method} `}${url} \\`,
			`  -H "Authorization: Bearer ${TEST_KEY}"${json ? " \\" : ""}`,
			...(json
				? ['  -H "Content-Type: application/json" \\', `  -d '${json.replace(/\n/g, "\n  ")}'`]
				: []),
		].join("\n");

		let javascript = [
			`let response = await fetch("${url}", {`,
			`\tmethod: "${method}",`,
			`\theaders: {`,
			`\t\tAuthorization: "Bearer ${TEST_KEY}",`,
			...(json ? [`\t\t"Content-Type": "application/json",`] : []),
			"\t},",
			...(json ? [`\tbody: JSON.stringify(${json.replace(/\n/g, "\n\t")}),`] : []),
			"});",
			"let data = await response.json();",
		].join("\n");

		let python = [
			"import requests",
			"",
			`response = requests.${method.toLowerCase()}(`,
			`    "${url}",`,
			`    headers={"Authorization": "Bearer ${TEST_KEY}"},`,
			...(json ? [`    json=${toPython(json).replace(/\n/g, "\n    ")},`] : []),
			")",
			"data = response.json()",
		].join("\n");

		return (
			<LanguageTabs
				syncKey="parcelo-language"
				aria-label="Language"
				tabs={[
					{ label: "cURL", value: "curl", language: "sh", title: "Terminal", code: curl },
					{ label: "JavaScript", value: "javascript", language: "js", code: javascript },
					{ label: "Python", value: "python", language: "py", code: python },
				]}
			/>
		);
	};
}

/** Rewrites JSON literals as Python's, so the Python tab pastes into a script as is. */
function toPython(json: string): string {
	return json
		.replace(/\btrue\b/g, "True")
		.replace(/\bfalse\b/g, "False")
		.replace(/\bnull\b/g, "None");
}

namespace ErrorCodes {
	export interface Props {
		/** The status codes the endpoint answers with, and what each means here. */
		codes: Array<{ status: number; code: string; when: string }>;
	}
}

/** The errors one endpoint answers with, as a table of status, `code` and cause. */
export function ErrorCodes(handle: Handle<ErrorCodes.Props>) {
	return () => (
		<table>
			<thead>
				<tr>
					<th>Status</th>
					<th>Code</th>
					<th>When</th>
				</tr>
			</thead>
			<tbody>
				{handle.props.codes.map((entry) => (
					<tr key={entry.code}>
						<td>{entry.status}</td>
						<td>
							<code>{entry.code}</code>
						</td>
						<td>{entry.when}</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}
