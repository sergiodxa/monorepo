/**
 * Exercises the public surface: parsing a page, reading its head, addressing its
 * content by role and accessible name, narrowing a lookup to the subtree a match
 * carries, and requesting a page over the network — including the ambiguity,
 * visibility and positional rules the package owns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import {
	HTML,
	HTMLAmbiguousMatchError,
	HTMLFetchError,
	HTMLNotFoundError,
	HTMLParseError,
} from "./index.js";

/** MSW server intercepting the pages `HTML.fetch` requests. */
let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Parses a source known to be well-formed, so a test reads as a single expression. */
function parse(source: string): HTML {
	let result = HTML.parse(source);
	if (isFailure(result)) throw result.error;
	return result.data;
}

const PAGE = `<!doctype html>
<html lang="en">
	<head>
		<title>  Invest your money   </title>
		<meta name="description" content="A page about investing">
		<meta property="og:title" content="Invest your money">
		<link rel="canonical" href="https://example.com/portfolios">
		<link rel="alternate stylesheet" href="/print.css">
	</head>
	<body>
		<header><nav><a href="/profile">Profile</a></nav></header>
		<main>
			<h1>Portfolios</h1>
			<p>Hello <strong>world</strong>!</p>
			<button>Sign&nbsp;in</button>
			<button aria-label="Close dialog">×</button>
			<form>
				<label for="tip">Tip amount</label>
				<input id="tip" name="tip" value="10">
				<textarea name="bio">About me</textarea>
				<select name="plan">
					<option value="monthly">Monthly</option>
					<option value="annual" selected>Annual</option>
				</select>
				<input type="radio" name="cadence" value="monthly">
				<input type="radio" name="cadence" value="annual">
				<button name="intent" value="save" disabled>Save</button>
			</form>
			<table>
				<thead>
					<tr><th>Fund</th><th>Share</th></tr>
				</thead>
				<tbody>
					<tr><td>Bonds</td><td>40%</td></tr>
					<tr><td>Stocks</td><td>60%</td></tr>
				</tbody>
			</table>
			<dl>
				<dt>Total</dt>
				<dd>$1,204</dd>
			</dl>
		</main>
		<footer><nav><a href="/profile">Profile</a></nav></footer>
	</body>
</html>`;

describe("HTML.parse", () => {
	test("reads a page into a document", () => {
		let result = HTML.parse(PAGE);

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data).toBeInstanceOf(HTML);
	});

	test("reads a fragment, so a partial response is queryable", () => {
		let doc = parse(`<p>Hello <a href="/p">Profile</a></p>`);

		expect(doc.text).toBe("Hello Profile");
	});

	test("closes an implied paragraph the way a browser does", () => {
		let doc = parse("<p>one<p>two");

		expect(doc.queryAll({ role: "paragraph" }).map((element) => element.text)).toEqual([
			"one",
			"two",
		]);
	});

	test("keeps script contents out of the tree as raw text", () => {
		let doc = parse(`<script>var a = "<b>bold</b>";</script><p>after</p>`);

		expect(doc.text).toBe("after");
		expect(doc.queryAll({ role: "strong" })).toEqual([]);
	});

	test("accepts unquoted and bare attributes", () => {
		let doc = parse("<input name=tip value=10 disabled>");
		let field = doc.field("tip");

		expect(isSuccess(field)).toBe(true);
		if (isSuccess(field)) {
			expect(field.data.value).toBe("10");
			expect(field.data.disabled).toBe(true);
		}
	});

	test("fails on a source carrying no markup", () => {
		let result = HTML.parse("   ");

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(HTMLParseError);
	});
});

describe("head reads", () => {
	test("normalizes the title", () => {
		expect(parse(PAGE).title).toBe("Invest your money");
	});

	test("leaves the title undefined when the page carries none", () => {
		expect(parse("<p>no head here</p>").title).toBeUndefined();
	});

	test("matches a meta tag by name", () => {
		let result = parse(PAGE).meta("description");

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data).toBe("A page about investing");
	});

	test("matches a meta tag by property, so og tags are one lookup", () => {
		let result = parse(PAGE).meta("og:title");

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data).toBe("Invest your money");
	});

	test("names the meta tags a page does carry when one is missing", () => {
		let result = parse(PAGE).meta("og:image");

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error).toBeInstanceOf(HTMLNotFoundError);
			expect(result.error.available).toEqual(["description", "og:title"]);
			expect(result.error.message).toContain("og:image");
			expect(result.error.message).toContain("og:title");
		}
	});

	test("matches a link when the requested value is one token of rel", () => {
		let doc = parse(PAGE);
		let canonical = doc.link("canonical");
		let alternate = doc.link("stylesheet");

		expect(isSuccess(canonical)).toBe(true);
		if (isSuccess(canonical)) expect(canonical.data).toBe("https://example.com/portfolios");
		expect(isSuccess(alternate)).toBe(true);
		if (isSuccess(alternate)) expect(alternate.data).toBe("/print.css");
	});

	test("names the rel tokens a page does carry when one is missing", () => {
		let result = parse(PAGE).link("icon");

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.available).toEqual(["canonical", "alternate", "stylesheet"]);
		}
	});
});

describe("visible text", () => {
	test("keeps an inline element inside its sentence", () => {
		expect(parse("<p>Hello <strong>world</strong>!</p>").text).toBe("Hello world!");
	});

	test("separates block elements with a space", () => {
		expect(parse("<p>one</p><p>two</p>").text).toBe("one two");
	});

	test("leaves out what markup hides", () => {
		let doc = parse(
			`<p>shown</p><p hidden>attribute</p><p aria-hidden="true">aria</p><p style="display: none">inline</p><template><p>template</p></template>`,
		);

		expect(doc.text).toBe("shown");
	});
});

describe("query", () => {
	test("matches a role and an exact accessible name", () => {
		let result = parse(PAGE).query({ role: "button", name: "Sign in" });

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data.tag).toBe("button");
			expect(result.data.name).toBe("Sign in");
			expect(result.data.position).toBe(1);
		}
	});

	test("collapses a non-breaking space in the name it compares", () => {
		let result = parse("<button>Sign&nbsp;&nbsp;in</button>").query({
			role: "button",
			name: "Sign in",
		});

		expect(isSuccess(result)).toBe(true);
	});

	test("compares names case-sensitively", () => {
		let result = parse(PAGE).query({ role: "button", name: "sign in" });

		expect(isFailure(result)).toBe(true);
	});

	test("takes a substring only when asked", () => {
		let result = parse(PAGE).query({ role: "button", nameContaining: "ign" });

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data.name).toBe("Sign in");
	});

	test("reads a name from aria-label", () => {
		let result = parse(PAGE).query({ role: "button", name: "Close dialog" });

		expect(isSuccess(result)).toBe(true);
	});

	test("reads a name from a label associated by for", () => {
		let result = parse(PAGE).query({ role: "textbox", name: "Tip amount" });

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data.value).toBe("10");
	});

	test("reports every candidate with its position when a name repeats", () => {
		let result = parse(PAGE).query({ role: "link", name: "Profile" });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error).toBeInstanceOf(HTMLAmbiguousMatchError);
			if (result.error instanceof HTMLAmbiguousMatchError) {
				expect(result.error.candidates.map((candidate) => candidate.position)).toEqual([1, 2]);
			}
			expect(result.error.message).toContain("2");
		}
	});

	test("selects one of several by position", () => {
		let doc = parse(`<a href="/1">Profile</a><a href="/2">Profile</a><a href="/3">Profile</a>`);
		let selector = { role: "link", name: "Profile" } as const;

		let first = doc.query({ ...selector, at: "first" });
		let last = doc.query({ ...selector, at: "last" });
		let second = doc.query({ ...selector, at: 2 });

		expect(isSuccess(first) && first.data.attributes.href).toBe("/1");
		expect(isSuccess(last) && last.data.attributes.href).toBe("/3");
		expect(isSuccess(second) && second.data.attributes.href).toBe("/2");
		expect(isSuccess(second) && second.data.position).toBe(2);
	});

	test("fails when an ordinal reaches past the matches", () => {
		let result = parse(PAGE).query({ role: "heading", at: 2 });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(HTMLNotFoundError);
	});

	test("names the accessible names present under the role when none matches", () => {
		let result = parse(PAGE).query({ role: "heading", name: "Funds" });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.available).toEqual(["Portfolios"]);
	});

	test("skips what markup hides, and includes it when asked", () => {
		let doc = parse(`<button hidden>Sign in</button>`);

		expect(doc.queryAll({ role: "button" })).toEqual([]);
		expect(doc.queryAll({ role: "button", includeHidden: true })).toHaveLength(1);
	});

	test("counts matches in document order", () => {
		let doc = parse(PAGE);

		expect(doc.queryAll({ role: "link" })).toHaveLength(2);
		expect(doc.queryAll({ role: "row" }).map((row) => row.text)).toEqual([
			"Fund Share",
			"Bonds 40%",
			"Stocks 60%",
		]);
	});

	test("carries the attributes as the markup spelled them", () => {
		let result = parse(PAGE).query({ role: "textbox", name: "Tip amount" });

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data.attributes).toEqual({ id: "tip", name: "tip", value: "10" });
			expect(result.data.disabled).toBe(false);
		}
	});
});

describe("field", () => {
	test("addresses an input by its name attribute", () => {
		let result = parse(PAGE).field("tip");

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data.value).toBe("10");
	});

	test("addresses a textarea by its name attribute", () => {
		let result = parse(PAGE).field("bio");

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data.value).toBe("About me");
	});

	test("reads the selected option of a select", () => {
		let result = parse(PAGE).field("plan");

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data.value).toBe("annual");
	});

	test("falls back to the first option when a select marks none", () => {
		let doc = parse(`<select name="plan"><option value="monthly">M</option></select>`);
		let result = doc.field("plan");

		expect(isSuccess(result) && result.data.value).toBe("monthly");
	});

	test("narrows a group sharing one name by value", () => {
		let result = parse(PAGE).field("cadence", { value: "annual" });

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data.attributes.type).toBe("radio");
	});

	test("reports the group when a shared name is not narrowed", () => {
		let result = parse(PAGE).field("cadence");

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(HTMLAmbiguousMatchError);
	});

	test("addresses a submit-intent button by name and value", () => {
		let result = parse(PAGE).field("intent", { value: "save" });

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data.tag).toBe("button");
			expect(result.data.disabled).toBe(true);
		}
	});

	test("names the fields the page does carry when one is missing", () => {
		let result = parse(PAGE).field("email");

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.available).toEqual(["tip", "bio", "plan", "cadence", "intent"]);
		}
	});
});

describe("cell", () => {
	test("counts body rows from one, header rows excluded", () => {
		let result = parse(PAGE).cell({ row: 1, column: 2 });

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data.text).toBe("40%");
	});

	test("counts header rows when asked", () => {
		let result = parse(PAGE).cell({ row: 1, column: 1, includeHeader: true });

		expect(isSuccess(result) && result.data.text).toBe("Fund");
	});

	test("fails past the last row, naming what the table holds", () => {
		let result = parse(PAGE).cell({ row: 3, column: 1 });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(HTMLNotFoundError);
	});

	test("selects among several tables by position", () => {
		let doc = parse(
			`<table><tr><td>first</td></tr></table><table><tr><td>second</td></tr></table>`,
		);

		expect(isFailure(doc.cell({ row: 1, column: 1 }))).toBe(true);
		let result = doc.cell({ row: 1, column: 1, at: "last" });
		expect(isSuccess(result) && result.data.text).toBe("second");
	});
});

describe("definition", () => {
	test("reads the definition paired with a term", () => {
		let result = parse(PAGE).definition("Total");

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data.text).toBe("$1,204");
			expect(result.data.role).toBe("definition");
		}
	});

	test("names the terms the page does carry when one is missing", () => {
		let result = parse(PAGE).definition("Fees");

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.available).toEqual(["Total"]);
	});
});

/**
 * A page whose two forms carry the same field, table and term, so a lookup only
 * resolves once it is addressed from the form that holds the one it wants.
 */
const SCOPED_PAGE = `<!doctype html>
<html lang="en">
	<body>
		<main>
			<section aria-label="Support">
				<form aria-label="Donate">
					<h2>Donate</h2>
					<label for="donate-tip">Tip amount</label>
					<input id="donate-tip" name="tip" value="10">
					<button name="intent" value="give" disabled>Give</button>
					<table>
						<thead>
							<tr><th>Item</th><th>Amount</th></tr>
						</thead>
						<tbody>
							<tr><td>Gift</td><td>$25</td></tr>
						</tbody>
					</table>
					<dl>
						<dt>Total</dt>
						<dd>$35</dd>
					</dl>
				</form>
				<form aria-label="Subscribe">
					<h2>Subscribe</h2>
					<label for="subscribe-tip">Tip amount</label>
					<input id="subscribe-tip" name="tip" value="5">
					<input id="subscribe-email" name="email" value="reader@example.com">
					<button name="intent" value="give">Give</button>
					<table>
						<thead>
							<tr><th>Item</th><th>Amount</th></tr>
						</thead>
						<tbody>
							<tr><td>Plan</td><td>$9</td></tr>
						</tbody>
					</table>
					<dl>
						<dt>Total</dt>
						<dd>$9</dd>
					</dl>
				</form>
			</section>
		</main>
	</body>
</html>`;

/** Addresses a match known to be there, so a test reads as a single expression. */
function scope(root: HTML | HTML.Element, selector: HTML.Selector): HTML.Element {
	let result = root.query(selector);
	if (isFailure(result)) throw result.error;
	return result.data;
}

describe("scoped lookups", () => {
	test("resolves a field inside the form it was addressed from", () => {
		let doc = parse(SCOPED_PAGE);
		let page = doc.field("tip");
		let scoped = scope(doc, { role: "form", name: "Donate" }).field("tip");

		expect(isFailure(page)).toBe(true);
		if (isFailure(page)) expect(page.error).toBeInstanceOf(HTMLAmbiguousMatchError);
		expect(isSuccess(scoped)).toBe(true);
		if (isSuccess(scoped)) expect(scoped.data.value).toBe("10");
	});

	test("finds a descendant by role and accessible name", () => {
		let doc = parse(SCOPED_PAGE);
		let page = doc.query({ role: "button", name: "Give" });
		let scoped = scope(doc, { role: "form", name: "Donate" }).query({
			role: "button",
			name: "Give",
		});

		expect(isFailure(page)).toBe(true);
		expect(isSuccess(scoped)).toBe(true);
		if (isSuccess(scoped)) {
			expect(scoped.data.tag).toBe("button");
			expect(scoped.data.disabled).toBe(true);
		}
	});

	test("counts its own descendants, so an element outside the scope stays outside", () => {
		let doc = parse(SCOPED_PAGE);
		let donate = scope(doc, { role: "form", name: "Donate" });

		expect(doc.queryAll({ role: "button", name: "Give" })).toHaveLength(2);
		expect(donate.queryAll({ role: "button", name: "Give" })).toHaveLength(1);
		expect(donate.queryAll({ role: "textbox" }).map((field) => field.value)).toEqual(["10"]);
	});

	test("scopes to what sits inside it, so a lone form holds an empty list of forms", () => {
		let doc = parse(SCOPED_PAGE);

		expect(scope(doc, { role: "form", name: "Donate" }).queryAll({ role: "form" })).toEqual([]);
		expect(scope(doc, { role: "region", name: "Support" }).queryAll({ role: "form" })).toHaveLength(
			2,
		);
	});

	test("reads a cell of the table inside the element", () => {
		let doc = parse(SCOPED_PAGE);
		let page = doc.cell({ row: 1, column: 2 });
		let scoped = scope(doc, { role: "form", name: "Donate" }).cell({ row: 1, column: 2 });

		expect(isFailure(page)).toBe(true);
		if (isFailure(page)) expect(page.error).toBeInstanceOf(HTMLAmbiguousMatchError);
		expect(isSuccess(scoped)).toBe(true);
		if (isSuccess(scoped)) expect(scoped.data.text).toBe("$25");
	});

	test("reads the definition of a term inside the element", () => {
		let doc = parse(SCOPED_PAGE);
		let page = doc.definition("Total");
		let scoped = scope(doc, { role: "form", name: "Donate" }).definition("Total");

		expect(isFailure(page)).toBe(true);
		if (isFailure(page)) expect(page.error).toBeInstanceOf(HTMLAmbiguousMatchError);
		expect(isSuccess(scoped)).toBe(true);
		if (isSuccess(scoped)) expect(scoped.data.text).toBe("$35");
	});

	test("names the fields the scope holds when one is missing", () => {
		let doc = parse(SCOPED_PAGE);
		let page = doc.field("email");
		let scoped = scope(doc, { role: "form", name: "Donate" }).field("email");

		expect(isSuccess(page)).toBe(true);
		expect(isFailure(scoped)).toBe(true);
		if (isFailure(scoped)) {
			expect(scoped.error).toBeInstanceOf(HTMLNotFoundError);
			expect(scoped.error.available).toEqual(["tip", "intent"]);
			expect(scoped.error.message).toContain("email");
		}
	});

	test("names the accessible names the scope holds when a query misses", () => {
		let result = scope(parse(SCOPED_PAGE), { role: "form", name: "Donate" }).query({
			role: "heading",
			name: "Subscribe",
		});

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error).toBeInstanceOf(HTMLNotFoundError);
			expect(result.error.available).toEqual(["Donate"]);
		}
	});

	test("narrows once more at every step of a chain", () => {
		let doc = parse(SCOPED_PAGE);
		let region = scope(doc, { role: "region", name: "Support" });
		let form = scope(region, { role: "form", name: "Subscribe" });
		let result = form.field("tip");

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data.value).toBe("5");
	});

	test("carries the data of the element it matched", () => {
		let doc = parse(SCOPED_PAGE);
		let donate = scope(doc, { role: "form", name: "Donate" });
		let field = donate.query({ role: "textbox", name: "Tip amount" });
		let button = donate.query({ role: "button", name: "Give" });

		expect(isSuccess(field)).toBe(true);
		if (isSuccess(field)) {
			expect(field.data.tag).toBe("input");
			expect(field.data.role).toBe("textbox");
			expect(field.data.name).toBe("Tip amount");
			expect(field.data.text).toBe("");
			expect(field.data.value).toBe("10");
			expect(field.data.attributes).toEqual({ id: "donate-tip", name: "tip", value: "10" });
			expect(field.data.disabled).toBe(false);
			expect(field.data.position).toBe(1);
		}
		expect(isSuccess(button)).toBe(true);
		if (isSuccess(button)) {
			expect(button.data.text).toBe("Give");
			expect(button.data.value).toBe("give");
			expect(button.data.disabled).toBe(true);
		}
	});
});

/** The page `HTML.fetch` is pointed at. */
const PAGE_URL = "https://example.com/portfolios";

describe("HTML.fetch", () => {
	test("parses a text/html response into a queryable document", async () => {
		server.use(http.get(PAGE_URL, () => HttpResponse.html("<h1>Portfolios</h1>")));

		let result = await HTML.fetch(PAGE_URL);

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			let heading = result.data.query({ role: "heading", name: "Portfolios" });
			expect(isSuccess(heading)).toBe(true);
		}
	});

	test("asks for text/html", async () => {
		let requests: Headers[] = [];
		server.use(
			http.get(PAGE_URL, ({ request }) => {
				requests.push(request.headers);
				return HttpResponse.html("<h1>Portfolios</h1>");
			}),
		);

		await HTML.fetch(PAGE_URL);

		expect(requests.at(0)?.get("accept")).toBe("text/html");
	});

	test("keeps an Accept header the caller set", async () => {
		let requests: Headers[] = [];
		server.use(
			http.get(PAGE_URL, ({ request }) => {
				requests.push(request.headers);
				return HttpResponse.html("<h1>Portfolios</h1>");
			}),
		);

		await HTML.fetch(PAGE_URL, { headers: { Accept: "text/html; charset=utf-8" } });

		expect(requests.at(0)?.get("accept")).toBe("text/html; charset=utf-8");
	});

	test("names the type a response arrived as when it is another one", async () => {
		server.use(http.get(PAGE_URL, () => HttpResponse.json({ message: "Signed out" })));

		let result = await HTML.fetch(PAGE_URL);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error).toBeInstanceOf(HTMLFetchError);
			expect(result.error.message).toContain("application/json");
		}
	});

	test("reports the status a page answered with when it is an error", async () => {
		server.use(http.get(PAGE_URL, () => new HttpResponse(null, { status: 404 })));

		let result = await HTML.fetch(PAGE_URL);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error).toBeInstanceOf(HTMLFetchError);
			expect(result.error.message).toContain("404");
		}
	});

	test("reports a request the network rejected", async () => {
		server.use(http.get(PAGE_URL, () => HttpResponse.error()));

		let result = await HTML.fetch(PAGE_URL);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error).toBeInstanceOf(HTMLFetchError);
			expect(result.error.message).toContain("Failed to fetch the page");
		}
	});

	test("reports an html response carrying no markup", async () => {
		server.use(http.get(PAGE_URL, () => HttpResponse.html("")));

		let result = await HTML.fetch(PAGE_URL);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(HTMLParseError);
	});
});
