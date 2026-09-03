/**
 * The built-in `url` capability: pure, permissionless parsing of an absolute
 * URL string into a query-string parameter, a fragment parameter, the path, or
 * the host. It lets a spec read a value out of a URL it already holds — most
 * often the authorization `code` in the redirect URL a `browser.url`
 * observation returned after an OAuth authorize step. Every tool is a pure
 * computation, so all are `observable` and need no permission grant.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { SpecError } from "../errors";
import type { Plugin, ToolDescriptor } from "../plugin";
import type { ToolArg, Value } from "../values";

import { ToolError } from "../errors";

const URL_TOOLS = ["query", "fragment", "path", "host"] as const;

type UrlTool = (typeof URL_TOOLS)[number];

const DESCRIPTORS: ToolDescriptor[] = [
	{
		name: "query",
		summary: "Read the value of a query-string parameter from an absolute URL.",
		kind: "observable",
		params: [
			{ name: "url", kind: "value", required: true, summary: "The absolute URL to read." },
			{ name: "name", kind: "value", required: true, summary: "The query parameter to return." },
		],
	},
	{
		name: "fragment",
		summary: "Read the value of a parameter from a URL's fragment (after the #).",
		kind: "observable",
		params: [
			{ name: "url", kind: "value", required: true, summary: "The absolute URL to read." },
			{ name: "name", kind: "value", required: true, summary: "The fragment parameter to return." },
		],
	},
	{
		name: "path",
		summary: "Read an absolute URL's pathname.",
		kind: "observable",
		params: [{ name: "url", kind: "value", required: true, summary: "The absolute URL to read." }],
	},
	{
		name: "host",
		summary: "Read an absolute URL's host, including the port when present.",
		kind: "observable",
		params: [{ name: "url", kind: "value", required: true, summary: "The absolute URL to read." }],
	},
];

/**
 * Create the built-in `url` plugin (namespace `"url"`). Every tool parses its
 * first argument as an absolute URL; a non-string argument, an unparseable
 * URL, or a missing `query`/`fragment` parameter is a {@link ToolError}.
 */
export function createUrlPlugin(): Plugin {
	return {
		namespace: "url",
		describe() {
			return DESCRIPTORS;
		},
		async call(tool, args) {
			if (!isUrlTool(tool)) {
				return failure(
					new ToolError(`url has no tool "${tool}"; available tools: ${URL_TOOLS.join(", ")}`),
				);
			}
			if (tool === "query" || tool === "fragment") return param(tool, args);
			return part(tool, args);
		},
	};
}

function isUrlTool(tool: string): tool is UrlTool {
	return (URL_TOOLS as readonly string[]).includes(tool);
}

/**
 * A fragment parses as a query string, the shape an implicit/hybrid OAuth flow
 * returns its tokens in. An absent parameter is a tool error naming both the
 * parameter and the URL, so a spec fails loud at the point of the lookup.
 */
function param(tool: "query" | "fragment", args: ToolArg[]): Result<Value, SpecError> {
	let url = readUrl(tool, args);
	if (isFailure(url)) return url;
	let name = readName(tool, args);
	if (isFailure(name)) return name;
	let params =
		tool === "query" ? url.data.searchParams : new URLSearchParams(url.data.hash.replace(/^#/, ""));
	let found = params.get(name.data);
	if (found === null) {
		let where = tool === "query" ? "query string" : "fragment";
		return failure(
			new ToolError(
				`url.${tool} found no ${where} parameter "${name.data}" in the URL ${args0Raw(args)}`,
			),
		);
	}
	return success(found);
}

function part(tool: "path" | "host", args: ToolArg[]): Result<Value, SpecError> {
	let url = readUrl(tool, args);
	if (isFailure(url)) return url;
	return success(tool === "path" ? url.data.pathname : url.data.host);
}

/**
 * Validate and parse the first argument as an absolute URL. A missing
 * argument, a non-string argument, or an unparseable URL is a tool error.
 */
function readUrl(tool: UrlTool, args: ToolArg[]): Result<URL, SpecError> {
	let first = args[0];
	if (first === undefined || first.kind !== "value" || typeof first.value !== "string") {
		return failure(new ToolError(`url.${tool} requires its first argument to be a URL string`));
	}
	try {
		return success(new URL(first.value));
	} catch {
		return failure(new ToolError(`url.${tool} could not parse the URL "${first.value}"`));
	}
}

function readName(tool: "query" | "fragment", args: ToolArg[]): Result<string, SpecError> {
	let second = args[1];
	if (second === undefined || second.kind !== "value" || typeof second.value !== "string") {
		return failure(
			new ToolError(`url.${tool} requires its second argument to be a parameter name`),
		);
	}
	return success(second.value);
}

function args0Raw(args: ToolArg[]): string {
	let first = args[0];
	if (first !== undefined && first.kind === "value" && typeof first.value === "string") {
		return first.value;
	}
	return "the URL";
}
