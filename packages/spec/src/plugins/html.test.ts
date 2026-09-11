/**
 * Tests for the built-in `html` plugin: every observable answered from a string
 * of markup, with no permission grant, no network and no browser. The
 * addressing rules themselves are specified in `addressing.test.ts`; these
 * check that this namespace answers them from a real document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { ArtifactStore } from "../artifacts.js";
import type { SpecError } from "../errors.js";
import type { ToolArg, Value } from "../values.js";

import { createToolContext } from "../tool-context.js";

import { createBrowserPlugin } from "./browser.js";
import { createHtmlPlugin } from "./html.js";

const PLUGIN = createHtmlPlugin();

/** The page every test addresses, holding one of each thing the namespace reads. */
const PAGE = `
<!doctype html>
<html>
	<head>
		<title>Invest your money</title>
		<meta name="description" content="A page about investing">
		<meta property="og:image" content="/build/_assets/og-image-a1b2c3.png">
		<link rel="canonical" href="https://example.com/portfolios">
	</head>
	<body>
		<h1>Portfolios</h1>
		<p>Give more, and give it sooner.</p>
		<nav aria-label="Main"><a href="/profile">Profile</a></nav>
		<form aria-label="Donate">
			<label for="tip">Tip</label>
			<input id="tip" name="tip" value="20">
			<input type="radio" name="cadence" value="monthly">
			<input type="radio" name="cadence" value="annual">
			<textarea name="note">Thanks</textarea>
			<input type="checkbox" id="remember" name="remember" checked>
			<label for="remember">Remember me</label>
			<input type="checkbox" id="digest" name="digest">
			<label for="digest">Monthly digest</label>
			<button type="submit" name="intent" value="save">Save</button>
			<button type="button" disabled>Cancel</button>
		</form>
		<table>
			<thead><tr><th>Ticker</th><th>Share</th></tr></thead>
			<tbody>
				<tr><td>VTI</td><td>60%</td></tr>
				<tr><td>BND</td><td>40%</td></tr>
			</tbody>
		</table>
		<dl><dt>Total</dt><dd>$12,400</dd></dl>
		<footer><a href="/profile">Profile</a></footer>
	</body>
</html>
`;

/**
 * What only a live session knows: where it is, what it carried back, and what
 * a layout put on screen. A string of markup answers none of them, so these are
 * the observables ADR-018 §6 leaves to `browser` alone.
 */
const SESSION_OBSERVABLES = new Set([
	"url",
	"path",
	"query",
	"fragment",
	"cookie",
	"response_status",
	"response_header",
]);

function value(data: Value): ToolArg {
	return { kind: "value", value: data };
}

function word(name: string): ToolArg {
	return { kind: "word", word: name };
}

/** Call one tool over the page above, which every test starts from. */
async function call(tool: string, ...args: ToolArg[]): Promise<Result<Value, SpecError>> {
	return await PLUGIN.call(tool, [value(PAGE), ...args], createToolContext());
}

/** Unwrap a successful call, failing the test with the error otherwise. */
async function ok(tool: string, ...args: ToolArg[]): Promise<Value> {
	let result = await call(tool, ...args);
	if (isFailure(result)) throw new Error(`expected success, got: ${result.error.message}`);
	return result.data;
}

/** Unwrap a failed call, failing the test with the value otherwise. */
async function err(tool: string, ...args: ToolArg[]): Promise<SpecError> {
	let result = await call(tool, ...args);
	if (!isFailure(result)) throw new Error(`expected a failure, got ${JSON.stringify(result.data)}`);
	return result.error;
}

describe("the namespace itself", () => {
	test("every tool is a permissionless observable", () => {
		for (let descriptor of PLUGIN.describe()) {
			expect(descriptor.kind).toBe("observable");
			expect(descriptor.requires).toBeUndefined();
		}
	});

	test("every tool takes the HTML source as its first argument", async () => {
		for (let descriptor of PLUGIN.describe()) {
			expect(descriptor.params[0]?.name).toBe("source");
			let result = await PLUGIN.call(descriptor.name, [value(42)], createToolContext());
			expect(isFailure(result) && result.error.message).toContain("string of HTML");
		}
	});

	test("no tool carries an observable that needs a layout", () => {
		let names = PLUGIN.describe().map((descriptor) => descriptor.name);
		expect(names).not.toContain("viewport");
		expect(names).not.toContain("scroll");
	});

	test("every document observable `browser` carries is carried here too", () => {
		// ADR-018 §6: a document is addressed one way, and the namespace only
		// says whether a live browser is needed. A shorthand added to one side
		// and not the other would silently change what a moved assertion means.
		let ours = new Set(PLUGIN.describe().map((descriptor) => descriptor.name));
		let missing = createBrowserPlugin()
			.describe()
			.filter((descriptor) => descriptor.kind === "observable")
			.map((descriptor) => descriptor.name)
			.filter((name) => !SESSION_OBSERVABLES.has(name) && !ours.has(name));
		expect(missing).toEqual([]);
	});
});

describe("the head", () => {
	test("html.title reads the title and asserts it whole", async () => {
		expect(await ok("title")).toBe("Invest your money");
		expect(await ok("title", value("Invest your money"))).toBe(true);
		let error = await err("title", value("Invest your time"));
		expect(error.code).toBe("expectation-failed");
		expect(error.message).toContain("<title> is not");
	});

	test("html.meta matches a name or a property, so og: tags are one lookup", async () => {
		expect(await ok("meta", value("description"))).toBe("A page about investing");
		expect(await ok("meta", value("og:image"), word("containing"), value("/og-image-"))).toBe(true);
	});

	test("an absent meta tag names the tags the document does hold", async () => {
		let error = await err("meta", value("og:title"));
		expect(error.message).toContain('found no meta tag "og:title"');
		expect(error.message).toContain("description, og:image");
		expect(error.remedy).toContain("`exists`");
	});

	test("`exists` turns an absence into false rather than a failure", async () => {
		expect(await ok("meta", value("og:title"), word("exists"))).toBe(false);
		expect(await ok("meta", value("og:image"), word("exists"))).toBe(true);
	});

	test("html.rel reads an href by one token of its rel", async () => {
		expect(await ok("rel", value("canonical"))).toBe("https://example.com/portfolios");
		expect(await ok("rel", value("icon"), word("exists"))).toBe(false);
		let error = await err("rel", value("canonical"), value("/elsewhere"));
		expect(error.message).toContain('the <link rel> "canonical" is not');
	});

	test("html.text is a substring assertion, and `exactly` opts into equality", async () => {
		expect(await ok("text", value("Give more"))).toBe(true);
		let error = await err("text", word("exactly"), value("Give more"));
		expect(error.message).toContain("the visible text is not");
	});
});

describe("addressing an element", () => {
	test("a role and an accessible name read the element's text", async () => {
		expect(await ok("element", word("heading"), value("Portfolios"))).toBe("Portfolios");
	});

	test("a label is an accessible name, so no label lookup is needed", async () => {
		expect(await ok("element", word("textbox"), value("Tip"), word("value"), value("20"))).toBe(
			true,
		);
	});

	test("a <textarea> is a textbox, addressed by the role it exposes", async () => {
		expect(await ok("element", word("textbox"), value("Thanks"), word("exists"))).toBe(false);
		let error = await err("element", word("textarea"), value("note"));
		expect(error.message).toContain("textbox");
	});

	test("`exists` on several matches is still an error, never an absence", async () => {
		// Answering false here would let `expect not … exists` pass on a page
		// holding two of the thing, which is the opposite of what it asked.
		let error = await err("element", word("link"), value("Profile"), word("exists"));
		expect(error.message).toContain("matched 2 elements");
	});

	test("two matches is an error listing both with their positions", async () => {
		let error = await err("element", word("link"), value("Profile"));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("matched 2 elements");
		expect(error.message).toContain('#1 <a> "Profile"');
		expect(error.remedy).toContain("nth <n>");
	});

	test("`first`, `nth` and `last` take one of several matches", async () => {
		expect(await ok("element", word("link"), value("Profile"), word("first"))).toBe("Profile");
		expect(await ok("element", word("link"), value("Profile"), word("nth"), value(2))).toBe(
			"Profile",
		);
		expect(await ok("element", word("link"), value("Profile"), word("last"))).toBe("Profile");
	});

	test("a miss names the same role's other names and the same name's other roles", async () => {
		let error = await err("element", word("button"), value("Portfolios"));
		expect(error.message).toContain('a button named "Portfolios" nowhere');
		expect(error.message).toContain('"Save"');
		expect(error.message).toContain("That name is carried by: heading");
	});

	test("`count` accepts any number of matches", async () => {
		expect(await ok("element", word("link"), value("Profile"), word("count"), value(2))).toBe(true);
		let error = await err("element", word("link"), value("Profile"), word("count"), value(3));
		expect(error.message).toContain("found 2 matches");
	});

	test("`enabled` and `disabled` read the control's state", async () => {
		expect(await ok("element", word("button"), value("Save"), word("enabled"))).toBe(true);
		expect(await ok("element", word("button"), value("Cancel"), word("disabled"))).toBe(true);
		let error = await err("element", word("button"), value("Cancel"), word("enabled"));
		expect(error.message).toContain("is not enabled");
	});

	test("`attribute` reads the raw markup rather than a resolved property", async () => {
		expect(
			await ok(
				"element",
				word("button"),
				value("Save"),
				word("attribute"),
				value("type"),
				value("submit"),
			),
		).toBe(true);
		let error = await err(
			"element",
			word("button"),
			value("Save"),
			word("attribute"),
			value("type"),
			value("button"),
		);
		expect(error.message).toContain('carries type="submit"');
	});

	test("`in_viewport` is refused, since markup carries no layout", async () => {
		let error = await err("element", word("button"), value("Save"), word("in_viewport"));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("in_viewport");
		expect(error.message).toContain("browser");
	});
});

describe("addressing a field by name", () => {
	test("`field` resolves any element carrying a name attribute", async () => {
		expect(await ok("element", word("field"), value("note"))).toBe("Thanks");
	});

	test("`value` narrows a group sharing one name, which is a radio group", async () => {
		expect(
			await ok("element", word("field"), value("cadence"), word("value"), value("annual")),
		).toBe(true);
	});

	test("a group with no such value names the values it does carry", async () => {
		let error = await err(
			"element",
			word("field"),
			value("cadence"),
			word("value"),
			value("weekly"),
		);
		expect(error.message).toContain("monthly");
		expect(error.message).toContain("annual");
	});

	test("a submit-intent button is addressed the same way", async () => {
		expect(await ok("element", word("field"), value("intent"), word("value"), value("save"))).toBe(
			true,
		);
	});

	test("`count` counts a field group", async () => {
		expect(await ok("element", word("field"), value("cadence"), word("count"), value(2))).toBe(
			true,
		);
	});
});

describe("structural reads", () => {
	test("a cell counts from 1 over body rows", async () => {
		expect(await ok("cell", word("row"), value(1), word("column"), value(1))).toBe("VTI");
		expect(await ok("cell", word("row"), value(2), word("column"), value(2))).toBe("40%");
	});

	test("`including header` counts the header rows too", async () => {
		expect(
			await ok(
				"cell",
				word("row"),
				value(1),
				word("column"),
				value(2),
				word("including"),
				word("header"),
			),
		).toBe("Share");
	});

	test("a row past the last names how many the table carries", async () => {
		let error = await err("cell", word("row"), value(9), word("column"), value(1));
		expect(error.message).toContain("the cell at row 9, column 1");
		expect(error.message).toContain("it carries 2");
	});

	test("a definition reads the definition paired with a term", async () => {
		expect(await ok("definition", value("Total"))).toBe("$12,400");
		expect(await ok("definition", value("Fees"), word("exists"))).toBe(false);
	});
});

describe("the role shorthands browser carries", () => {
	test("`heading`, `link` and `button` fix the role their name says", async () => {
		expect(await ok("heading", value("Portfolios"))).toBe("Portfolios");
		expect(await ok("link", value("Profile"), word("first"))).toBe("Profile");
		expect(await ok("button", value("Save"), word("enabled"))).toBe(true);
	});

	test("a shorthand reads exactly as its `element` spelling does", async () => {
		let shorthand = await call("button", value("Cancel"), word("disabled"));
		let spelled = await call("element", word("button"), value("Cancel"), word("disabled"));
		expect(shorthand).toEqual(spelled);
	});

	test("every query word reaches a shorthand, since the vocabulary is one", async () => {
		expect(await ok("link", value("Profile"), word("count"), value(2))).toBe(true);
		expect(await ok("link", value("Profile"), word("last"))).toBe("Profile");
		expect(await ok("button", value("Draft"), word("exists"))).toBe(false);
		expect(
			await ok("button", value("Save"), word("attribute"), value("type"), value("submit")),
		).toBe(true);
	});

	test("`level` demands a heading level, from the tag or from aria-level", async () => {
		expect(await ok("heading", value("Portfolios"), word("level"), value(1))).toBe(true);
		let error = await err("heading", value("Portfolios"), word("level"), value(3));
		expect(error.code).toBe("expectation-failed");
		expect(error.message).toContain("is not at level 3");
	});

	test("`checked` reads the attribute the markup carries", async () => {
		expect(await ok("checkbox", value("Remember me"), word("checked"))).toBe(true);
		expect(await ok("checkbox", value("Monthly digest"))).toBe("");
		let error = await err("checkbox", value("Monthly digest"), word("checked"));
		expect(error.message).toContain("is not checked");
	});

	test("`html.link` addresses the link role, as `browser.link` does", async () => {
		// The `<link rel>` reader is `html.rel`, so one spelling has one
		// meaning and an assertion means the same in either namespace.
		let error = await err("link", value("canonical"));
		expect(error.message).toContain('a link named "canonical" nowhere');
	});
});

describe("an expected value on an element", () => {
	test("a cell asserts its text the way a head reader asserts its value", async () => {
		expect(await ok("cell", word("row"), value(2), word("column"), value(2), value("40%"))).toBe(
			true,
		);
		let error = await err("cell", word("row"), value(2), word("column"), value(2), value("60%"));
		expect(error.code).toBe("expectation-failed");
		expect(error.message).toContain('the cell at row 2, column 2 reads "40%", not "60%"');
	});

	test("a definition and a field take the same trailing value", async () => {
		expect(await ok("definition", value("Total"), value("$12,400"))).toBe(true);
		expect(await ok("element", word("field"), value("note"), value("Thanks"))).toBe(true);
	});

	test("the comparison is whole, and `containing` opts into a part", async () => {
		expect(
			await ok(
				"cell",
				word("row"),
				value(2),
				word("column"),
				value(2),
				word("containing"),
				value("40"),
			),
		).toBe(true);
		let error = await err("cell", word("row"), value(1), word("column"), value(1), value("VT"));
		expect(error.message).toContain('reads "VTI"');
	});

	test("`exactly` spells the default comparison out", async () => {
		expect(await ok("definition", value("Total"), word("exactly"), value("$12,400"))).toBe(true);
	});

	test("a word that is neither a predicate nor an assertion keeps its own error", async () => {
		let error = await err("cell", word("row"), value(2), word("column"), value(2), word("checked"));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("predicates");
	});

	test("a role lookup still reads a bare string as the accessible name", async () => {
		// The name comes first, so only a second value can be an expectation:
		// `html.heading src "Portfolios"` addresses, it does not compare.
		expect(await ok("heading", value("Portfolios"))).toBe("Portfolios");
		expect(await ok("heading", value("Portfolios"), value("Portfolios"))).toBe(true);
	});
});

describe("failure artifacts", () => {
	test("a failure leaves the document behind when the run has a store", async () => {
		let written: { name: string; contents: string }[] = [];
		let artifacts: ArtifactStore = {
			directory: "/artifacts",
			async write(name, contents) {
				written.push({ name, contents: String(contents) });
				return `/artifacts/${name}`;
			},
		};
		let result = await PLUGIN.call(
			"title",
			[value(PAGE), value("Something else")],
			createToolContext({ artifacts }),
		);
		expect(isFailure(result) && result.error.artifacts).toEqual([
			"/artifacts/html-title-run-1.html",
		]);
		expect(written[0]?.contents).toBe(PAGE);
	});

	test("a run without a store keeps its diagnostics text", async () => {
		let error = await err("title", value("Something else"));
		expect(error.artifacts).toBeUndefined();
	});
});
