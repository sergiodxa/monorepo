/**
 * Lays an API resource page out as one block per endpoint: the prose, fields and errors in
 * one column, and the request (as cURL and as JavaScript) with its response in another, so
 * a reader sees what to send beside what each field means.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Markdown } from "@sdxc/markdown";

import { toPlainText } from "@sdxc/markdown/plain";
import { isFailure, wrap } from "@sdxc/result";

/**
 * The `h3` headings whose content belongs beside the prose: the example request and the
 * response, under any of the names the pages give them. "Response Fields" describes the
 * fields and stays with the prose.
 */
const CODE_HEADING = /^(cURL|Example Request( \(.+\))?|Response( \(.+\))?)$/;

/**
 * The plain request headings, whose name the request's own tabs already say; a named
 * example ("Example Request (Slack)") keeps its heading as a label.
 */
const REQUEST_HEADING = /^(cURL|Example Request)$/;

/** Whether a fence names no language, as painted fences say "plain". */
function isPlain(language: string | undefined): boolean {
	return language === undefined || language === "plain" || language === "text";
}

/** The headings over a table that lists what a request body accepts. */
const REQUEST_FIELDS_HEADING = /^(Request Body|Accepted Fields)$/;

/**
 * One row of a hand-written fields table, as the props table draws it. Declared as a
 * `type`, which satisfies the plain JSON a tag attribute holds.
 */
export type HandFieldRow = {
	name: string;
	type: string;
	required?: boolean;
	/** The description with inline code kept in backticks, which the page draws as code. */
	description: string;
};

/** A cell's inline content as text, keeping inline code in backticks. */
function cellText(nodes: readonly Markdown.Inline[]): string {
	return nodes
		.map((node) => {
			if (node.type === "text") return node.value;
			if (node.type === "inlineCode") return `\`${node.value}\``;
			if ("children" in node && Array.isArray(node.children))
				return cellText(node.children as Markdown.Inline[]);
			return toPlainText(node);
		})
		.join("");
}

/**
 * The rows of a hand-written table listing fields or parameters (its first column named
 * Field, Parameter or Name, with a Type column), or `null` for any other table.
 */
function fieldsOf(table: Markdown.Table): HandFieldRow[] | null {
	let [header, ...rows] = table.children;
	if (!header) return null;
	let columns = header.children.map((cell) => cellText(cell.children).trim().toLowerCase());
	if (!["field", "parameter", "name"].includes(columns[0] ?? "")) return null;
	let type = columns.indexOf("type");
	if (type === -1) return null;
	let required = columns.indexOf("required");
	let description = columns.indexOf("description");

	return rows.map((row) => {
		let cell = (index: number) =>
			index === -1 ? "" : cellText(row.children[index]?.children ?? []).trim();
		let entry: HandFieldRow = {
			name: cell(0).replace(/^`|`$/g, ""),
			type: cell(type).replace(/^`|`$/g, ""),
			description: cell(description),
		};
		if (required !== -1) entry.required = /^yes$/i.test(cell(required));
		return entry;
	});
}

/** A fence holding only an endpoint's method and path: `GET /api/v1/monitors`. */
const ENDPOINT_LINE = /^(GET|POST|PUT|PATCH|DELETE|HEAD) (\/\S*)$/;

/** Fences a reader runs in a shell, which a request example is written in. */
const SHELL_LANGUAGES = new Set(["bash", "sh", "shell"]);

/** A block-level tag the docs page draws with its own component. */
function tag(
	name: string,
	attributes: Markdown.Attributes,
	children: Markdown.Block[],
	position: Markdown.Position,
): Markdown.Block {
	return { type: "tag", name, attributes, children, position } as Markdown.Block;
}

/** Whether a block is the `<operation>` placeholder the reference expansion leaves. */
function isOperation(node: Markdown.Block): boolean {
	return node.type === "tag" && node.name === "operation";
}

/**
 * Rebuilds a page so every `h2` section that documents an operation becomes an `endpoint`
 * tag holding an `endpoint-main` and an `endpoint-code` column. A section with no
 * operation (an overview, a list of rules) stays prose; the page's other nodes are kept.
 *
 * @param document - The page, with heading ids already assigned.
 */
export function endpointSections(document: Markdown.Document): Markdown.Document {
	let children: Markdown.Block[] = [];
	let section: Markdown.Block[] = [];

	let flush = () => {
		if (section.length === 0) return;
		if (section.some(isOperation)) children.push(endpointOf(section));
		else children.push(...section);
		section = [];
	};

	for (let node of document.children) {
		if (node.type === "heading" && node.level <= 2) {
			flush();
			if (node.level === 2) section.push(node);
			else children.push(node);
			continue;
		}
		if (section.length > 0) section.push(node);
		else children.push(node);
	}
	flush();

	return { ...document, children };
}

/**
 * One endpoint's block. Its method and path become an `endpoint-path` chip under the
 * heading, the operation's scope line stays where the page wrote it, and its errors and
 * schemas close the prose column; each request example becomes a `request` tag.
 */
function endpointOf(section: Markdown.Block[]): Markdown.Block {
	let [heading, ...rest] = section;
	let position = heading?.position ?? section[0]!.position;
	let main: Markdown.Block[] = heading ? [heading] : [];
	let code: Markdown.Block[] = [];
	let operation: string | null = null;
	let inCode = false;
	let lastHeading: string | null = null;
	let hasRequestTable = false;

	for (let node of rest) {
		if (node.type === "heading" && node.level === 3) {
			let title = toPlainText(node);
			lastHeading = title;
			inCode = CODE_HEADING.test(title);
			if (inCode) {
				if (!REQUEST_HEADING.test(title)) {
					code.push(tag("code-label", { text: title }, [], node.position));
				}
				continue;
			}
		}

		let endpoint =
			node.type === "code" && isPlain(node.language)
				? ENDPOINT_LINE.exec(node.content.trim())
				: null;
		if (endpoint) {
			main.splice(
				1,
				0,
				tag("endpoint-path", { method: endpoint[1]!, path: endpoint[2]! }, [], node.position),
			);
			continue;
		}

		let fields = !inCode && node.type === "table" ? fieldsOf(node) : null;
		if (fields) {
			if (lastHeading !== null && REQUEST_FIELDS_HEADING.test(lastHeading)) hasRequestTable = true;
			main.push(tag("fields", { rows: fields }, [], node.position));
			continue;
		}

		if (isOperation(node) && node.type === "tag") {
			let { name } = node.attributes;
			operation = typeof name === "string" ? name : null;
			main.push(node);
			continue;
		}

		if (inCode && node.type === "code" && node.language && SHELL_LANGUAGES.has(node.language)) {
			let fetch = curlToFetch(node.content);
			code.push(
				tag("request", { curl: node.content, ...(fetch ? { fetch } : {}) }, [], node.position),
			);
			continue;
		}

		(inCode ? code : main).push(node);
	}

	if (operation) {
		main.push(
			tag("operation-details", { name: operation, request: !hasRequestTable }, [], position),
		);
	}

	return tag(
		"endpoint",
		{},
		[tag("endpoint-main", {}, main, position), tag("endpoint-code", {}, code, position)],
		position,
	);
}

/** One cURL command, read into what a `fetch` call needs. */
interface CurlRequest {
	url: string;
	method: string;
	headers: Array<[string, string]>;
	body: string | null;
}

/**
 * Splits a shell command into its words, honouring single and double quotes and the
 * trailing `\` that continues a line, so a quoted JSON body stays one word.
 */
function shellWords(source: string): string[] | null {
	let words: string[] = [];
	let current = "";
	let quote: "'" | '"' | null = null;
	let started = false;

	for (let index = 0; index < source.length; index += 1) {
		let char = source[index]!;
		if (quote) {
			if (char === quote) quote = null;
			else current += char;
			continue;
		}
		if (char === "'" || char === '"') {
			quote = char;
			started = true;
			continue;
		}
		if (char === "\\" && source[index + 1] === "\n") {
			index += 1;
			continue;
		}
		if (/\s/.test(char)) {
			if (started) words.push(current);
			current = "";
			started = false;
			continue;
		}
		current += char;
		started = true;
	}
	if (quote) return null;
	if (started) words.push(current);
	return words;
}

/**
 * Reads a single `curl` command with `-X`, `-H` and `-d`. Anything else (a pipe, a second
 * command, an output file, a variable) answers `null`, and the page shows the cURL alone.
 */
function parseCurl(source: string): CurlRequest | null {
	let trimmed = source.trim();
	if (/[|;$`#]|&&/.test(trimmed.replace(/'[^']*'|"[^"]*"/g, ""))) return null;
	let words = shellWords(trimmed);
	if (!words || words[0] !== "curl") return null;

	let request: CurlRequest = { url: "", method: "GET", headers: [], body: null };
	let explicitMethod = false;
	for (let index = 1; index < words.length; index += 1) {
		let word = words[index]!;
		let value = words[index + 1];
		if (word === "-X" || word === "--request") {
			if (value === undefined) return null;
			request.method = value;
			explicitMethod = true;
			index += 1;
		} else if (word === "-H" || word === "--header") {
			if (value === undefined) return null;
			let colon = value.indexOf(":");
			if (colon === -1) return null;
			request.headers.push([value.slice(0, colon).trim(), value.slice(colon + 1).trim()]);
			index += 1;
		} else if (word === "-d" || word === "--data" || word === "--data-raw") {
			if (value === undefined) return null;
			request.body = value;
			index += 1;
		} else if (word.startsWith("-")) {
			return null;
		} else if (request.url === "") {
			request.url = word;
		} else {
			return null;
		}
	}
	if (request.url === "") return null;
	if (request.body !== null && !explicitMethod) request.method = "POST";
	return request;
}

/**
 * The same request as JavaScript's `fetch`, with a JSON body written as an object literal
 * through `JSON.stringify`, or `null` when the cURL does more than one request.
 *
 * @example curlToFetch('curl https://uptime.sergiodxa.com/api/v1/ping') // 'let response = await fetch(…)'
 */
export function curlToFetch(source: string): string | null {
	let request = parseCurl(source);
	if (!request) return null;

	let options: string[] = [];
	if (request.method !== "GET") options.push(`\tmethod: ${JSON.stringify(request.method)},`);
	if (request.headers.length > 0) {
		let headers = request.headers.map(
			([name, value]) => `\t\t${JSON.stringify(name)}: ${JSON.stringify(value)},`,
		);
		options.push(`\theaders: {\n${headers.join("\n")}\n\t},`);
	}
	if (request.body !== null) options.push(`\tbody: ${bodyOf(request.body)},`);

	let call =
		options.length > 0
			? `fetch(${JSON.stringify(request.url)}, {\n${options.join("\n")}\n})`
			: `fetch(${JSON.stringify(request.url)})`;
	return `let response = await ${call};\nlet result = await response.json();`;
}

/** A body as source: a JSON body as `JSON.stringify({ … })`, anything else as a string. */
function bodyOf(body: string): string {
	let parsed = wrap((): unknown => JSON.parse(body));
	if (isFailure(parsed)) return JSON.stringify(body);
	let literal = JSON.stringify(parsed.data, null, "\t").replace(/\n/g, "\n\t");
	return `JSON.stringify(${literal})`;
}
