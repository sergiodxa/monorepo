/**
 * The built-in `browser` capability: drive a real web browser through the
 * accessibility tree, not through DOM implementation details. Every tool maps
 * onto the globally-installed `agent-browser` CLI — `open` navigates, element
 * interactions read the accessibility snapshot and act on the node found by
 * role and accessible name, and CSS selectors survive only as a marked escape
 * hatch. Reaching web content is the privileged act, so the whole family is
 * gated by the `net` permission; the fixed `agent-browser` binary is trusted
 * plugin machinery, not spec-requested process execution, so it needs no
 * `run` grant (ADR-007 §4).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { basename } from "node:path";

import type { Result } from "@pkg/result";

import { failure, isFailure, success } from "@pkg/result";

import type { SpecError } from "../errors";
import type { Plugin, ToolContext, ToolDescriptor } from "../plugin";
import type { ToolArg, Value } from "../values";
import type { Workspace } from "../workspace";

import { ExpectationError, ToolError } from "../errors";
import { formatValue } from "../values";

/** The trusted CLI binary every browser tool shells out to. */
const BROWSER_BINARY = "agent-browser";

/** The word `browser.fill` requires between the target and the value. */
const FILL_WORDS = ["with"];

/** The word `browser.checkbox` requires as its state assertion. */
const CHECKBOX_WORDS = ["checked"];

/** The word `browser.cookie` requires before the URL it scopes a cookie to. */
const COOKIE_WORDS = ["for"];

/** The word `browser.heading` requires before a heading level. */
const LEVEL_WORDS = ["level"];

/**
 * One line of an accessibility snapshot naming a heading, its accessible name,
 * and its level: `- heading "Reports" [level=3, ref=e2]`. The level lives in
 * the snapshot text rather than in the `refs` map, so matching by level reads
 * the text.
 */
const HEADING_LINE = /^\s*-\s*heading\s+"((?:[^"\\]|\\.)*)"\s*\[([^\]]*)\]/;

/** The `level=N` attribute inside a snapshot line's bracketed attribute list. */
const LEVEL_ATTRIBUTE = /\blevel=(\d+)\b/;

/** Descriptors of every tool the `browser` namespace exposes. */
const BROWSER_TOOLS: ToolDescriptor[] = [
	{
		name: "open",
		summary: "Navigate the browser session to an absolute URL.",
		kind: "action",
		requires: "net",
		params: [
			{
				name: "url",
				kind: "value",
				required: true,
				summary: "Absolute URL to open; v1 has no environments to bind a base URL against.",
			},
		],
	},
	{
		name: "navigate",
		summary: "Navigate the current browser session to another absolute URL.",
		kind: "action",
		requires: "net",
		params: [
			{
				name: "url",
				kind: "value",
				required: true,
				summary: "Absolute URL to navigate to; must be absolute, like `open`.",
			},
		],
	},
	{
		name: "cookie",
		summary: 'Set a cookie on the session: `cookie "session" token for "https://app.test"`.',
		kind: "action",
		requires: "net",
		params: [
			{ name: "name", kind: "value", required: true, summary: "Name of the cookie to set." },
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
				summary: "Absolute URL the cookie is scoped to; defaults to the page already open.",
			},
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
		summary: "Click the element with the given role and accessible name.",
		kind: "action",
		requires: "net",
		params: [
			{
				name: "role",
				kind: "word",
				required: true,
				summary: "Accessibility role of the element, e.g. `button` or `link`.",
			},
			{
				name: "name",
				kind: "value",
				required: true,
				summary: 'Accessible name the user perceives, e.g. "Sign in".',
			},
		],
	},
	{
		name: "fill",
		summary: 'Fill a field addressed by role and name: `fill textbox "Email" with "x"`.',
		kind: "action",
		requires: "net",
		params: [
			{
				name: "role",
				kind: "word",
				required: true,
				summary: "Accessibility role of the field, typically `textbox`.",
			},
			{
				name: "name",
				kind: "value",
				required: true,
				summary: "Accessible name (label) of the field.",
			},
			{
				name: "with",
				kind: "word",
				required: true,
				summary: "The literal word `with`, separating the field from its value.",
			},
			{
				name: "value",
				kind: "value",
				required: true,
				summary: "The text to type into the field.",
			},
		],
	},
	{
		name: "check",
		summary: "Check a checkbox addressed by role and accessible name.",
		kind: "action",
		requires: "net",
		params: [
			{
				name: "role",
				kind: "word",
				required: true,
				summary: "Accessibility role, typically `checkbox`.",
			},
			{
				name: "name",
				kind: "value",
				required: true,
				summary: "Accessible name of the checkbox.",
			},
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
	{
		name: "heading",
		summary: 'Observe a heading by accessible name, optionally at a level: `heading "x" level 3`.',
		kind: "observable",
		requires: "net",
		params: [
			{ name: "name", kind: "value", required: true, summary: "Accessible name of the heading." },
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
		],
	},
	{
		name: "link",
		summary: "Observe that a link with the given accessible name is present.",
		kind: "observable",
		requires: "net",
		params: [
			{ name: "name", kind: "value", required: true, summary: "Accessible name of the link." },
		],
	},
	{
		name: "button",
		summary: "Observe that a button with the given accessible name is present.",
		kind: "observable",
		requires: "net",
		params: [
			{ name: "name", kind: "value", required: true, summary: "Accessible name of the button." },
		],
	},
	{
		name: "text",
		summary: "Observe that the given text is visible anywhere on the page.",
		kind: "observable",
		requires: "net",
		params: [
			{
				name: "substring",
				kind: "value",
				required: true,
				summary: "Substring to look for in the page's visible text.",
			},
		],
	},
	{
		name: "checkbox",
		summary: 'Assert a checkbox\'s state: `expect browser.checkbox "Remember me" checked`.',
		kind: "observable",
		requires: "net",
		params: [
			{ name: "name", kind: "value", required: true, summary: "Accessible name of the checkbox." },
			{
				name: "state",
				kind: "word",
				required: true,
				summary: "The word `checked`, the state being asserted.",
			},
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
				summary: "When given, the absolute URL the current location must equal.",
			},
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
				summary: "When given, the title the document must have.",
			},
		],
	},
];

/**
 * Create the built-in `browser` plugin: the `browser` namespace of
 * accessibility-first web-interaction tools backed by `agent-browser`.
 *
 * `describe()` is static — it never launches a browser — so a suite that never
 * touches `browser.*` costs nothing and never needs `agent-browser` installed.
 * Each tool call is a stateless `agent-browser` invocation keyed to a session
 * derived from the test's workspace, which gives every test its own isolated
 * browser (own cookies, storage, tabs) while letting `given`/`when`/`then`
 * share one session. The plugin tracks the sessions it opened and closes them
 * in {@link Plugin.dispose}, called once by the runner after the whole run —
 * so browsers do not leak, and unrelated `agent-browser` sessions are left
 * untouched.
 */
export function createBrowserPlugin(): Plugin {
	// Sessions this plugin has driven, closed on dispose. A Set because the
	// same test's workspace yields the same session across its many calls.
	let sessions = new Set<string>();
	return {
		namespace: "browser",
		describe() {
			return BROWSER_TOOLS;
		},
		async call(tool, args, context) {
			let session = sessionFor(context.workspace);
			sessions.add(session);
			switch (tool) {
				case "open":
				case "navigate":
					return await navigate(tool, args, context, session);
				case "cookie":
					return await cookie(args, context, session);
				case "ua":
					return await userAgent(args, session);
				case "click":
					return await click(args, session);
				case "fill":
					return await fill(args, session);
				case "check":
					return await check(args, session);
				case "press":
					return await press(args, session);
				case "click_selector":
					return await clickSelector(args, session);
				case "heading":
					if (args.length > 1) return await headingAtLevel(args, session);
					return await roleObservable(tool, args, session);
				case "link":
				case "button":
					return await roleObservable(tool, args, session);
				case "text":
					return await text(args, session);
				case "checkbox":
					return await checkbox(args, session);
				case "url":
					return await url(args, session);
				case "title":
					return await title(args, session);
				default: {
					let names = BROWSER_TOOLS.map((descriptor) => descriptor.name).join(", ");
					return failure(new ToolError(`browser has no tool named "${tool}"; tools: ${names}`));
				}
			}
		},
		async dispose() {
			for (let session of sessions) {
				// Best-effort teardown: a failed close must never fail a run, and a
				// missing binary at dispose time is simply nothing left to close.
				await runBrowser(["close"], session);
			}
			sessions.clear();
		},
	};
}

/**
 * `browser.open`/`browser.navigate url` — require an absolute http(s) URL,
 * pass the scoped `net` check for its host and port, then navigate. Relative
 * URLs are refused with the v1 rationale (no environments mechanism yet),
 * mirroring the `http` plugin.
 */
async function navigate(
	tool: string,
	args: ToolArg[],
	context: ToolContext,
	session: string,
): Promise<Result<Value, SpecError>> {
	let target = readUrl(tool, args, 0);
	if (isFailure(target)) return target;
	let allowed = context.permissions.checkNet(target.data.hostname, portOf(target.data));
	if (isFailure(allowed)) return allowed;
	let response = await runBrowser(["open", target.data.href], session);
	if (isFailure(response)) return response;
	return success(null);
}

/**
 * `browser.cookie name value [for url]` — seed the session's cookie jar, so a
 * spec can arrive already authenticated instead of driving a sign-in form for
 * every test. The value belongs in the environment, not in the document: the
 * intended shape is `let token = env.get "SESSION_COOKIE"` and a boxed
 * reference to it here (ADR-007 §6).
 *
 * The `for` clause names the URL the cookie is scoped to, which is what lets
 * the cookie be set _before_ the first navigation — the whole point of seeding
 * a session. Its host is `net`-checked exactly like `open`'s. Without the
 * clause the cookie lands on the page already open, and an unopened session is
 * a tool error naming the `for` form rather than a cookie set on `about:blank`.
 */
async function cookie(
	args: ToolArg[],
	context: ToolContext,
	session: string,
): Promise<Result<Value, SpecError>> {
	if (args.length !== 2 && args.length !== 4) {
		return failure(
			new ToolError(
				'browser.cookie takes a name and a value, optionally followed by `for "<url>"`',
			),
		);
	}
	let name = stringArg(args, 0, "cookie", "name");
	if (isFailure(name)) return name;
	let value = stringArg(args, 1, "cookie", "value");
	if (isFailure(value)) return value;
	let scope: string;
	if (args.length === 4) {
		let separator = wordArg(args, 2, "cookie", COOKIE_WORDS);
		if (isFailure(separator)) return separator;
		let target = readUrl("cookie", args, 3);
		if (isFailure(target)) return target;
		let allowed = context.permissions.checkNet(target.data.hostname, portOf(target.data));
		if (isFailure(allowed)) return allowed;
		scope = target.data.href;
	} else {
		// The page the session is already on authorized itself at `open` time,
		// so no second net check: this is the same host the spec just reached.
		let current = await currentUrl(session);
		if (isFailure(current)) return current;
		if (!current.data.startsWith("http:") && !current.data.startsWith("https:")) {
			return failure(
				new ToolError(
					'browser.cookie has no page to scope the cookie to; open one first, or name the URL: browser.cookie "session" token for "https://app.example.com"',
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
 * `browser.ua value` — send a custom `User-Agent` on every request the session
 * makes from here on, so an app can tell a spec run apart from a real visitor
 * (skip its rate limiter, tag its analytics). Set it before `open`: the header
 * applies to requests made after it, not to a page already fetched.
 *
 * This sets the request header only; `navigator.userAgent` inside the page
 * still reports the real browser, because the header is applied to the session
 * rather than to the emulated browser identity.
 */
async function userAgent(args: ToolArg[], session: string): Promise<Result<Value, SpecError>> {
	let value = stringArg(args, 0, "ua", "value");
	if (isFailure(value)) return value;
	let headers = JSON.stringify({ "User-Agent": value.data });
	let response = await runBrowser(["set", "headers", headers], session);
	if (isFailure(response)) return response;
	return success(null);
}

/** `browser.click role name` — act on the node found by role and name. */
async function click(args: ToolArg[], session: string): Promise<Result<Value, SpecError>> {
	let target = readTarget("click", args, 0);
	if (isFailure(target)) return target;
	let ref = await resolveElement(target.data.role, target.data.name, session);
	if (isFailure(ref)) return ref;
	if (ref.data === null) return failure(notFound("click", target.data));
	let response = await runBrowser(["click", `@${ref.data}`], session);
	if (isFailure(response)) return response;
	return success(null);
}

/** `browser.fill role name with value` — type into the field found by role and name. */
async function fill(args: ToolArg[], session: string): Promise<Result<Value, SpecError>> {
	let target = readTarget("fill", args, 0);
	if (isFailure(target)) return target;
	let separator = wordArg(args, 2, "fill", FILL_WORDS);
	if (isFailure(separator)) return separator;
	let value = stringArg(args, 3, "fill", "value");
	if (isFailure(value)) return value;
	let ref = await resolveElement(target.data.role, target.data.name, session);
	if (isFailure(ref)) return ref;
	if (ref.data === null) return failure(notFound("fill", target.data));
	let response = await runBrowser(["fill", `@${ref.data}`, value.data], session);
	if (isFailure(response)) return response;
	return success(null);
}

/** `browser.check role name` — check the checkbox found by role and name. */
async function check(args: ToolArg[], session: string): Promise<Result<Value, SpecError>> {
	let target = readTarget("check", args, 0);
	if (isFailure(target)) return target;
	let ref = await resolveElement(target.data.role, target.data.name, session);
	if (isFailure(ref)) return ref;
	if (ref.data === null) return failure(notFound("check", target.data));
	let response = await runBrowser(["check", `@${ref.data}`], session);
	if (isFailure(response)) return response;
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
 * `browser.heading|link|button name` — assert a node of that role and
 * accessible name is present. Present yields `true`; absent yields an
 * `ExpectationError` carrying the demanded role/name, so `expect` renders
 * expected/observed the same way `fs.file` does.
 */
async function roleObservable(
	tool: string,
	args: ToolArg[],
	session: string,
): Promise<Result<Value, SpecError>> {
	let name = stringArg(args, 0, tool, "name");
	if (isFailure(name)) return name;
	let ref = await resolveElement(tool, name.data, session);
	if (isFailure(ref)) return ref;
	if (ref.data === null) {
		return failure(
			new ExpectationError(
				`no ${tool} named ${formatValue(name.data)} is present`,
				`${tool} ${formatValue(name.data)}`,
				null,
			),
		);
	}
	return success(true);
}

/**
 * `browser.heading name level N` — assert a heading with that accessible name
 * is present *at that level*, so a spec can say which rung of the document
 * outline it means: level 3 matches an `<h3>` and equally a `role=heading`
 * carrying `aria-level=3`, because both reach the accessibility tree the same
 * way. A heading of the right name at the wrong level fails with the levels it
 * did find, since that is usually the bug being caught.
 */
async function headingAtLevel(args: ToolArg[], session: string): Promise<Result<Value, SpecError>> {
	if (args.length !== 3) {
		return failure(
			new ToolError("browser.heading takes an accessible name, optionally followed by `level <n>`"),
		);
	}
	let name = stringArg(args, 0, "heading", "name");
	if (isFailure(name)) return name;
	let separator = wordArg(args, 1, "heading", LEVEL_WORDS);
	if (isFailure(separator)) return separator;
	let level = levelArg(args, 2);
	if (isFailure(level)) return level;
	let response = await runBrowser(["snapshot"], session);
	if (isFailure(response)) return response;
	let text = typeof response.data.snapshot === "string" ? response.data.snapshot : "";
	let wanted = normalizeName(name.data);
	let found: number[] = [];
	for (let line of text.split("\n")) {
		let heading = HEADING_LINE.exec(line);
		if (heading === null) continue;
		let [, quoted = "", attributes = ""] = heading;
		if (normalizeName(unescapeName(quoted)) !== wanted) continue;
		let attribute = LEVEL_ATTRIBUTE.exec(attributes);
		if (attribute === null) continue;
		let observed = Number(attribute[1]);
		if (observed === level.data) return success(true);
		found.push(observed);
	}
	let observed = found.length === 0 ? null : found.join(", ");
	return failure(
		new ExpectationError(
			found.length === 0
				? `no heading named ${formatValue(name.data)} is present`
				: `the heading named ${formatValue(name.data)} is not at level ${level.data}`,
			level.data,
			observed,
		),
	);
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

/** Undo the escaping an accessibility snapshot applies inside a quoted name. */
function unescapeName(quoted: string): string {
	return quoted.replace(/\\(.)/g, "$1");
}

/** `browser.text substring` — assert the substring is in the page's visible text. */
async function text(args: ToolArg[], session: string): Promise<Result<Value, SpecError>> {
	let substring = stringArg(args, 0, "text", "substring");
	if (isFailure(substring)) return substring;
	let response = await runBrowser(["get", "text", "body"], session);
	if (isFailure(response)) return response;
	let visible = typeof response.data.text === "string" ? response.data.text : "";
	if (visible.includes(substring.data)) return success(true);
	return failure(
		new ExpectationError(
			`the text ${formatValue(substring.data)} is not visible on the page`,
			substring.data,
			visible,
		),
	);
}

/**
 * `browser.checkbox name checked` — assert the named checkbox is checked. An
 * absent checkbox and an unchecked checkbox both fail with an
 * `ExpectationError`, one for the missing element and one for the wrong state.
 */
async function checkbox(args: ToolArg[], session: string): Promise<Result<Value, SpecError>> {
	let name = stringArg(args, 0, "checkbox", "name");
	if (isFailure(name)) return name;
	let state = wordArg(args, 1, "checkbox", CHECKBOX_WORDS);
	if (isFailure(state)) return state;
	let ref = await resolveElement("checkbox", name.data, session);
	if (isFailure(ref)) return ref;
	if (ref.data === null) {
		return failure(
			new ExpectationError(
				`no checkbox named ${formatValue(name.data)} is present`,
				`checkbox ${formatValue(name.data)}`,
				null,
			),
		);
	}
	let response = await runBrowser(["is", "checked", `@${ref.data}`], session);
	if (isFailure(response)) return response;
	if (response.data.checked === true) return success(true);
	return failure(
		new ExpectationError(`checkbox ${formatValue(name.data)} is not checked`, true, false),
	);
}

/**
 * `browser.url [expected]` — with no argument, observe the current URL; with
 * an argument, assert the current URL equals it exactly. v1 compares full
 * absolute URLs: there is no environments mechanism to resolve a path like
 * "/" against a base (ADR-008), consistent with `open` requiring absolute URLs.
 */
async function url(args: ToolArg[], session: string): Promise<Result<Value, SpecError>> {
	if (args.length > 1) {
		return failure(new ToolError("browser.url takes at most one argument: an expected URL"));
	}
	let current = await currentUrl(session);
	if (isFailure(current)) return current;
	if (args.length === 0) return success(current.data);
	let expected = stringArg(args, 0, "url", "expected");
	if (isFailure(expected)) return expected;
	if (current.data === expected.data) return success(true);
	return failure(
		new ExpectationError(
			`the current URL is not ${formatValue(expected.data)}`,
			expected.data,
			current.data,
		),
	);
}

/**
 * `browser.title [expected]` — with no argument, observe the document's title;
 * with an argument, assert it equals that title exactly. Titles are what the
 * user reads in the tab, so this compares them whole rather than by substring —
 * `browser.text` is the tool for "somewhere on the page".
 */
async function title(args: ToolArg[], session: string): Promise<Result<Value, SpecError>> {
	if (args.length > 1) {
		return failure(new ToolError("browser.title takes at most one argument: an expected title"));
	}
	let response = await runBrowser(["get", "title"], session);
	if (isFailure(response)) return response;
	let current = typeof response.data.title === "string" ? response.data.title : "";
	if (args.length === 0) return success(current);
	let expected = stringArg(args, 0, "title", "expected");
	if (isFailure(expected)) return expected;
	if (current === expected.data) return success(true);
	return failure(
		new ExpectationError(
			`the page title is not ${formatValue(expected.data)}`,
			expected.data,
			current,
		),
	);
}

/** The session's current location, or the empty string when it has none. */
async function currentUrl(session: string): Promise<Result<string, SpecError>> {
	let response = await runBrowser(["get", "url"], session);
	if (isFailure(response)) return response;
	return success(typeof response.data.url === "string" ? response.data.url : "");
}

/** A role and accessible name naming one element to act on or observe. */
interface ElementTarget {
	/** Accessibility role, e.g. `button` or `textbox`. */
	role: string;
	/** Accessible name the user perceives. */
	name: string;
}

/**
 * Read a `role name` pair starting at `index`: a bare-word role (roles are an
 * open set, so any identifier is accepted) followed by a string name.
 */
function readTarget(
	tool: string,
	args: ToolArg[],
	index: number,
): Result<ElementTarget, SpecError> {
	let role = args[index];
	if (role === undefined || role.kind !== "word") {
		return failure(
			new ToolError(
				`browser.${tool} expects an accessibility role as a bare word for argument ${index + 1} (e.g. button, textbox)`,
			),
		);
	}
	let name = stringArg(args, index + 1, tool, "name");
	if (isFailure(name)) return name;
	return success({ role: role.word, name: name.data });
}

/**
 * Resolve one element to its snapshot ref by reading the accessibility tree
 * and matching on role and normalized accessible name. Returns the ref key
 * (e.g. `"e4"`) when a node matches, `null` when none does, or a failure when
 * `agent-browser` itself could not produce a snapshot.
 */
async function resolveElement(
	role: string,
	name: string,
	session: string,
): Promise<Result<string | null, SpecError>> {
	let response = await runBrowser(["snapshot", "-i"], session);
	if (isFailure(response)) return response;
	let refs = response.data.refs;
	if (typeof refs !== "object" || refs === null || Array.isArray(refs)) return success(null);
	let wanted = normalizeName(name);
	for (let [key, node] of Object.entries(refs as Record<string, unknown>)) {
		if (typeof node !== "object" || node === null) continue;
		let entry = node as { role?: unknown; name?: unknown };
		if (entry.role !== role) continue;
		if (typeof entry.name !== "string") continue;
		if (normalizeName(entry.name) === wanted) return success(key);
	}
	return success(null);
}

/** An element the accessibility tree does not expose is a tool failure. */
function notFound(tool: string, target: ElementTarget): ToolError {
	return new ToolError(
		`browser.${tool} found no ${target.role} named ${formatValue(target.name)} in the accessibility tree`,
	);
}

/**
 * Normalize an accessible name for comparison: trim surrounding whitespace and
 * collapse internal runs to a single space, so a label rendered as
 * " Remember me" matches the spec's "Remember me".
 */
function normalizeName(name: string): string {
	return name.trim().replace(/\s+/g, " ");
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
 * Run one `agent-browser` command for a session and return its `data` payload.
 * The binary is trusted plugin machinery (ADR-007 §4), so this spawns it
 * directly without a `run` grant; a missing binary is a `ToolError` telling
 * the caller to install it. Because `agent-browser` exits 0 even on failure,
 * success is read from the JSON envelope's `success` field, never the exit code.
 */
async function runBrowser(
	args: string[],
	session: string,
): Promise<Result<Record<string, unknown>, SpecError>> {
	if (Bun.which(BROWSER_BINARY) === null) {
		return failure(
			new ToolError(
				`the browser capability requires the "${BROWSER_BINARY}" CLI, which is not on PATH; install it globally with \`npm install -g agent-browser && agent-browser install\``,
			),
		);
	}
	let command = [BROWSER_BINARY, "--session", session, ...args, "--json"];
	let stdout: string;
	let stderr: string;
	try {
		let child = Bun.spawn({ cmd: command, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
		[stdout, stderr] = await Promise.all([
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
			child.exited,
		]);
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
 * workspace directory, which is unique per test and stable across the test's
 * phases. This is the v1-provisional answer to ADR-005's browser-isolation
 * open question — session lifetime follows the workspace.
 */
function sessionFor(workspace: Workspace): string {
	return basename(workspace.root);
}

/** The absolute http(s) URL at `index`, or a tool error explaining why not. */
function readUrl(tool: string, args: ToolArg[], index: number): Result<URL, SpecError> {
	let raw = stringArg(args, index, tool, "url");
	if (isFailure(raw)) return raw;
	let parsed: URL;
	try {
		parsed = new URL(raw.data);
	} catch {
		return failure(
			new ToolError(
				`browser.${tool} received the relative URL ${formatValue(raw.data)}; v1 has no environments mechanism to bind a base URL against, so URLs must be absolute (see docs/adr/spec/ADR-008-environments-and-compatibility.md)`,
			),
		);
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		return failure(
			new ToolError(
				`browser.${tool} supports absolute http(s) URLs only; got ${formatValue(raw.data)}`,
			),
		);
	}
	return success(parsed);
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
