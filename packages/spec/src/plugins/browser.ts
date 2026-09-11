/**
 * The built-in `browser` capability: drive a real browser through the
 * accessibility tree, not DOM internals, via the globally-installed
 * `agent-browser` CLI. Reaching web content is privileged, so the whole
 * family requires `net`; the trusted binary needs no `run` grant (ADR-007 §4).
 *
 * Elements are addressed with the vocabulary of `addressing.ts`, so a document
 * reads the same here as it does over a string of markup and the namespace says
 * only whether a live browser is needed. A target is an absolute URL or a
 * `/path` resolved against a configured base, which `on "web"` selects; the
 * `net` grant is then checked against the resolved host, so a denial names the
 * host a grant would have to spell.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, delimiter, join, sep } from "node:path";

import type { HTMLQueryError } from "@sdxc/html";
import type { Result } from "@sdxc/result";

import { HTML, HTMLAmbiguousMatchError } from "@sdxc/html";
import { failure, isFailure, isSuccess, success } from "@sdxc/result";

import type { SpecError } from "../errors.js";
import type { Plugin, ToolContext, ToolDescriptor, ToolParam } from "../plugin.js";
import type { ToolArg, Value, ValueObject } from "../values.js";
import type { Workspace } from "../workspace.js";

import { ExpectationError, ToolError } from "../errors.js";
import { formatValue } from "../values.js";

import type { Assertion, ElementQuery, MatchMode, Predicate, QueryOptions } from "./addressing.js";
import type { HttpVerb } from "./request-options.js";

import {
	ambiguousMatch,
	ASSERTION_PARAMS,
	describeQuery,
	FILL_PARAMS,
	noMatch,
	parseAssertion,
	parseFill,
	parseQuery,
	QUERY_PARAMS,
} from "./addressing.js";
import {
	HTTP_VERBS,
	buildRequestInit,
	isHttpVerb,
	readRequestArgs,
	requestParams,
} from "./request-options.js";

/** The trusted CLI binary every browser tool shells out to. */
const BROWSER_BINARY = "agent-browser";

/** The word `browser.checkbox` takes as its state assertion. */
const CHECKED_WORDS = ["checked"];

/** The word `browser.set_cookie` requires before the URL it scopes a cookie to. */
const COOKIE_WORDS = ["for"];

/** The word `browser.heading` requires before a heading level. */
const LEVEL_WORDS = ["level"];

/** The word that selects which configured base a relative target resolves against. */
const BASE_WORDS = ["on"];

/** The word `browser.scroll` requires before its destination. */
const SCROLL_WORDS = ["to"];

/** The word the response observables require before a response kind. */
const OF_WORDS = ["of"];

/** Which of the session's responses an observable reads. */
const RESPONSE_KINDS = ["document", "data"];

/** The prefix the request verbs are spelled under, dot and all. */
const FETCH_PREFIX = "fetch.";

/**
 * The header every `browser.fetch.*` request carries so the response
 * observables can pass it over: seeding data must never become the response a
 * later assertion reads.
 */
const FETCH_MARKER_HEADER = "x-spec-fetch";

/**
 * The named viewports, each Tailwind's breakpoint width with the height of the
 * device that lives there. A name sets size alone, so a layout assertion is
 * about width and never about a user agent or a touch emulation.
 */
const VIEWPORTS = new Map<string, [number, number]>([
	["xs", [390, 844]],
	["sm", [640, 1138]],
	["md", [768, 1024]],
	["lg", [1024, 768]],
	["xl", [1280, 800]],
	["2xl", [1536, 998]],
]);

/** The `fetch.<verb>` tool name one request verb is exposed under. */
function fetchTool(verb: HttpVerb): string {
	return `${FETCH_PREFIX}${verb}`;
}

/** The head every element lookup opens with, where the tool's name fixes none. */
const ROLE_PARAM: ToolParam = {
	name: "role",
	kind: "word",
	required: true,
	summary: "The ARIA role, e.g. `button`, `link`, `textbox` — or the word `field`.",
};

/** The accessible name a role lookup matches, or a field's `name` attribute. */
const NAME_PARAM: ToolParam = {
	name: "name",
	kind: "value",
	required: false,
	summary: "The accessible name, matched whole; a `field` takes its `name` attribute.",
};

/** Descriptors of every tool the `browser` namespace exposes. */
const BROWSER_TOOLS: ToolDescriptor[] = [
	{
		name: "open",
		summary: 'Navigate the browser session to a target: `open "/charities" on "web"`.',
		kind: "action",
		requires: "net",
		params: navigationParams("open"),
	},
	{
		name: "navigate",
		summary: "Navigate the current browser session to another target.",
		kind: "action",
		requires: "net",
		params: navigationParams("navigate to"),
	},
	{
		name: "reload",
		summary: "Reload the current page, returning once the document has finished loading.",
		kind: "action",
		requires: "net",
		params: [],
	},
	{
		name: "set_cookie",
		summary: 'Write a cookie: `set_cookie "session" token for "https://app.test"`.',
		kind: "action",
		requires: "net",
		params: [
			{ name: "name", kind: "value", required: true, summary: "Name of the cookie to write." },
			{
				name: "value",
				kind: "value",
				required: true,
				summary: "Value of the cookie, typically read from the environment with `env.get`.",
			},
			{
				name: "for",
				kind: "word",
				required: false,
				summary: "The literal word `for`, introducing the URL the cookie belongs to.",
			},
			{
				name: "url",
				kind: "value",
				required: false,
				summary: "URL the cookie is scoped to; defaults to the page already open.",
			},
		],
	},
	{
		name: "viewport",
		summary: 'Resize the page: `viewport 1280 800`, or a name like `viewport "lg"`.',
		kind: "action",
		requires: "net",
		params: [
			{
				name: "size",
				kind: "value",
				required: true,
				summary: `Width in CSS pixels, or one of the named sizes: ${[...VIEWPORTS.keys()].join(", ")}.`,
			},
			{
				name: "height",
				kind: "value",
				required: false,
				summary: "Height in CSS pixels, required when the width is a number.",
			},
		],
	},
	{
		name: "scroll",
		summary: 'Scroll to an offset or an element: `scroll to 900`, `scroll to button "Menu"`.',
		kind: "action",
		requires: "net",
		params: [
			{
				name: "to",
				kind: "word",
				required: true,
				summary: "The literal word `to`, introducing the destination.",
			},
			{ ...ROLE_PARAM, summary: `${ROLE_PARAM.summary} A Y offset in CSS pixels sits here too.` },
			NAME_PARAM,
			...QUERY_PARAMS,
		],
	},
	{
		name: "ua",
		summary: "Send a custom User-Agent header, so the app can recognize the spec run.",
		kind: "action",
		requires: "net",
		params: [
			{
				name: "value",
				kind: "value",
				required: true,
				summary: 'The User-Agent to send, e.g. "spec-runner/1.0".',
			},
		],
	},
	{
		name: "click",
		summary: 'Click the element the query addresses: `click button "Sign in"`.',
		kind: "action",
		requires: "net",
		params: [ROLE_PARAM, NAME_PARAM, ...QUERY_PARAMS],
	},
	{
		name: "fill",
		summary: 'Replace a control\'s value: `fill textbox "Email" with "ada@example.com"`.',
		kind: "action",
		requires: "net",
		params: [ROLE_PARAM, NAME_PARAM, ...FILL_PARAMS, textParam("replaces"), ...QUERY_PARAMS],
	},
	{
		name: "type",
		summary: 'Append keystrokes to a control: `type textbox "Search" with "ada"`.',
		kind: "action",
		requires: "net",
		params: [ROLE_PARAM, NAME_PARAM, ...FILL_PARAMS, textParam("appends"), ...QUERY_PARAMS],
	},
	{
		name: "check",
		summary: 'Check the box or switch the query addresses: `check checkbox "Remember me"`.',
		kind: "action",
		requires: "net",
		params: [ROLE_PARAM, NAME_PARAM, ...QUERY_PARAMS],
	},
	{
		name: "uncheck",
		summary: 'Clear the box or switch the query addresses: `uncheck checkbox "Remember me"`.',
		kind: "action",
		requires: "net",
		params: [ROLE_PARAM, NAME_PARAM, ...QUERY_PARAMS],
	},
	{
		name: "select",
		summary: 'Choose an option in a dropdown: `select combobox "Country" with "Uruguay"`.',
		kind: "action",
		requires: "net",
		params: [
			ROLE_PARAM,
			NAME_PARAM,
			...FILL_PARAMS,
			{
				name: "option",
				kind: "value",
				required: false,
				summary: "The option to choose, named the way the list shows it.",
			},
			...QUERY_PARAMS,
		],
	},
	{
		name: "press",
		summary: 'Press a key at the current focus, e.g. `press "Enter"`.',
		kind: "action",
		requires: "net",
		params: [
			{
				name: "key",
				kind: "value",
				required: true,
				summary: 'Key or combination to press, e.g. "Enter" or "Control+a".',
			},
		],
	},
	{
		name: "click_selector",
		summary: "Escape hatch: click by raw CSS selector when no accessible name exists.",
		kind: "action",
		requires: "net",
		params: [
			{
				name: "selector",
				kind: "value",
				required: true,
				summary: "A raw CSS selector; a marked pocket of implementation coupling (ADR-005 §3).",
			},
		],
	},
	...HTTP_VERBS.map((verb) => describeFetchVerb(verb)),
	{
		name: "cookie",
		summary: 'Read a cookie\'s value: `expect browser.cookie "session" token`.',
		kind: "observable",
		requires: "net",
		params: [
			{ name: "name", kind: "value", required: true, summary: "Name of the cookie to read." },
			expectedParam("the whole value the cookie must carry"),
			...ASSERTION_PARAMS,
		],
	},
	{
		name: "response_header",
		summary: 'Read a response header: `browser.response_header "set-cookie" of data`.',
		kind: "observable",
		requires: "net",
		params: [
			{
				name: "name",
				kind: "value",
				required: true,
				summary: "Header name, matched case-insensitively.",
			},
			...responseKindParams(),
			expectedParam("a value the header must carry, of the several it may repeat under"),
			...ASSERTION_PARAMS,
		],
	},
	{
		name: "response_status",
		summary: "Read a response's status: `browser.response_status of data 201`.",
		kind: "observable",
		requires: "net",
		params: [...responseKindParams(), expectedParam("the status the response must carry")],
	},
	{
		name: "element",
		summary: 'Address any element by role and accessible name: `element button "Save" enabled`.',
		kind: "observable",
		requires: "net",
		params: [ROLE_PARAM, NAME_PARAM, ...QUERY_PARAMS],
	},
	{
		name: "heading",
		summary: 'Address a heading, optionally at a level: `heading "Reports" level 3`.',
		kind: "observable",
		requires: "net",
		params: [
			NAME_PARAM,
			{
				name: "level",
				kind: "word",
				required: false,
				summary: "The literal word `level`, introducing the heading level to demand.",
			},
			{
				name: "number",
				kind: "value",
				required: false,
				summary: "The level: 3 matches an `<h3>` or a `role=heading` with `aria-level=3`.",
			},
			...QUERY_PARAMS,
		],
	},
	{
		name: "link",
		summary: 'Address a link by its accessible name: `link "Profile" first`.',
		kind: "observable",
		requires: "net",
		params: [NAME_PARAM, ...QUERY_PARAMS],
	},
	{
		name: "button",
		summary: 'Address a button by its accessible name: `button "Save" disabled`.',
		kind: "observable",
		requires: "net",
		params: [NAME_PARAM, ...QUERY_PARAMS],
	},
	{
		name: "text",
		summary: "Read the text a reader would see, or assert a substring of it.",
		kind: "observable",
		requires: "net",
		params: [
			expectedParam("a substring the visible text must contain; `exactly` demands the whole of it"),
			...ASSERTION_PARAMS,
		],
	},
	{
		name: "checkbox",
		summary: 'Assert a checkbox\'s state: `expect browser.checkbox "Remember me" checked`.',
		kind: "observable",
		requires: "net",
		params: [
			NAME_PARAM,
			{
				name: "checked",
				kind: "word",
				required: false,
				summary: "Asserts the box is checked; without it the query only addresses the box.",
			},
			...QUERY_PARAMS,
		],
	},
	{
		name: "cell",
		summary: "Read a table cell: `cell row 1 column 2`, counting from 1 over body rows.",
		kind: "observable",
		requires: "net",
		params: [...QUERY_PARAMS],
	},
	{
		name: "definition",
		summary: 'Read the definition paired with a term: `definition "Total"`.',
		kind: "observable",
		requires: "net",
		params: [
			{ name: "term", kind: "value", required: true, summary: "The term's text, matched whole." },
			...QUERY_PARAMS,
		],
	},
	{
		name: "url",
		summary: "Observe the session's current URL, or assert it equals an expected URL.",
		kind: "observable",
		requires: "net",
		params: [expectedParam("the whole URL the current location must equal"), ...ASSERTION_PARAMS],
	},
	{
		name: "path",
		summary: 'Observe the current URL\'s path: `expect browser.path "/donate/share"`.',
		kind: "observable",
		requires: "net",
		params: [expectedParam("the whole path the current location must equal"), ...ASSERTION_PARAMS],
	},
	{
		name: "query",
		summary: 'Read a query-string parameter of the current URL: `query "step" "share"`.',
		kind: "observable",
		requires: "net",
		params: [
			{
				name: "name",
				kind: "value",
				required: true,
				summary: "The query parameter to read; an absent one fails unless `exists` follows.",
			},
			expectedParam("the whole value that parameter must carry"),
			...ASSERTION_PARAMS,
		],
	},
	{
		name: "fragment",
		summary: 'Read a parameter out of the current URL\'s fragment: `fragment "access_token"`.',
		kind: "observable",
		requires: "net",
		params: [
			{
				name: "name",
				kind: "value",
				required: true,
				summary: "The fragment parameter to read; an absent one fails unless `exists` follows.",
			},
			expectedParam("the whole value that parameter must carry"),
			...ASSERTION_PARAMS,
		],
	},
	{
		name: "title",
		summary: "Observe the page's title, or assert it equals an expected title.",
		kind: "observable",
		requires: "net",
		params: [expectedParam("the whole title the document must carry"), ...ASSERTION_PARAMS],
	},
];

/**
 * The parameters `open` and `navigate` share: a target and the base it
 * resolves against.
 *
 * @param action - How the summary reads the tool's verb.
 * @returns The parameter list, in positional order.
 */
function navigationParams(action: string): ToolDescriptor["params"] {
	return [
		{
			name: "target",
			kind: "value",
			required: true,
			summary: `An absolute URL to ${action}, or a \`/path\` resolved against a configured base.`,
		},
		{
			name: "on",
			kind: "word",
			required: false,
			summary: "The literal word `on`, introducing which base to resolve against.",
		},
		{
			name: "base",
			kind: "value",
			required: false,
			summary: "Name of that base, as `spec/config.jsonc` spells it.",
		},
	];
}

/** The `of document` / `of data` clause the response observables share. */
function responseKindParams(): ToolParam[] {
	return [
		{
			name: "of",
			kind: "word",
			required: false,
			summary: "The literal word `of`, introducing which response to read.",
		},
		...RESPONSE_KINDS.map((kind) => ({
			name: kind,
			kind: "word" as const,
			required: false,
			summary: `Reads the session's last ${kind} response.`,
		})),
	];
}

/** The text `fill … with` and `type … with` put into the control they addressed. */
function textParam(effect: string): ToolParam {
	return {
		name: "text",
		kind: "value",
		required: false,
		summary: `The text this ${effect} into the addressed control.`,
	};
}

/** The bare expected value every value-reading observable takes. */
function expectedParam(summary: string): ToolParam {
	return { name: "expected", kind: "value", required: false, summary: `When given, ${summary}.` };
}

/**
 * Describe one `fetch.<verb>` tool: `http`'s verb and its option grammar
 * verbatim, issued inside the session so its cookies apply.
 */
function describeFetchVerb(verb: HttpVerb): ToolDescriptor {
	return {
		name: fetchTool(verb),
		summary: `Send a ${verb.toUpperCase()} request from inside the browser session, with its cookies.`,
		kind: "action",
		requires: "net",
		params: requestParams(),
	};
}

/**
 * Create the built-in `browser` plugin: accessibility-first web-interaction
 * tools backed by `agent-browser`. Each call keys a session to the test's
 * workspace, isolating browser state; {@link Plugin.dispose} closes them all.
 */
export function createBrowserPlugin(): Plugin {
	/**
	 * Sessions this plugin has driven, closed on dispose. The same test
	 * workspace yields the same session across its many calls.
	 */
	let sessions = new Set<string>();
	return {
		namespace: "browser",
		describe() {
			return BROWSER_TOOLS;
		},
		async call(tool, args, context) {
			let session = sessionFor(context.workspace);
			sessions.add(session);
			if (tool.startsWith(FETCH_PREFIX)) {
				let verb = tool.slice(FETCH_PREFIX.length);
				if (isHttpVerb(verb)) return await sessionFetch(verb, args, context, session);
			}
			switch (tool) {
				case "open":
				case "navigate":
					return await navigate(tool, args, context, session);
				case "reload":
					return await reload(args, session);
				case "set_cookie":
					return await setCookie(args, context, session);
				case "cookie":
					return await cookie(args, session);
				case "response_header":
					return await responseHeader(args, session);
				case "response_status":
					return await responseStatus(args, session);
				case "viewport":
					return await viewport(args, session);
				case "scroll":
					return await scroll(args, context, session);
				case "ua":
					return await userAgent(args, session);
				case "click":
				case "check":
				case "uncheck":
					return await interact(tool, args, context, session);
				case "fill":
				case "type":
					return await write(tool, args, context, session);
				case "select":
					return await choose(args, context, session);
				case "press":
					return await press(args, session);
				case "click_selector":
					return await clickSelector(args, session);
				case "element":
					return await observeElement(tool, args, context, session, {});
				case "heading":
					return await heading(args, context, session);
				case "link":
				case "button":
					return await observeElement(tool, args, context, session, {
						head: { kind: "role", role: tool },
					});
				case "checkbox":
					return await checkbox(args, context, session);
				case "cell":
					return await observeElement(tool, args, context, session, { head: { kind: "cell" } });
				case "definition":
					return await observeElement(tool, args, context, session, {
						head: { kind: "definition" },
					});
				case "text":
					return await text(args, session);
				case "url":
				case "path":
				case "title":
					return await reading(tool, args, session);
				case "query":
				case "fragment":
					return await urlParameter(tool, args, session);
				default: {
					let names = BROWSER_TOOLS.map((descriptor) => descriptor.name).join(", ");
					return failure(new ToolError(`browser has no tool named "${tool}"; tools: ${names}`));
				}
			}
		},
		/**
		 * Best-effort teardown: a failed close must never fail a run, and a
		 * missing binary at dispose time means there is nothing left to close.
		 */
		async dispose() {
			for (let session of sessions) {
				await runBrowser(["close"], session);
			}
			sessions.clear();
		},
	};
}

/**
 * `browser.open`/`browser.navigate target [on "base"]` — resolve the target
 * through the run's bases, pass the scoped `net` check for the resolved host
 * and port, then navigate.
 */
async function navigate(
	tool: string,
	args: ToolArg[],
	context: ToolContext,
	session: string,
): Promise<Result<Value, SpecError>> {
	if (args.length !== 1 && args.length !== 3) {
		return failure(
			new ToolError(
				`browser.${tool} takes a target, optionally followed by \`on "<base>"\`; got ${args.length} arguments`,
			),
		);
	}
	let target = stringArg(args, 0, tool, "target");
	if (isFailure(target)) return target;
	let base = readBase(tool, args, 1);
	if (isFailure(base)) return base;
	let resolved = reachable(tool, target.data, base.data, context);
	if (isFailure(resolved)) return resolved;
	let response = await runBrowser(["open", resolved.data.href], session);
	if (isFailure(response)) return response;
	return success(null);
}

/** `browser.reload` — reload the page, returning once the document has loaded. */
async function reload(args: ToolArg[], session: string): Promise<Result<Value, SpecError>> {
	if (args.length > 0) {
		return failure(new ToolError("browser.reload takes no arguments"));
	}
	let response = await runBrowser(["reload"], session);
	if (isFailure(response)) return response;
	return success(null);
}

/**
 * `browser.set_cookie name value [for url]` — seed the session's cookie jar so
 * a spec starts already authenticated. Without `for`, the cookie scopes to the
 * page already open, whose host was already `net`-checked when it was opened.
 */
async function setCookie(
	args: ToolArg[],
	context: ToolContext,
	session: string,
): Promise<Result<Value, SpecError>> {
	if (args.length !== 2 && args.length !== 4) {
		return failure(
			new ToolError(
				'browser.set_cookie takes a name and a value, optionally followed by `for "<url>"`',
			),
		);
	}
	let name = stringArg(args, 0, "set_cookie", "name");
	if (isFailure(name)) return name;
	let value = stringArg(args, 1, "set_cookie", "value");
	if (isFailure(value)) return value;
	let scope: string;
	if (args.length === 4) {
		let separator = wordArg(args, 2, "set_cookie", COOKIE_WORDS);
		if (isFailure(separator)) return separator;
		let target = stringArg(args, 3, "set_cookie", "url");
		if (isFailure(target)) return target;
		let resolved = reachable("set_cookie", target.data, undefined, context);
		if (isFailure(resolved)) return resolved;
		scope = resolved.data.href;
	} else {
		let current = await currentUrl(session);
		if (isFailure(current)) return current;
		if (!current.data.startsWith("http:") && !current.data.startsWith("https:")) {
			return failure(
				new ToolError(
					'browser.set_cookie has no page to scope the cookie to; open one first, or name the URL: browser.set_cookie "session" token for "https://app.example.com"',
				),
			);
		}
		scope = current.data;
	}
	let response = await runBrowser(
		["cookies", "set", name.data, value.data, "--url", scope],
		session,
	);
	if (isFailure(response)) return response;
	return success(null);
}

/**
 * `browser.cookie name […]` — read a cookie's value from the session's jar,
 * which carries `HttpOnly` cookies too, so a sign-in assertion reads the cookie
 * the page's own script cannot.
 */
async function cookie(args: ToolArg[], session: string): Promise<Result<Value, SpecError>> {
	let name = stringArg(args, 0, "cookie", "name");
	if (isFailure(name)) return name;
	let response = await runBrowser(["cookies", "get"], session);
	if (isFailure(response)) return response;
	let jar = readCookies(response.data);
	return observeValue(
		"cookie",
		args,
		1,
		"exact",
		`cookie ${formatValue(name.data)}`,
		jar.get(name.data),
		[...jar.keys()],
	);
}

/** Every cookie the session's jar holds, by name, in the order it reported them. */
function readCookies(payload: Record<string, unknown>): Map<string, string> {
	let jar = new Map<string, string>();
	let cookies = payload.cookies;
	if (!Array.isArray(cookies)) return jar;
	for (let entry of cookies) {
		if (typeof entry !== "object" || entry === null) continue;
		let record = entry as { name?: unknown; value?: unknown };
		if (typeof record.name !== "string" || typeof record.value !== "string") continue;
		jar.set(record.name, record.value);
	}
	return jar;
}

/**
 * `browser.response_header name [of document|of data] […]` — every value the
 * named header carried, as an array. Values stay separate because `Set-Cookie`
 * puts commas inside `Expires`, which folding would make unparseable, and an
 * assertion holds when some one of them answers it.
 */
async function responseHeader(args: ToolArg[], session: string): Promise<Result<Value, SpecError>> {
	let name = stringArg(args, 0, "response_header", "name");
	if (isFailure(name)) return name;
	let kind = readResponseKind("response_header", args, 1);
	if (isFailure(kind)) return kind;
	let response = await lastResponse("response_header", kind.data, session);
	if (isFailure(response)) return response;
	let assertion = parseAssertion("browser.response_header", args, kind.data.consumed, "exact");
	if (isFailure(assertion)) return assertion;

	let headers = response.data.responseHeaders;
	let wanted = name.data.toLowerCase();
	let observed: string[] | undefined;
	for (let [header, value] of Object.entries(headers)) {
		if (header.toLowerCase() === wanted) observed = value.split("\n");
	}
	if (assertion.data.kind === "exists") return success(observed !== undefined);
	if (observed === undefined) {
		let error = new ExpectationError(
			`browser.response_header found no ${formatValue(name.data)} on the last ${kind.data.kind} response. Present: ${Object.keys(headers).join(", ")}`,
			name.data,
			null,
		);
		error.remedy = "Add `exists` where the absence is what the test is about.";
		return failure(error);
	}
	if (assertion.data.kind === "read") return success(observed);
	let expected = assertion.data;
	let held = observed.some((value) =>
		expected.mode === "exact" ? value === expected.text : value.includes(expected.text),
	);
	if (held) return success(true);
	let comparison = expected.mode === "exact" ? "is not" : "does not contain";
	return failure(
		new ExpectationError(
			`no value of ${formatValue(name.data)} ${comparison} ${formatValue(expected.text)}`,
			expected.text,
			observed,
		),
	);
}

/**
 * `browser.response_status [of document|of data] [expected]` — the status of
 * the session's last response of that kind.
 */
async function responseStatus(args: ToolArg[], session: string): Promise<Result<Value, SpecError>> {
	let kind = readResponseKind("response_status", args, 0);
	if (isFailure(kind)) return kind;
	let rest = args.slice(kind.data.consumed);
	if (rest.length > 1) {
		return failure(
			new ToolError("browser.response_status takes at most one expected status argument"),
		);
	}
	let response = await lastResponse("response_status", kind.data, session);
	if (isFailure(response)) return response;
	let observed = response.data.status;
	if (rest.length === 0) return success(observed);
	let expected = numberArg(rest, 0, "response_status", "expected status");
	if (isFailure(expected)) return expected;
	if (observed === expected.data) return success(true);
	return failure(
		new ExpectationError(
			`the last ${kind.data.kind} response is not ${expected.data}`,
			expected.data,
			observed,
		),
	);
}

/**
 * `browser.viewport 1280 800` or `browser.viewport "lg"` — resize the page,
 * applying immediately to whatever is open.
 */
async function viewport(args: ToolArg[], session: string): Promise<Result<Value, SpecError>> {
	let size = readViewport(args);
	if (isFailure(size)) return size;
	let [width, height] = size.data;
	let response = await runBrowser(["set", "viewport", String(width), String(height)], session);
	if (isFailure(response)) return response;
	return success(null);
}

/**
 * Read a viewport as two numbers or as one of the named sizes, which a spec
 * may write as a bare word (`lg`) or a string (`"2xl"`, which cannot be a word).
 */
function readViewport(args: ToolArg[]): Result<[number, number], SpecError> {
	let first = args[0];
	if (first === undefined) {
		return failure(
			new ToolError(
				`browser.viewport takes a width and a height, or one of the named sizes: ${[...VIEWPORTS.keys()].join(", ")}`,
			),
		);
	}
	if (first.kind === "value" && typeof first.value === "number") {
		if (args.length !== 2) {
			return failure(new ToolError("browser.viewport takes a height after a numeric width"));
		}
		let width = numberArg(args, 0, "viewport", "width");
		if (isFailure(width)) return width;
		let height = numberArg(args, 1, "viewport", "height");
		if (isFailure(height)) return height;
		return success([width.data, height.data]);
	}
	if (args.length !== 1) {
		return failure(new ToolError("browser.viewport takes a named size on its own"));
	}
	let name = first.kind === "word" ? first.word : first.value;
	let size = typeof name === "string" ? VIEWPORTS.get(name) : undefined;
	if (size === undefined) {
		return failure(
			new ToolError(
				`browser.viewport does not know the size ${formatValue(typeof name === "string" ? name : null)}; named sizes: ${[...VIEWPORTS.keys()].join(", ")}`,
			),
		);
	}
	return success(size);
}

/**
 * `browser.scroll to 900` scrolls the window to an absolute Y offset in CSS
 * pixels; `browser.scroll to button "Menu"` brings that element into view.
 */
async function scroll(
	args: ToolArg[],
	context: ToolContext,
	session: string,
): Promise<Result<Value, SpecError>> {
	let separator = wordArg(args, 0, "scroll", SCROLL_WORDS);
	if (isFailure(separator)) return separator;
	let destination = args[1];
	if (destination !== undefined && destination.kind === "word") {
		let found = await address("scroll", args, context, session, { from: 1 });
		if (isFailure(found)) return found;
		let response = await runBrowser(["scrollintoview", selectorFor(found.data)], session);
		if (isFailure(response)) return response;
		return success(null);
	}
	if (args.length !== 2) {
		return failure(
			new ToolError(
				'browser.scroll takes `to <offset>` or `to <role> "<name>"`; got neither shape',
			),
		);
	}
	let offset = numberArg(args, 1, "scroll", "offset");
	if (isFailure(offset)) return offset;
	let response = await runBrowser(["eval", `window.scrollTo(0, ${offset.data})`], session);
	if (isFailure(response)) return response;
	return success(null);
}

/**
 * `browser.fetch.<verb> target [options]` — issue `http`'s request from inside
 * the page, so the session's cookies apply. The request carries a marker
 * header the response observables skip, so seeding never clobbers an assertion.
 */
async function sessionFetch(
	verb: HttpVerb,
	args: ToolArg[],
	context: ToolContext,
	session: string,
): Promise<Result<Value, SpecError>> {
	let tool = fetchTool(verb);
	let label = `browser.${tool}`;
	let parsedArgs = readRequestArgs(label, args);
	if (isFailure(parsedArgs)) return parsedArgs;
	if (parsedArgs.data.body !== undefined && verb === "get") {
		return failure(
			new ToolError(`${label} cannot send a request body; a GET request carries none`),
		);
	}
	let target = reachable(tool, parsedArgs.data.target, parsedArgs.data.base, context);
	if (isFailure(target)) return target;
	let init = buildRequestInit(label, verb, parsedArgs.data);
	if (isFailure(init)) return init;
	let response = await runBrowser(["eval", fetchScript(target.data, init.data)], session);
	if (isFailure(response)) return response;
	return shapeFetchResult(label, response.data.result);
}

/**
 * The page-side script one `fetch.<verb>` runs: the request the init
 * describes, plus the marker header and the credentials that make the
 * session's cookies apply cross-origin as well as same-origin.
 */
function fetchScript(target: URL, init: RequestInit): string {
	let headers: Record<string, string> = {
		...((init.headers as Record<string, string> | undefined) ?? {}),
		[FETCH_MARKER_HEADER]: "1",
	};
	let request: Record<string, unknown> = {
		method: init.method,
		headers,
		credentials: "include",
	};
	if (typeof init.body === "string") request.body = init.body;
	return [
		"(async () => {",
		`	let response = await fetch(${JSON.stringify(target.href)}, ${JSON.stringify(request)});`,
		"	let headers = {};",
		"	response.headers.forEach((value, name) => { headers[name.toLowerCase()] = value; });",
		"	return { status: response.status, ok: response.ok, headers, text: await response.text() };",
		"})()",
	].join("\n");
}

/** Shape the page-side fetch result the way `http` shapes its own response. */
function shapeFetchResult(label: string, result: unknown): Result<Value, SpecError> {
	if (typeof result !== "object" || result === null || Array.isArray(result)) {
		return failure(new ToolError(`${label} could not read the response the page reported`));
	}
	let record = result as { status?: unknown; ok?: unknown; headers?: unknown; text?: unknown };
	let text = typeof record.text === "string" ? record.text : "";
	let headers: ValueObject = {};
	if (typeof record.headers === "object" && record.headers !== null) {
		for (let [name, value] of Object.entries(record.headers as Record<string, unknown>)) {
			if (typeof value === "string") headers[name] = value;
		}
	}
	return success({
		status: typeof record.status === "number" ? record.status : 0,
		ok: record.ok === true,
		headers,
		text,
		json: parseJson(text),
	});
}

/** Parse a response body as JSON, yielding null when it is not valid JSON. */
function parseJson(text: string): Value {
	try {
		return JSON.parse(text) as Value;
	} catch {
		return null;
	}
}

/** One response the session recorded, as the observables read it. */
interface RecordedResponse {
	/** The response's headers, repeated ones newline-joined by the browser. */
	responseHeaders: Record<string, string>;
	/** The response's status code. */
	status: number;
}

/** Which response an observable reads, and how many arguments the clause took. */
interface ResponseSelection {
	/** The response kind: `document` or `data`. */
	kind: string;
	/** How many arguments the `of <kind>` clause consumed. */
	consumed: number;
}

/**
 * Read an optional `of document`/`of data` clause. With no clause the
 * observable reads the document response, which is the page the spec is on.
 */
function readResponseKind(
	tool: string,
	args: ToolArg[],
	index: number,
): Result<ResponseSelection, SpecError> {
	let head = args[index];
	if (head === undefined || head.kind !== "word" || !OF_WORDS.includes(head.word)) {
		return success({ kind: RESPONSE_KINDS[0] ?? "document", consumed: index });
	}
	let separator = wordArg(args, index, tool, OF_WORDS);
	if (isFailure(separator)) return separator;
	let kind = wordArg(args, index + 1, tool, RESPONSE_KINDS);
	if (isFailure(kind)) return kind;
	return success({ kind: kind.data, consumed: index + 2 });
}

/**
 * The session's most recent response of one kind, skipping the requests
 * `browser.fetch.*` issued so seeding data cannot become the response an
 * assertion reads.
 */
async function lastResponse(
	tool: string,
	selection: ResponseSelection,
	session: string,
): Promise<Result<RecordedResponse, SpecError>> {
	let types = selection.kind === "document" ? "document" : "xhr,fetch";
	let response = await runBrowser(["network", "requests", "--type", types], session);
	if (isFailure(response)) return response;
	let requests = response.data.requests;
	if (!Array.isArray(requests)) return failure(noResponse(tool, selection.kind));
	let found: RecordedResponse | undefined;
	for (let entry of requests) {
		let record = readRecordedResponse(entry);
		if (record !== undefined) found = record;
	}
	if (found === undefined) return failure(noResponse(tool, selection.kind));
	return success(found);
}

/** The tool error raised when the session recorded no response of a kind. */
function noResponse(tool: string, kind: string): ToolError {
	return new ToolError(
		`browser.${tool} found no ${kind} response in this session; navigate or fetch before asserting on one`,
	);
}

/**
 * Read one recorded request into a response, or undefined when it carried no
 * response or was issued by `browser.fetch.*`.
 */
function readRecordedResponse(entry: unknown): RecordedResponse | undefined {
	if (typeof entry !== "object" || entry === null) return undefined;
	let record = entry as { headers?: unknown; responseHeaders?: unknown; status?: unknown };
	if (typeof record.status !== "number") return undefined;
	if (hasMarkerHeader(record.headers)) return undefined;
	let responseHeaders: Record<string, string> = {};
	if (typeof record.responseHeaders === "object" && record.responseHeaders !== null) {
		for (let [name, value] of Object.entries(record.responseHeaders as Record<string, unknown>)) {
			if (typeof value === "string") responseHeaders[name] = value;
		}
	}
	return { responseHeaders, status: record.status };
}

/** Whether a recorded request carried the marker every `fetch.*` request sends. */
function hasMarkerHeader(headers: unknown): boolean {
	if (typeof headers !== "object" || headers === null) return false;
	for (let name of Object.keys(headers as Record<string, unknown>)) {
		if (name.toLowerCase() === FETCH_MARKER_HEADER) return true;
	}
	return false;
}

/**
 * Read an optional `on "<base>"` clause at `index`, which selects which
 * configured base a relative target resolves against.
 */
function readBase(
	tool: string,
	args: ToolArg[],
	index: number,
): Result<string | undefined, SpecError> {
	if (args[index] === undefined) return success(undefined);
	let separator = wordArg(args, index, tool, BASE_WORDS);
	if (isFailure(separator)) return separator;
	let name = stringArg(args, index + 1, tool, "base");
	if (isFailure(name)) return name;
	return success(name.data);
}

/**
 * Resolve a target through the run's bases and clear it for the network: the
 * scheme must be http(s), and the `net` grant is checked against the resolved
 * host and port, so a denial names the host a grant would have to spell.
 */
function reachable(
	tool: string,
	target: string,
	base: string | undefined,
	context: ToolContext,
): Result<URL, SpecError> {
	let resolved = context.bases.resolve(target, base);
	if (isFailure(resolved)) return resolved;
	let url = resolved.data;
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		return failure(
			new ToolError(`browser.${tool} supports http(s) URLs only; got ${formatValue(url.href)}`),
		);
	}
	let allowed = context.permissions.checkNet(url.hostname, portOf(url));
	if (isFailure(allowed)) return allowed;
	return success(url);
}

/**
 * `browser.ua value` — send a custom `User-Agent` header on every request, so
 * an app can distinguish a spec run from a real visitor; `navigator.userAgent`
 * in page script still reports the browser's own identity.
 */
async function userAgent(args: ToolArg[], session: string): Promise<Result<Value, SpecError>> {
	let value = stringArg(args, 0, "ua", "value");
	if (isFailure(value)) return value;
	let headers = JSON.stringify({ "User-Agent": value.data });
	let response = await runBrowser(["set", "headers", headers], session);
	if (isFailure(response)) return response;
	return success(null);
}

/** `browser.click|check|uncheck <query>` — act on the one element it addressed. */
async function interact(
	tool: string,
	args: ToolArg[],
	context: ToolContext,
	session: string,
): Promise<Result<Value, SpecError>> {
	let found = await address(tool, args, context, session, {});
	if (isFailure(found)) return found;
	let response = await runBrowser([tool, selectorFor(found.data)], session);
	if (isFailure(response)) return response;
	return success(null);
}

/**
 * `browser.fill <query> with "text"` replaces the control's value and
 * `browser.type` appends keystrokes to whatever it already holds.
 */
async function write(
	tool: string,
	args: ToolArg[],
	context: ToolContext,
	session: string,
): Promise<Result<Value, SpecError>> {
	let parsed = parseFill(`browser.${tool}`, args);
	if (isFailure(parsed)) return parsed;
	let found = await resolve(tool, parsed.data.query, context, session);
	if (isFailure(found)) return found;
	let selector = selectorFor(found.data);
	if (tool === "type") {
		let typed = await runBrowser(["type", selector, parsed.data.text], session);
		if (isFailure(typed)) return typed;
		return success(null);
	}
	if (isRange(found.data)) return await setValue(tool, selector, parsed.data.text, session);
	let response = await runBrowser(["fill", selector, parsed.data.text], session);
	if (isFailure(response)) return response;
	return success(null);
}

/**
 * `browser.select <query> with "option"` — choose the option that reads that
 * way in the list the addressed control holds. `fill` replaces a value and
 * `check` toggles, so choosing takes the same `with` the other writes take.
 */
async function choose(
	args: ToolArg[],
	context: ToolContext,
	session: string,
): Promise<Result<Value, SpecError>> {
	let parsed = parseFill("browser.select", args);
	if (isFailure(parsed)) return parsed;
	let found = await resolve("select", parsed.data.query, context, session);
	if (isFailure(found)) return found;

	let wanted: ElementQuery = { kind: "role", role: "option", name: parsed.data.text };
	let option = found.data.query({ role: "option", name: parsed.data.text });
	if (isFailure(option)) {
		let missing =
			option.error instanceof HTMLAmbiguousMatchError
				? ambiguousMatch("browser.select", wanted, option.error.candidates)
				: noMatch("browser.select", wanted, { names: option.error.available });
		return failure(await diagnose(missing, "select", session, context));
	}
	/** An option with no `value` attribute is worth its own text, as HTML says. */
	let chosen = option.data.value ?? option.data.text;
	let response = await runBrowser(["select", selectorFor(found.data), chosen], session);
	if (isFailure(response)) return response;
	return success(null);
}

/** Whether a control is a range input, whose value a keystroke cannot carry. */
function isRange(found: HTML.Element): boolean {
	return found.tag === "input" && (found.attributes["type"] ?? "").toLowerCase() === "range";
}

/**
 * Put a value into a control the way the platform does, through the prototype
 * setter and both the `input` and `change` events. A range input is the case
 * that needs it: typing cannot express a slider position, so a plain fill
 * leaves the thumb where it was and a controlled component reads a stale value.
 */
async function setValue(
	tool: string,
	selector: string,
	text: string,
	session: string,
): Promise<Result<Value, SpecError>> {
	let script = [
		"(() => {",
		`	let element = document.querySelector(${JSON.stringify(selector)});`,
		"	if (element === null) return false;",
		'	let descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");',
		"	if (descriptor === undefined || descriptor.set === undefined) return false;",
		`	descriptor.set.call(element, ${JSON.stringify(text)});`,
		'	element.dispatchEvent(new Event("input", { bubbles: true }));',
		'	element.dispatchEvent(new Event("change", { bubbles: true }));',
		"	return true;",
		"})()",
	].join("\n");
	let response = await runBrowser(["eval", script], session);
	if (isFailure(response)) return response;
	if (response.data.result !== true) {
		return failure(
			new ToolError(`browser.${tool} could not put a value into the control it addressed`),
		);
	}
	return success(null);
}

/** `browser.press key` — press a key at the current focus, no element needed. */
async function press(args: ToolArg[], session: string): Promise<Result<Value, SpecError>> {
	let key = stringArg(args, 0, "press", "key");
	if (isFailure(key)) return key;
	let response = await runBrowser(["press", key.data], session);
	if (isFailure(response)) return response;
	return success(null);
}

/** `browser.click_selector selector` — the CSS escape hatch (ADR-005 §3). */
async function clickSelector(args: ToolArg[], session: string): Promise<Result<Value, SpecError>> {
	let selector = stringArg(args, 0, "click_selector", "selector");
	if (isFailure(selector)) return selector;
	let response = await runBrowser(["click", selector.data], session);
	if (isFailure(response)) return response;
	return success(null);
}

/**
 * `browser.heading […] [level <n>]` — the shared addressing, plus the level
 * clause: 3 matches both an `<h3>` and a `role=heading` with `aria-level=3`,
 * since both reach the accessibility tree identically.
 */
async function heading(
	args: ToolArg[],
	context: ToolContext,
	session: string,
): Promise<Result<Value, SpecError>> {
	let options: QueryOptions = { head: { kind: "role", role: "heading" }, stopAt: LEVEL_WORDS };
	let parsed = parseQuery("browser.heading", args, options);
	if (isFailure(parsed)) return parsed;
	if (args[parsed.data.next] === undefined) {
		return await answer("heading", parsed.data.query, parsed.data.predicate, context, session);
	}

	let separator = wordArg(args, parsed.data.next, "heading", LEVEL_WORDS);
	if (isFailure(separator)) return separator;
	let level = levelArg(args, parsed.data.next + 1);
	if (isFailure(level)) return level;
	let found = await resolve("heading", parsed.data.query, context, session);
	if (isFailure(found)) return found;
	let observed = headingLevel(found.data);
	if (observed === level.data) return success(true);
	return failure(
		new ExpectationError(
			`${describeQuery(parsed.data.query)} is not at level ${level.data}`,
			level.data,
			observed ?? null,
		),
	);
}

/** A heading's level: the `aria-level` it claims, or the one its tag carries. */
function headingLevel(found: HTML.Element): number | undefined {
	let claimed = Number(found.attributes["aria-level"]);
	if (Number.isInteger(claimed) && claimed > 0) return claimed;
	let tag = /^h([1-6])$/.exec(found.tag);
	return tag === null ? undefined : Number(tag[1]);
}

/** Read a heading level: a positive whole number, nothing else. */
function levelArg(args: ToolArg[], index: number): Result<number, ToolError> {
	let arg = args[index];
	if (
		arg === undefined ||
		arg.kind !== "value" ||
		typeof arg.value !== "number" ||
		!Number.isInteger(arg.value) ||
		arg.value < 1
	) {
		return failure(
			new ToolError(
				`browser.heading expects a whole heading level of 1 or more for argument ${index + 1}`,
			),
		);
	}
	return success(arg.value);
}

/**
 * `browser.checkbox […] [checked]` — the shared addressing, plus the state
 * clause. Without `checked` the call only addresses the box, which is how
 * `count` and the other predicates reach it.
 */
async function checkbox(
	args: ToolArg[],
	context: ToolContext,
	session: string,
): Promise<Result<Value, SpecError>> {
	let options: QueryOptions = { head: { kind: "role", role: "checkbox" }, stopAt: CHECKED_WORDS };
	let parsed = parseQuery("browser.checkbox", args, options);
	if (isFailure(parsed)) return parsed;
	if (args[parsed.data.next] === undefined) {
		return await answer("checkbox", parsed.data.query, parsed.data.predicate, context, session);
	}

	let state = wordArg(args, parsed.data.next, "checkbox", CHECKED_WORDS);
	if (isFailure(state)) return state;
	let found = await resolve("checkbox", parsed.data.query, context, session);
	if (isFailure(found)) return found;
	if (found.data.attributes["checked"] !== undefined) return success(true);
	return failure(
		new ExpectationError(`${describeQuery(parsed.data.query)} is not checked`, true, false),
	);
}

/**
 * `browser.text […]` — the text a reader would see. It comes from the live
 * page rather than the markup, so what CSS hides stays out of it.
 */
async function text(args: ToolArg[], session: string): Promise<Result<Value, SpecError>> {
	let response = await runBrowser(["get", "text", "body"], session);
	if (isFailure(response)) return response;
	let visible = typeof response.data.text === "string" ? response.data.text : "";
	return observeValue("text", args, 0, "substring", "visible text", visible);
}

/** `browser.url|path|title […]` — one string the session already carries. */
async function reading(
	tool: string,
	args: ToolArg[],
	session: string,
): Promise<Result<Value, SpecError>> {
	if (tool === "title") {
		let response = await runBrowser(["get", "title"], session);
		if (isFailure(response)) return response;
		let title = typeof response.data.title === "string" ? response.data.title : "";
		return observeValue(tool, args, 0, "exact", "page title", title);
	}
	let current = await location(tool, session);
	if (isFailure(current)) return current;
	let observed = tool === "path" ? current.data.pathname : current.data.href;
	return observeValue(tool, args, 0, "exact", tool === "path" ? "path" : "current URL", observed);
}

/**
 * `browser.query name […]` and `browser.fragment name […]` — one parameter of
 * the current URL, so `eventually` waits on a navigation without a `let`.
 */
async function urlParameter(
	tool: string,
	args: ToolArg[],
	session: string,
): Promise<Result<Value, SpecError>> {
	let name = stringArg(args, 0, tool, "name");
	if (isFailure(name)) return name;
	let current = await location(tool, session);
	if (isFailure(current)) return current;
	let parameters =
		tool === "query"
			? current.data.searchParams
			: new URLSearchParams(current.data.hash.replace(/^#/, ""));
	let observed = parameters.get(name.data);
	return observeValue(
		tool,
		args,
		1,
		"exact",
		`${tool} parameter ${formatValue(name.data)}`,
		observed ?? undefined,
		[...new Set(parameters.keys())],
	);
}

/** The session's location as a URL, refusing to read one before a page is open. */
async function location(tool: string, session: string): Promise<Result<URL, SpecError>> {
	let current = await currentUrl(session);
	if (isFailure(current)) return current;
	try {
		return success(new URL(current.data));
	} catch {
		return failure(
			new ToolError(
				`browser.${tool} has no page to read; open one before asserting on its location`,
			),
		);
	}
}

/**
 * Answer a value-reading observable: hand the value back, report its presence,
 * or assert on it. An absent value is a failed expectation naming what the
 * session holds instead, since `exists` is how a spec asks for the absence.
 */
function observeValue(
	tool: string,
	args: ToolArg[],
	index: number,
	fallback: MatchMode,
	label: string,
	observed: string | undefined,
	available: readonly string[] = [],
): Result<Value, SpecError> {
	let assertion = parseAssertion(`browser.${tool}`, args, index, fallback);
	if (isFailure(assertion)) return assertion;
	return assert(tool, label, observed, assertion.data, available);
}

/** Hold the assertion against the value the session carried. */
function assert(
	tool: string,
	label: string,
	observed: string | undefined,
	assertion: Assertion,
	available: readonly string[],
): Result<Value, SpecError> {
	if (assertion.kind === "exists") return success(observed !== undefined);
	if (observed === undefined) {
		let present = available.length === 0 ? "" : `. Present: ${available.join(", ")}`;
		let error = new ExpectationError(
			`browser.${tool} found no ${label} in this session${present}`,
			label,
			null,
		);
		error.remedy = "Add `exists` where the absence is what the test is about.";
		return failure(error);
	}
	if (assertion.kind === "read") return success(observed);
	let held =
		assertion.mode === "exact" ? observed === assertion.text : observed.includes(assertion.text);
	if (held) return success(true);
	let comparison = assertion.mode === "exact" ? "is not" : "does not contain";
	return failure(
		new ExpectationError(
			`the ${label} ${comparison} ${formatValue(assertion.text)}`,
			assertion.text,
			observed,
		),
	);
}

/** The session's current location, or the empty string when it has none. */
async function currentUrl(session: string): Promise<Result<string, SpecError>> {
	let response = await runBrowser(["get", "url"], session);
	if (isFailure(response)) return response;
	return success(typeof response.data.url === "string" ? response.data.url : "");
}

/** Attribute the page-side reader stamps so a parsed match names a live node. */
const ELEMENT_MARKER = "data-spec-element";

/**
 * The page-side script that hands the live document over as markup. Every
 * element carries its position back, and every control's current value and
 * checked state are written into the markup, which otherwise still spells what
 * the server sent rather than what the person in front of the page did.
 *
 * What the page does not render is marked `hidden` for the same reason: a
 * closed `<dialog>` or a collapsed panel is a stylesheet's doing, which the
 * markup alone cannot see, while a dropdown's options stay listed either way.
 * The mark comes off before the script returns, so a read shows nothing new.
 */
const READ_DOCUMENT = [
	"(() => {",
	"	let index = 0;",
	"	let marked = [];",
	'	for (let element of document.querySelectorAll("*")) {',
	`		element.setAttribute(${JSON.stringify(ELEMENT_MARKER)}, String(index++));`,
	"		let rendered = element.checkVisibility({ visibilityProperty: true });",
	'		let listed = element.tagName === "OPTION" || element.tagName === "OPTGROUP";',
	'		if (!rendered && !listed && !element.hasAttribute("hidden")) {',
	'			element.setAttribute("hidden", "");',
	"			marked.push(element);",
	"		}",
	"		if (element instanceof HTMLInputElement) {",
	'			element.setAttribute("value", element.value);',
	'			if (element.checked) element.setAttribute("checked", "");',
	'			else element.removeAttribute("checked");',
	"		}",
	"		if (element instanceof HTMLTextAreaElement) element.textContent = element.value;",
	"		if (element instanceof HTMLSelectElement) {",
	"			for (let option of element.options) {",
	'				if (option.selected) option.setAttribute("selected", "");',
	'				else option.removeAttribute("selected");',
	"			}",
	"		}",
	"	}",
	"	let markup = document.documentElement.outerHTML;",
	'	for (let element of marked) element.removeAttribute("hidden");',
	"	return markup;",
	"})()",
].join("\n");

/** Read the open page as markup the shared vocabulary can be held against. */
async function readDocument(session: string): Promise<Result<HTML, SpecError>> {
	let response = await runBrowser(["eval", READ_DOCUMENT], session);
	if (isFailure(response)) return response;
	let markup = typeof response.data.result === "string" ? response.data.result : "";
	let document = HTML.parse(markup);
	if (isFailure(document)) {
		return failure(
			new ToolError(`browser could not read the open page as markup: ${document.error.message}`),
		);
	}
	return success(document.data);
}

/** The CSS selector that reaches the live node one parsed match came from. */
function selectorFor(found: HTML.Element): string {
	return `[${ELEMENT_MARKER}="${found.attributes[ELEMENT_MARKER] ?? ""}"]`;
}

/**
 * Parse an action's query and resolve it to the one element it addresses.
 * Narrowing is what an action's query may do and asserting is what it may not,
 * which is one rule the vocabulary states once.
 */
async function address(
	tool: string,
	args: ToolArg[],
	context: ToolContext,
	session: string,
	options: QueryOptions,
): Promise<Result<HTML.Element, SpecError>> {
	let parsed = parseQuery(`browser.${tool}`, args, { ...options, predicates: "narrow" });
	if (isFailure(parsed)) return parsed;
	return await resolve(tool, parsed.data.query, context, session);
}

/**
 * Resolve one query against the open page. Several matches ask which one and
 * no match names what the page held instead, both in the shared vocabulary's
 * words and both carrying the run's failure diagnostics.
 */
async function resolve(
	tool: string,
	query: ElementQuery,
	context: ToolContext,
	session: string,
): Promise<Result<HTML.Element, SpecError>> {
	let document = await readDocument(session);
	if (isFailure(document)) return document;
	let found = look(document.data, query);
	if (isFailure(found)) {
		let error = missed(`browser.${tool}`, document.data, query, found.error);
		return failure(await diagnose(error, tool, session, context));
	}
	return success(found.data);
}

/**
 * `browser.element` and the observables whose own name fixes the head: one
 * addressed element and what the call asserts about it. With no predicate the
 * element's text is the answer, so the same call reads a value and asserts the
 * element is there.
 */
async function observeElement(
	tool: string,
	args: ToolArg[],
	context: ToolContext,
	session: string,
	options: QueryOptions,
): Promise<Result<Value, SpecError>> {
	let parsed = parseQuery(`browser.${tool}`, args, options);
	if (isFailure(parsed)) return parsed;
	return await answer(tool, parsed.data.query, parsed.data.predicate, context, session);
}

/** Hold one parsed query and its predicate against the open page. */
async function answer(
	tool: string,
	query: ElementQuery,
	predicate: Predicate,
	context: ToolContext,
	session: string,
): Promise<Result<Value, SpecError>> {
	let name = `browser.${tool}`;
	let document = await readDocument(session);
	if (isFailure(document)) return document;
	let doc = document.data;

	if (predicate.kind === "count") {
		let counts = counted(name, doc, query, predicate.count);
		if (isFailure(counts)) return failure(await diagnose(counts.error, tool, session, context));
		return counts;
	}
	let found = look(doc, query);
	if (predicate.kind === "exists") {
		/** Two matches are still a presence, so only an empty page reads false. */
		if (isSuccess(found)) return success(true);
		return success(found.error instanceof HTMLAmbiguousMatchError);
	}
	if (isFailure(found)) {
		return failure(await diagnose(missed(name, doc, query, found.error), tool, session, context));
	}
	let held = await holds(name, query, found.data, predicate, session);
	if (isFailure(held)) return failure(await diagnose(held.error, tool, session, context));
	return held;
}

/** Run the lookup the query's kind selects, mapping it onto the package's own. */
function look(doc: HTML, query: ElementQuery): Result<HTML.Element, HTMLQueryError> {
	if (query.kind === "field") {
		return doc.field(query.field ?? "", { value: query.value, at: query.at });
	}
	if (query.kind === "definition") return doc.definition(query.term ?? "", { at: query.at });
	if (query.kind === "cell") {
		let cell = query.cell ?? { row: 1, column: 1, includeHeader: false };
		return doc.cell({
			row: cell.row,
			column: cell.column,
			includeHeader: cell.includeHeader,
			at: query.at,
		});
	}
	return doc.query({
		role: query.role,
		name: query.name,
		nameContaining: query.nameContaining,
		at: query.at,
	});
}

/** Hold a predicate against the one element the query resolved to. */
async function holds(
	tool: string,
	query: ElementQuery,
	found: HTML.Element,
	predicate: Predicate,
	session: string,
): Promise<Result<Value, SpecError>> {
	if (predicate.kind === "present") return success(found.text);
	if (predicate.kind === "in_viewport") return await inViewport(query, found, session);
	if (predicate.kind === "value") {
		if ((found.value ?? "") === predicate.value) return success(true);
		return failure(
			new ExpectationError(
				`${describeQuery(query)} carries the value ${formatValue(found.value ?? "")}, not ${formatValue(predicate.value)}`,
				predicate.value,
				found.value ?? null,
			),
		);
	}
	if (predicate.kind === "attribute") {
		let observed = found.attributes[predicate.name];
		if (observed === predicate.value) return success(true);
		let carried =
			observed === undefined
				? `carries no ${predicate.name} attribute`
				: `carries ${predicate.name}=${formatValue(observed)}`;
		return failure(
			new ExpectationError(
				`${describeQuery(query)} ${carried}, not ${formatValue(predicate.value)}`,
				predicate.value,
				observed ?? null,
			),
		);
	}
	if (predicate.kind === "state") {
		if (found.disabled !== predicate.enabled) return success(true);
		let wanted = predicate.enabled ? "enabled" : "disabled";
		return failure(
			new ExpectationError(
				`${describeQuery(query)} is not ${wanted}`,
				wanted,
				found.disabled ? "disabled" : "enabled",
			),
		);
	}
	return success(true);
}

/**
 * The one predicate only a live browser answers: whether the element the query
 * addressed is inside the part of the page a person is looking at.
 */
async function inViewport(
	query: ElementQuery,
	found: HTML.Element,
	session: string,
): Promise<Result<Value, SpecError>> {
	let script = [
		"(() => {",
		`	let element = document.querySelector(${JSON.stringify(selectorFor(found))});`,
		"	if (element === null) return false;",
		"	let box = element.getBoundingClientRect();",
		"	return box.bottom > 0 && box.right > 0",
		"		&& box.top < window.innerHeight && box.left < window.innerWidth;",
		"})()",
	].join("\n");
	let response = await runBrowser(["eval", script], session);
	if (isFailure(response)) return response;
	if (response.data.result === true) return success(true);
	return failure(
		new ExpectationError(`${describeQuery(query)} is not scrolled into view`, true, false),
	);
}

/** Count what the query matched, the one predicate that takes a set. */
function counted(
	tool: string,
	doc: HTML,
	query: ElementQuery,
	expected: number,
): Result<Value, SpecError> {
	let matches =
		query.kind === "field"
			? doc.queryAll().filter((found) => found.attributes["name"] === query.field)
			: doc.queryAll({
					role: query.role,
					name: query.name,
					nameContaining: query.nameContaining,
				});
	if (matches.length === expected) return success(true);
	return failure(
		new ExpectationError(
			`${tool} found ${matches.length} matches for ${describeQuery(query)}, not ${expected}`,
			expected,
			matches.length,
		),
	);
}

/**
 * Put a lookup's failure into the shared vocabulary: several matches ask which
 * one, and no match names what the page held under the same lookup and which
 * roles carry the name that was asked for.
 */
function missed(tool: string, doc: HTML, query: ElementQuery, error: HTMLQueryError): SpecError {
	if (error instanceof HTMLAmbiguousMatchError) {
		return ambiguousMatch(tool, query, error.candidates);
	}
	if (query.kind === "cell" || query.kind === "definition") {
		let reported = new ExpectationError(
			`${tool} could not read ${describeQuery(query)}: ${error.message}`,
			describeQuery(query),
			null,
		);
		reported.remedy = "Add `exists` where the absence is what the test is about.";
		return reported;
	}
	return noMatch(tool, query, { names: error.available, roles: rolesCarrying(doc, query) });
}

/**
 * The roles carrying the name that was asked for — the same name under the
 * wrong role, which is half of the near-match diagnosis. Generic elements are
 * left out: a wrapper inherits the name of what it wraps.
 */
function rolesCarrying(doc: HTML, query: ElementQuery): string[] {
	if (query.kind !== "role" || query.name === undefined) return [];
	let roles = new Set<string>();
	for (let found of doc.queryAll({ name: query.name })) {
		if (found.role === undefined || found.role === "generic") continue;
		if (found.role === query.role) continue;
		roles.add(found.role);
	}
	return [...roles];
}

/**
 * Leave a person what they need to see a failure they cannot reproduce: where
 * the session was, and — when the run has an artifacts directory — a
 * screenshot and the accessibility tree the page actually exposed. A failed
 * write never worsens a failure, so every step here is best-effort.
 */
async function diagnose(
	error: SpecError,
	tool: string,
	session: string,
	context: ToolContext,
): Promise<SpecError> {
	let current = await currentUrl(session);
	if (isSuccess(current) && current.data !== "") error.hint = `The session is on ${current.data}`;
	if (context.artifacts === undefined) return error;

	let stem = `browser-${tool}-${context.run.nonce}`;
	let written: string[] = [];
	let image = await capture(stem, session);
	if (image !== undefined) {
		let path = await context.artifacts.write(`${stem}.png`, image);
		if (path !== undefined) written.push(path);
	}
	let tree = await runBrowser(["snapshot"], session);
	if (isSuccess(tree) && typeof tree.data.snapshot === "string") {
		let path = await context.artifacts.write(`${stem}.txt`, tree.data.snapshot);
		if (path !== undefined) written.push(path);
	}
	if (written.length > 0) error.artifacts = written;
	return error;
}

/** Screenshot the session, reading the bytes back so the store owns the file. */
async function capture(stem: string, session: string): Promise<Uint8Array | undefined> {
	let path = join(tmpdir(), `${stem}.png`);
	let shot = await runBrowser(["screenshot", path], session);
	if (isFailure(shot)) return undefined;
	try {
		let bytes = await readFile(path);
		await rm(path, { force: true });
		return bytes;
	} catch {
		return undefined;
	}
}

/** The parsed `--json` envelope every `agent-browser` command prints. */
interface BrowserEnvelope {
	/** Whether the command succeeded on its own terms. */
	success: boolean;
	/** The command's payload on success; shape varies per command. */
	data: Record<string, unknown> | null;
	/** The command's own account of a failure, when `success` is false. */
	error: string | null;
}

/**
 * Run one `agent-browser` command for a session and return its `data`
 * payload. A missing binary fails with an install hint (ADR-007 §4); success
 * is read from the envelope's `success` field, since the CLI exits 0 regardless.
 */
async function runBrowser(
	args: string[],
	session: string,
): Promise<Result<Record<string, unknown>, SpecError>> {
	if (browserBinaryPath() === null) {
		return failure(
			new ToolError(
				`the browser capability requires the "${BROWSER_BINARY}" CLI, which is not on PATH; install it globally with \`npm install -g agent-browser && agent-browser install\``,
			),
		);
	}
	let stdout: string;
	let stderr: string;
	try {
		[stdout, stderr] = await captureBrowser(["--session", session, ...args, "--json"]);
	} catch (error) {
		return failure(
			new ToolError(
				`browser failed to run "${BROWSER_BINARY} ${args[0]}": ${describeError(error)}`,
			),
		);
	}
	let envelope = parseEnvelope(stdout);
	if (envelope === null) {
		let detail = stderr.trim().length > 0 ? stderr.trim() : stdout.trim();
		return failure(
			new ToolError(
				`browser could not parse the "${args[0]}" response from ${BROWSER_BINARY}: ${detail}`,
			),
		);
	}
	if (!envelope.success) {
		return failure(
			new ToolError(
				`browser ${args[0]} failed: ${envelope.error ?? "unknown agent-browser error"}`,
			),
		);
	}
	return success(envelope.data ?? {});
}

/**
 * Locate the trusted `agent-browser` CLI by scanning PATH for an executable
 * of that name, the way a shell would. The resolved path stays useful for
 * diagnostics; `null` is the single signal every caller treats as "not installed".
 *
 * @returns The absolute path of the binary, or null when it is not installed.
 */
export function browserBinaryPath(): string | null {
	if (BROWSER_BINARY.includes(sep)) return executable(BROWSER_BINARY);
	for (let directory of (process.env.PATH ?? "").split(delimiter)) {
		if (directory === "") continue;
		let found = executable(join(directory, BROWSER_BINARY));
		if (found !== null) return found;
	}
	return null;
}

/** The path back, when it names a file this process may execute; null otherwise. */
function executable(path: string): string | null {
	try {
		accessSync(path, constants.X_OK);
		return path;
	} catch {
		return null;
	}
}

/**
 * Run the browser CLI to completion and collect both output streams. Success
 * is read from the JSON envelope, since `agent-browser` exits 0 even when a
 * command fails.
 *
 * @param args - Arguments to pass after the binary name.
 * @returns The child's stdout and stderr, decoded as UTF-8.
 * @throws When the binary cannot be started.
 */
async function captureBrowser(args: string[]): Promise<[string, string]> {
	let child = spawn(BROWSER_BINARY, args, { stdio: ["ignore", "pipe", "pipe"] });
	let stdout = "";
	let stderr = "";
	child.stdout?.setEncoding("utf8");
	child.stderr?.setEncoding("utf8");
	child.stdout?.on("data", (chunk: string) => void (stdout += chunk));
	child.stderr?.on("data", (chunk: string) => void (stderr += chunk));
	await new Promise<void>((settle, reject) => {
		child.once("error", reject);
		child.once("close", () => settle());
	});
	return [stdout, stderr];
}

/** Parse one `agent-browser --json` line, returning null when it is not the envelope. */
function parseEnvelope(stdout: string): BrowserEnvelope | null {
	let trimmed = stdout.trim();
	if (trimmed.length === 0) return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		return null;
	}
	if (typeof parsed !== "object" || parsed === null) return null;
	let candidate = parsed as { success?: unknown; data?: unknown; error?: unknown };
	if (typeof candidate.success !== "boolean") return null;
	let data =
		typeof candidate.data === "object" && candidate.data !== null && !Array.isArray(candidate.data)
			? (candidate.data as Record<string, unknown>)
			: null;
	let error = typeof candidate.error === "string" ? candidate.error : null;
	return { success: candidate.success, data, error };
}

/**
 * The `agent-browser` session name for a test: the basename of its isolated
 * workspace directory, unique per test and stable across its phases — so
 * session lifetime follows the workspace (ADR-005's browser-isolation answer).
 */
function sessionFor(workspace: Workspace): string {
	return basename(workspace.root);
}

/** The port a URL reaches: its own, or the scheme default (80/443). */
function portOf(target: URL): number {
	if (target.port !== "") return Number(target.port);
	return target.protocol === "https:" ? 443 : 80;
}

/**
 * Extract a required string argument, failing with the tool's usage when the
 * argument is missing, a bare word, or not a string.
 */
function stringArg(
	args: ToolArg[],
	index: number,
	tool: string,
	name: string,
): Result<string, ToolError> {
	let arg = args[index];
	if (arg === undefined || arg.kind !== "value" || typeof arg.value !== "string") {
		return failure(
			new ToolError(
				`browser.${tool} expects a string for its ${name} argument (position ${index + 1})`,
			),
		);
	}
	return success(arg.value);
}

/**
 * Extract a required whole-number argument, failing with the tool's usage when
 * the argument is missing, a bare word, or not a whole number.
 */
function numberArg(
	args: ToolArg[],
	index: number,
	tool: string,
	name: string,
): Result<number, ToolError> {
	let arg = args[index];
	if (
		arg === undefined ||
		arg.kind !== "value" ||
		typeof arg.value !== "number" ||
		!Number.isInteger(arg.value)
	) {
		return failure(
			new ToolError(
				`browser.${tool} expects a whole number for its ${name} argument (position ${index + 1})`,
			),
		);
	}
	return success(arg.value);
}

/**
 * Extract a bare-word argument and validate it against the tool's accepted
 * words, naming them all on any mismatch — exactly as `fs` validates `exists`.
 */
function wordArg(
	args: ToolArg[],
	index: number,
	tool: string,
	accepted: string[],
): Result<string, ToolError> {
	let arg = args[index];
	if (arg === undefined || arg.kind !== "word") {
		return failure(
			new ToolError(
				`browser.${tool} expects a bare word as argument ${index + 1}; accepted words: ${accepted.join(", ")}`,
			),
		);
	}
	if (!accepted.includes(arg.word)) {
		return failure(
			new ToolError(
				`browser.${tool} does not understand the word "${arg.word}"; accepted words: ${accepted.join(", ")}`,
			),
		);
	}
	return success(arg.word);
}

/** Render an unknown thrown value as a one-line message. */
function describeError(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}
