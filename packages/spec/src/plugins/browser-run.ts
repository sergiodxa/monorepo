/**
 * The `browser` capability backed by Cloudflare Browser Run: same tool surface
 * as the `agent-browser` plugin, with a CDP session so a Worker can drive a
 * real page. The binding is injected so this package never owns the remote
 * browser service (ADR-027 §9).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { HTMLQueryError } from "@sdxc/html";
import type { Result } from "@sdxc/result";

import { HTML, HTMLAmbiguousMatchError } from "@sdxc/html";
import { failure, isFailure, isSuccess, success } from "@sdxc/result";

import type { SpecError } from "../errors.js";
import type { Plugin, ToolContext, ToolDescriptor, ToolParam } from "../plugin.js";
import type { ToolArg, Value } from "../values.js";

import { ExpectationError, ToolError } from "../errors.js";
import { formatValue } from "../values.js";

import type { Assertion, ElementQuery, Predicate, QueryOptions } from "./addressing.js";
import type { BrowserRunBinding } from "./browser-run-cdp.js";

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
import { CdpSession } from "./browser-run-cdp.js";
import { nearMatches } from "./near-matches.js";

export type { BrowserRunBinding } from "./browser-run-cdp.js";

/** Options for {@link createBrowserRunPlugin}. */
export interface BrowserRunPluginOptions {
	/** The Browser Run binding that opens and closes sessions. */
	browser: BrowserRunBinding;
	/**
	 * Hostnames the session may reach. Passed to Browser Run guardrails so a
	 * flow cannot navigate outside the team's verified domains even if a grant
	 * check were skipped.
	 */
	allowedDomains?: readonly string[];
	/** Idle session lifetime in milliseconds. @default 60000 */
	keepAliveMs?: number;
}

/** The word `browser.heading` requires before a heading level. */
const LEVEL_WORDS = ["level"];

/** The word `browser.checkbox` takes as its state assertion. */
const CHECKED_WORDS = ["checked"];

/** The word that selects which configured base a relative target resolves against. */
const BASE_WORDS = ["on"];

/** Attribute the page-side reader stamps so a parsed match names a live node. */
const ELEMENT_MARKER = "data-spec-element";

/**
 * The page-side script that hands the live document over as markup. Shared
 * shape with the `agent-browser` plugin so both backends address one vocabulary.
 */
const READ_DOCUMENT = [
	"(() => {",
	"	let index = 0;",
	"	let marked = [];",
	'	for (let element of document.querySelectorAll("*")) {',
	`		element.setAttribute(${JSON.stringify(ELEMENT_MARKER)}, String(index++));`,
	"		let rendered =",
	"			element.checkVisibility({ visibilityProperty: true }) ||",
	'			getComputedStyle(element).display === "contents";',
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

/** The accessible name a role lookup matches. */
const NAME_PARAM: ToolParam = {
	name: "name",
	kind: "value",
	required: false,
	summary: "The accessible name, matched whole; a `field` takes its `name` attribute.",
};

/** The head every element lookup opens with, where the tool's name fixes none. */
const ROLE_PARAM: ToolParam = {
	name: "role",
	kind: "word",
	required: true,
	summary: "The ARIA role, e.g. `button`, `link`, `textbox` — or the word `field`.",
};

/** Descriptors of the tools this Browser Run backend implements. */
const BROWSER_RUN_TOOLS: ToolDescriptor[] = [
	{
		name: "open",
		summary: 'Navigate the browser session to a target: `open "https://app.example.com/login"`.',
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
				summary: "A raw CSS selector; a marked pocket of implementation coupling.",
			},
		],
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
			{
				name: "expected",
				kind: "value",
				required: false,
				summary: "a substring the visible text must contain; `exactly` demands the whole of it",
			},
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
		name: "url",
		summary: "Observe the session's current URL, or assert it equals an expected URL.",
		kind: "observable",
		requires: "net",
		params: [
			{
				name: "expected",
				kind: "value",
				required: false,
				summary: "the whole URL the current location must equal",
			},
			...ASSERTION_PARAMS,
		],
	},
	{
		name: "path",
		summary: 'Observe the current URL\'s path: `expect browser.path "/donate/share"`.',
		kind: "observable",
		requires: "net",
		params: [
			{
				name: "expected",
				kind: "value",
				required: false,
				summary: "the whole path the current location must equal",
			},
			...ASSERTION_PARAMS,
		],
	},
	{
		name: "title",
		summary: "Observe the page's title, or assert it equals an expected title.",
		kind: "observable",
		requires: "net",
		params: [
			{
				name: "expected",
				kind: "value",
				required: false,
				summary: "the whole title the document must carry",
			},
			...ASSERTION_PARAMS,
		],
	},
];

/**
 * Create the Browser Run–backed `browser` plugin. One CDP session is opened on
 * the first tool call and closed from {@link Plugin.dispose}.
 */
export function createBrowserRunPlugin(options: BrowserRunPluginOptions): Plugin {
	let session: CdpSession | undefined;
	let opening: Promise<Result<CdpSession, SpecError>> | undefined;

	async function ensureSession(): Promise<Result<CdpSession, SpecError>> {
		if (session !== undefined) return success(session);
		opening ??= CdpSession.open(options.browser, {
			keepAliveMs: options.keepAliveMs,
			allowedDomains: options.allowedDomains,
		});
		let opened = await opening;
		opening = undefined;
		if (isFailure(opened)) return opened;
		session = opened.data;
		return success(session);
	}

	return {
		namespace: "browser",
		describe() {
			return BROWSER_RUN_TOOLS;
		},
		async call(tool, args, context) {
			let ensured = await ensureSession();
			if (isFailure(ensured)) return ensured;
			let active = ensured.data;
			switch (tool) {
				case "open":
				case "navigate":
					return await navigate(tool, args, context, active);
				case "reload":
					return await reload(args, active);
				case "click":
				case "check":
				case "uncheck":
					return await interact(tool, args, context, active);
				case "fill":
				case "type":
					return await write(tool, args, context, active);
				case "press":
					return await press(args, active);
				case "click_selector":
					return await clickSelector(args, active);
				case "element":
					return await observeElement(tool, args, context, active, {});
				case "heading":
					return await heading(args, context, active);
				case "link":
				case "button":
					return await observeElement(tool, args, context, active, {
						head: { kind: "role", role: tool },
					});
				case "checkbox":
					return await checkbox(args, context, active);
				case "text":
					return await text(args, active);
				case "url":
				case "path":
				case "title":
					return await reading(tool, args, active);
				default: {
					let names = BROWSER_RUN_TOOLS.map((descriptor) => descriptor.name).join(", ");
					return failure(
						new ToolError(
							`browser has no tool named "${tool}" on the Browser Run backend; tools: ${names}`,
						),
					);
				}
			}
		},
		async dispose() {
			if (session === undefined) return;
			await session.close();
			session = undefined;
		},
	};
}

/** The parameters `open` and `navigate` share. */
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

/** The text `fill … with` and `type … with` put into the control they addressed. */
function textParam(effect: string): ToolParam {
	return {
		name: "text",
		kind: "value",
		required: false,
		summary: `The text this ${effect} into the addressed control.`,
	};
}

/** `browser.open` / `browser.navigate` — resolve, grant-check, then navigate. */
async function navigate(
	tool: string,
	args: ToolArg[],
	context: ToolContext,
	session: CdpSession,
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
	let navigated = await session.navigate(resolved.data.href);
	if (isFailure(navigated)) return navigated;
	return success(null);
}

/** `browser.reload`. */
async function reload(args: ToolArg[], session: CdpSession): Promise<Result<Value, SpecError>> {
	if (args.length > 0) {
		return failure(new ToolError("browser.reload takes no arguments"));
	}
	let reloaded = await session.reload();
	if (isFailure(reloaded)) return reloaded;
	return success(null);
}

/** `browser.click|check|uncheck <query>`. */
async function interact(
	tool: string,
	args: ToolArg[],
	context: ToolContext,
	session: CdpSession,
): Promise<Result<Value, SpecError>> {
	let found = await address(tool, args, context, session, {});
	if (isFailure(found)) return found;
	let selector = selectorFor(found.data);
	if (tool === "click") return await clickInView(selector, session);
	let script = tool === "check" ? toggleScript(selector, true) : toggleScript(selector, false);
	let evaluated = await session.evaluate(script);
	if (isFailure(evaluated)) return evaluated;
	if (evaluated.data !== true) {
		return failure(new ToolError(`browser.${tool} could not reach the control it addressed`));
	}
	return success(null);
}

/** Scroll into view when needed, then click the element's centre. */
async function clickInView(
	selector: string,
	session: CdpSession,
): Promise<Result<Value, SpecError>> {
	let script = [
		"(() => {",
		`	let element = document.querySelector(${JSON.stringify(selector)});`,
		"	if (element === null) return false;",
		"	let box = element.getBoundingClientRect();",
		"	let x = box.left + box.width / 2;",
		"	let y = box.top + box.height / 2;",
		"	let visible = x >= 0 && y >= 0 && x < innerWidth && y < innerHeight;",
		"	let hit = visible ? document.elementFromPoint(x, y) : null;",
		"	let reachable = hit !== null && (hit === element || element.contains(hit));",
		'	if (!reachable) element.scrollIntoView({ block: "center", inline: "center" });',
		"	element.click();",
		"	return true;",
		"})()",
	].join("\n");
	let evaluated = await session.evaluate(script);
	if (isFailure(evaluated)) return evaluated;
	if (evaluated.data !== true) {
		return failure(new ToolError("browser.click could not reach the element it addressed"));
	}
	return success(null);
}

/** Page-side script that checks or unchecks an input. */
function toggleScript(selector: string, checked: boolean): string {
	return [
		"(() => {",
		`	let element = document.querySelector(${JSON.stringify(selector)});`,
		"	if (element === null || !(element instanceof HTMLInputElement)) return false;",
		`	if (element.checked === ${checked}) return true;`,
		"	element.click();",
		"	return true;",
		"})()",
	].join("\n");
}

/** `browser.fill` / `browser.type`. */
async function write(
	tool: string,
	args: ToolArg[],
	context: ToolContext,
	session: CdpSession,
): Promise<Result<Value, SpecError>> {
	let parsed = parseFill(`browser.${tool}`, args);
	if (isFailure(parsed)) return parsed;
	let found = await resolve(tool, parsed.data.query, context, session);
	if (isFailure(found)) return found;
	let selector = selectorFor(found.data);
	let script =
		tool === "type"
			? typeScript(selector, parsed.data.text)
			: fillScript(selector, parsed.data.text);
	let evaluated = await session.evaluate(script);
	if (isFailure(evaluated)) return evaluated;
	if (evaluated.data !== true) {
		return failure(
			new ToolError(`browser.${tool} could not put a value into the control it addressed`),
		);
	}
	return success(null);
}

/** Replace a control's value the way the platform does. */
function fillScript(selector: string, text: string): string {
	return [
		"(() => {",
		`	let element = document.querySelector(${JSON.stringify(selector)});`,
		"	if (element === null) return false;",
		"	element.focus();",
		"	if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {",
		'		let descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");',
		"		if (descriptor === undefined || descriptor.set === undefined) return false;",
		`		descriptor.set.call(element, ${JSON.stringify(text)});`,
		'		element.dispatchEvent(new Event("input", { bubbles: true }));',
		'		element.dispatchEvent(new Event("change", { bubbles: true }));',
		"		return true;",
		"	}",
		"	return false;",
		"})()",
	].join("\n");
}

/** Append keystrokes to a control. */
function typeScript(selector: string, text: string): string {
	return [
		"(() => {",
		`	let element = document.querySelector(${JSON.stringify(selector)});`,
		"	if (element === null) return false;",
		"	element.focus();",
		"	if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {",
		`		element.value = element.value + ${JSON.stringify(text)};`,
		'		element.dispatchEvent(new Event("input", { bubbles: true }));',
		"		return true;",
		"	}",
		"	return false;",
		"})()",
	].join("\n");
}

/** `browser.press key`. */
async function press(args: ToolArg[], session: CdpSession): Promise<Result<Value, SpecError>> {
	let key = stringArg(args, 0, "press", "key");
	if (isFailure(key)) return key;
	let pressed = await session.press(key.data);
	if (isFailure(pressed)) return pressed;
	return success(null);
}

/** `browser.click_selector`. */
async function clickSelector(
	args: ToolArg[],
	session: CdpSession,
): Promise<Result<Value, SpecError>> {
	let selector = stringArg(args, 0, "click_selector", "selector");
	if (isFailure(selector)) return selector;
	return await clickInView(selector.data, session);
}

/** `browser.heading` with optional level clause. */
async function heading(
	args: ToolArg[],
	context: ToolContext,
	session: CdpSession,
): Promise<Result<Value, SpecError>> {
	let options: QueryOptions = { head: { kind: "role", role: "heading" }, stopAt: LEVEL_WORDS };
	let parsed = parseQuery("browser.heading", args, options);
	if (isFailure(parsed)) return parsed;
	if (args[parsed.data.next] === undefined) {
		return await answer("heading", parsed.data.query, parsed.data.predicate, session);
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

/** A heading's level from aria-level or its tag. */
function headingLevel(found: HTML.Element): number | undefined {
	let claimed = Number(found.attributes["aria-level"]);
	if (Number.isInteger(claimed) && claimed > 0) return claimed;
	let tag = /^h([1-6])$/.exec(found.tag);
	return tag === null ? undefined : Number(tag[1]);
}

/** Read a heading level: a positive whole number. */
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

/** `browser.checkbox` with optional checked clause. */
async function checkbox(
	args: ToolArg[],
	context: ToolContext,
	session: CdpSession,
): Promise<Result<Value, SpecError>> {
	let options: QueryOptions = { head: { kind: "role", role: "checkbox" }, stopAt: CHECKED_WORDS };
	let parsed = parseQuery("browser.checkbox", args, options);
	if (isFailure(parsed)) return parsed;
	if (args[parsed.data.next] === undefined) {
		return await answer("checkbox", parsed.data.query, parsed.data.predicate, session);
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

/** `browser.text`. */
async function text(args: ToolArg[], session: CdpSession): Promise<Result<Value, SpecError>> {
	let assertion = parseAssertion("browser.text", args, 0, "substring");
	if (isFailure(assertion)) return assertion;
	let evaluated = await session.evaluate('document.body ? document.body.innerText : ""');
	if (isFailure(evaluated)) return evaluated;
	let visible = typeof evaluated.data === "string" ? evaluated.data : "";
	return assert("text", "visible text", visible, assertion.data);
}

/** `browser.url|path|title`. */
async function reading(
	tool: string,
	args: ToolArg[],
	session: CdpSession,
): Promise<Result<Value, SpecError>> {
	let assertion = parseAssertion(`browser.${tool}`, args, 0, "exact");
	if (isFailure(assertion)) return assertion;
	if (tool === "title") {
		let title = await session.title();
		if (isFailure(title)) return title;
		return assert(tool, "page title", title.data, assertion.data);
	}
	let current = await location(tool, session);
	if (isFailure(current)) return current;
	let observed = tool === "path" ? current.data.pathname : current.data.href;
	return assert(tool, tool === "path" ? "path" : "current URL", observed, assertion.data);
}

/** The session's location as a URL. */
async function location(tool: string, session: CdpSession): Promise<Result<URL, SpecError>> {
	let current = await session.currentUrl();
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

/** Answer a value-reading observable. */
function assert(
	tool: string,
	label: string,
	observed: string | undefined,
	assertion: Assertion,
	available: readonly string[] = [],
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

/** Read an optional `on "<base>"` clause. */
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

/** Resolve a target and clear it for the network. */
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

/** The CSS selector that reaches the live node one parsed match came from. */
function selectorFor(found: HTML.Element): string {
	return `[${ELEMENT_MARKER}="${found.attributes[ELEMENT_MARKER] ?? ""}"]`;
}

/** Parse an action's query and resolve it. */
async function address(
	tool: string,
	args: ToolArg[],
	context: ToolContext,
	session: CdpSession,
	options: QueryOptions,
): Promise<Result<HTML.Element, SpecError>> {
	let parsed = parseQuery(`browser.${tool}`, args, { ...options, predicates: "narrow" });
	if (isFailure(parsed)) return parsed;
	return await resolve(tool, parsed.data.query, context, session);
}

/** Resolve one query against the open page. */
async function resolve(
	tool: string,
	query: ElementQuery,
	context: ToolContext,
	session: CdpSession,
): Promise<Result<HTML.Element, SpecError>> {
	let document = await readDocument(session);
	if (isFailure(document)) return document;
	let found = look(document.data, query);
	if (isFailure(found)) {
		return failure(missed(`browser.${tool}`, document.data, query, found.error));
	}
	return success(found.data);
}

/** Read the open page as markup. */
async function readDocument(session: CdpSession): Promise<Result<HTML, SpecError>> {
	let evaluated = await session.evaluate(READ_DOCUMENT);
	if (isFailure(evaluated)) return evaluated;
	let markup = typeof evaluated.data === "string" ? evaluated.data : "";
	let document = HTML.parse(markup);
	if (isFailure(document)) {
		return failure(
			new ToolError(`browser could not read the open page as markup: ${document.error.message}`),
		);
	}
	return success(document.data);
}

/** `browser.element` and role-fixed observables. */
async function observeElement(
	tool: string,
	args: ToolArg[],
	context: ToolContext,
	session: CdpSession,
	options: QueryOptions,
): Promise<Result<Value, SpecError>> {
	let parsed = parseQuery(`browser.${tool}`, args, options);
	if (isFailure(parsed)) return parsed;
	return await answer(tool, parsed.data.query, parsed.data.predicate, session);
}

/** Hold one parsed query and its predicate against the open page. */
async function answer(
	tool: string,
	query: ElementQuery,
	predicate: Predicate,
	session: CdpSession,
): Promise<Result<Value, SpecError>> {
	let name = `browser.${tool}`;
	let document = await readDocument(session);
	if (isFailure(document)) return document;
	let doc = document.data;

	if (predicate.kind === "count") {
		return counted(name, doc, query, predicate.count);
	}
	let found = look(doc, query);
	if (predicate.kind === "exists") {
		if (isSuccess(found)) return success(true);
		return success(found.error instanceof HTMLAmbiguousMatchError);
	}
	if (isFailure(found)) {
		return failure(missed(name, doc, query, found.error));
	}
	return await holds(name, query, found.data, predicate, session);
}

/** Run the lookup the query's kind selects. */
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
	session: CdpSession,
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

/** Whether the element is inside the viewport. */
async function inViewport(
	query: ElementQuery,
	found: HTML.Element,
	session: CdpSession,
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
	let evaluated = await session.evaluate(script);
	if (isFailure(evaluated)) return evaluated;
	if (evaluated.data === true) return success(true);
	return failure(
		new ExpectationError(`${describeQuery(query)} is not scrolled into view`, true, false),
	);
}

/** Count what the query matched. */
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

/** Put a lookup's failure into the shared vocabulary. */
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
	return noMatch(tool, query, nearMatches(doc, query, error.available));
}

/** The port a URL reaches. */
function portOf(target: URL): number {
	if (target.port !== "") return Number(target.port);
	return target.protocol === "https:" ? 443 : 80;
}

/** Extract a required string argument. */
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

/** Extract a bare-word argument and validate it. */
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
