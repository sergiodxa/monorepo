/**
 * An HTML printer over the AST, written to the output the CommonMark and GFM
 * specifications show beside each example. It exists so those examples, which
 * compare HTML, can be compared at all, and ships with the suite rather than
 * from the package.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Markdown } from "../index.js";

/** The characters HTML gives meaning to, escaped in text and attribute values alike. */
const XML_SPECIAL = /[&<>"]/g;

/** What each of those characters is written as. */
const XML_ENTITIES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
};

/**
 * The unreserved and reserved characters a link destination keeps as written.
 * `%` is among them, so an escape the source already wrote survives instead of
 * being encoded a second time.
 */
const HREF_SAFE = /[A-Za-z0-9\-_.+!*(),%#@?=;:/$~]/;

/** One encoder for the whole run, since a destination is percent-encoded per UTF-8 byte. */
const ENCODER = new TextEncoder();

/** The label GitHub draws above an alert, keyed by the kind the source wrote. */
const ALERT_TITLES: Record<Markdown.Alert["kind"], string> = {
	note: "Note",
	tip: "Tip",
	important: "Important",
	warning: "Warning",
	caution: "Caution",
};

/** An attribute as it is written out, its value already escaped. */
type Attribute = [name: string, value: string];

/**
 * Escapes the four characters the reference implementation escapes, which is
 * what makes a text node's `"` read back as a quote rather than as the end of
 * an attribute.
 */
function escapeHtml(value: string) {
	return value.replace(XML_SPECIAL, (char) => XML_ENTITIES[char] ?? char);
}

/**
 * Percent-encodes a link destination the way the specifications' reference
 * implementation does, per UTF-8 byte, with `&` and `'` taking their HTML
 * entity so the result is valid inside an attribute.
 */
function escapeHref(url: string) {
	let out = "";
	for (let byte of ENCODER.encode(url)) {
		let char = String.fromCharCode(byte);
		if (byte < 0x80 && HREF_SAFE.test(char)) out += char;
		else if (char === "&") out += "&amp;";
		else if (char === "'") out += "&#x27;";
		else out += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
	}
	return out;
}

/**
 * Turns a node's annotation attributes into written attributes, where a `true`
 * value is the empty string a bare HTML attribute carries and a `false` value
 * is left off entirely.
 */
function attributesOf(attributes: Markdown.Attributes): Attribute[] {
	let written: Attribute[] = [];
	for (let [name, value] of Object.entries(attributes)) {
		if (value === false) continue;
		written.push([name, value === true ? "" : escapeHtml(String(value))]);
	}
	return written;
}

/**
 * The first word of a fence's info string, which is the only part the class
 * name is built from.
 */
function languageClass(language: string | undefined): Attribute[] {
	let [first] = (language ?? "").split(/\s+/);
	if (!first) return [];
	return [["class", `language-${escapeHtml(first)}`]];
}

/**
 * Collects every footnote definition in tree order, since a reference is
 * numbered by where its definition sits and the definitions are drawn together
 * at the end of the document.
 */
function collectFootnotes(node: Markdown.Node, into: Markdown.FootnoteDefinition[]) {
	if (node.type === "footnoteDefinition") into.push(node);
	if ("children" in node) {
		for (let child of node.children) collectFootnotes(child, into);
	}
	return into;
}

/**
 * Writes one document as the specifications print it. The instance holds the
 * output being built, so every helper appends in order and the printer starts
 * fresh for each call.
 */
class Printer {
	/** The output so far, which `cr` reads to decide whether a newline is already there. */
	#out = "";

	/**
	 * How deep inside an image's alternative text the printer is. Tags are
	 * suppressed while it is above zero and literal content still lands, which is
	 * how `alt` holds the text of a link without the anchor around it.
	 */
	#alt = 0;

	/** Every footnote definition in the tree, in the order their numbers follow. */
	#footnotes: Markdown.FootnoteDefinition[] = [];

	/**
	 * @param node - Any node, so a fragment of a document prints on its own
	 * @returns The HTML for that subtree, footnote section included
	 */
	render(node: Markdown.Node) {
		this.#footnotes = collectFootnotes(node, []);
		this.#node(node, false);
		this.#section();
		return this.#out;
	}

	/** Appends raw output, which is what raw HTML and already-built markup take. */
	#lit(value: string) {
		this.#out += value;
	}

	/** Appends escaped output, which is what every text node takes. */
	#text(value: string) {
		this.#out += escapeHtml(value);
	}

	/** Starts a new line unless one has just started, so blocks stack without blank lines. */
	#cr() {
		if (this.#out.length > 0 && !this.#out.endsWith("\n")) this.#out += "\n";
	}

	/** Writes a tag, or nothing at all while the printer is building alternative text. */
	#tag(name: string, attributes: Attribute[] = [], selfClosing = false) {
		if (this.#alt > 0) return;
		this.#lit(`<${name}`);
		for (let [key, value] of attributes) this.#lit(` ${key}="${value}"`);
		this.#lit(selfClosing ? " />" : ">");
	}

	/** Writes a run of nodes in order, `tight` reaching only the items of a tight list. */
	#children(nodes: readonly Markdown.Node[], tight: boolean) {
		for (let child of nodes) this.#node(child, tight);
	}

	/**
	 * The one dispatch every node goes through. `tight` says the node is a direct
	 * child of an item in a tight list, which is the only place a paragraph loses
	 * its wrapper.
	 */
	#node(node: Markdown.Node, tight: boolean) {
		switch (node.type) {
			case "document":
				this.#children(node.children, false);
				return;

			case "paragraph":
				this.#paragraph(node, tight, "");
				return;

			case "heading": {
				this.#cr();
				this.#tag(`h${node.level}`, attributesOf(node.attributes));
				this.#children(node.children, false);
				this.#tag(`/h${node.level}`);
				this.#cr();
				return;
			}

			case "code": {
				this.#cr();
				this.#tag("pre");
				this.#tag("code", [...languageClass(node.language), ...attributesOf(node.attributes)]);
				this.#text(node.content);
				this.#tag("/code");
				this.#tag("/pre");
				this.#cr();
				return;
			}

			case "blockquote": {
				this.#cr();
				this.#tag("blockquote", attributesOf(node.attributes));
				this.#cr();
				this.#children(node.children, false);
				this.#cr();
				this.#tag("/blockquote");
				this.#cr();
				return;
			}

			case "alert": {
				this.#cr();
				this.#tag("div", [
					["class", `markdown-alert markdown-alert-${node.kind}`],
					...attributesOf(node.attributes),
				]);
				this.#cr();
				this.#tag("p", [["class", "markdown-alert-title"]]);
				this.#text(ALERT_TITLES[node.kind]);
				this.#tag("/p");
				this.#cr();
				this.#children(node.children, false);
				this.#cr();
				this.#tag("/div");
				this.#cr();
				return;
			}

			case "list": {
				let name = node.ordered ? "ol" : "ul";
				let start: Attribute[] =
					node.ordered && node.start !== undefined && node.start !== 1
						? [["start", String(node.start)]]
						: [];
				this.#cr();
				this.#tag(name, [...start, ...attributesOf(node.attributes)]);
				this.#cr();
				this.#children(node.children, node.tight);
				this.#cr();
				this.#tag(`/${name}`);
				this.#cr();
				return;
			}

			case "listItem":
				this.#listItem(node, tight);
				return;

			case "table":
				this.#table(node);
				return;

			case "tableRow":
				this.#row(node, []);
				return;

			case "tableCell":
				this.#cell(node, false, null);
				return;

			case "thematicBreak": {
				this.#cr();
				this.#tag("hr", attributesOf(node.attributes), true);
				this.#cr();
				return;
			}

			case "html": {
				this.#cr();
				this.#lit(node.value);
				this.#cr();
				return;
			}

			case "footnoteDefinition":
				return;

			case "tag": {
				this.#tag(node.name, attributesOf(node.attributes));
				this.#children(node.children, false);
				this.#tag(`/${node.name}`);
				return;
			}

			case "text":
				this.#text(node.value);
				return;

			case "emphasis": {
				this.#tag("em");
				this.#children(node.children, false);
				this.#tag("/em");
				return;
			}

			case "strong": {
				this.#tag("strong");
				this.#children(node.children, false);
				this.#tag("/strong");
				return;
			}

			case "strikethrough": {
				this.#tag("del");
				this.#children(node.children, false);
				this.#tag("/del");
				return;
			}

			case "inlineCode": {
				this.#tag("code");
				this.#text(node.value);
				this.#tag("/code");
				return;
			}

			case "link": {
				let attributes: Attribute[] = [["href", escapeHref(node.href)]];
				if (node.title) attributes.push(["title", escapeHtml(node.title)]);
				this.#tag("a", attributes);
				this.#children(node.children, false);
				this.#tag("/a");
				return;
			}

			case "image":
				this.#image(node);
				return;

			case "softBreak":
				this.#lit("\n");
				return;

			case "hardBreak": {
				this.#tag("br", [], true);
				this.#cr();
				return;
			}

			case "inlineHtml":
				this.#lit(node.value);
				return;

			case "footnoteReference":
				this.#reference(node);
				return;

			case "variable":
				this.#text(`{% $${node.name} %}`);
		}
	}

	/**
	 * A paragraph keeps its wrapper everywhere except inside a tight list, which
	 * is the difference the specifications draw between a tight list and a loose
	 * one. `prefix` carries a task list item's checkbox into the first line.
	 */
	#paragraph(node: Markdown.Paragraph, tight: boolean, prefix: string) {
		if (tight) {
			this.#lit(prefix);
			this.#children(node.children, false);
			return;
		}
		this.#cr();
		this.#tag("p", attributesOf(node.attributes));
		this.#lit(prefix);
		this.#children(node.children, false);
		this.#tag("/p");
		this.#cr();
	}

	/**
	 * A task list item draws its checkbox at the head of its first paragraph, so
	 * the box sits on the same line as the text it marks in a tight list and
	 * inside the wrapper in a loose one.
	 */
	#listItem(node: Markdown.ListItem, tight: boolean) {
		this.#tag("li", attributesOf(node.attributes));

		let checkbox =
			node.checked === undefined
				? ""
				: `<input${node.checked ? ' checked=""' : ""} disabled="" type="checkbox"> `;

		let [first, ...rest] = node.children;
		if (first?.type === "paragraph") {
			this.#paragraph(first, tight, checkbox);
			this.#children(rest, tight);
		} else {
			this.#lit(checkbox);
			this.#children(node.children, tight);
		}

		this.#tag("/li");
		this.#cr();
	}

	/** A table's body is written only when there is a row for it, as GFM prints one. */
	#table(node: Markdown.Table) {
		let header = node.children.filter((row) => row.header);
		let body = node.children.filter((row) => !row.header);

		this.#cr();
		this.#tag("table", attributesOf(node.attributes));
		this.#cr();

		if (header.length > 0) {
			this.#tag("thead");
			this.#cr();
			for (let row of header) this.#row(row, node.align);
			this.#tag("/thead");
			this.#cr();
		}

		if (body.length > 0) {
			this.#tag("tbody");
			this.#cr();
			for (let row of body) this.#row(row, node.align);
			this.#tag("/tbody");
			this.#cr();
		}

		this.#tag("/table");
		this.#cr();
	}

	/** Cells read their alignment from the column they sit in, which the table owns. */
	#row(node: Markdown.TableRow, align: Markdown.Table["align"]) {
		this.#tag("tr", attributesOf(node.attributes));
		this.#cr();
		for (let [index, cell] of node.children.entries()) {
			this.#cell(cell, node.header, align[index] ?? null);
		}
		this.#tag("/tr");
		this.#cr();
	}

	/** Header cells and body cells differ only in their name and in nothing else. */
	#cell(node: Markdown.TableCell, header: boolean, align: "left" | "center" | "right" | null) {
		let name = header ? "th" : "td";
		let alignment: Attribute[] = align === null ? [] : [["align", align]];
		this.#tag(name, [...alignment, ...attributesOf(node.attributes)]);
		this.#children(node.children, false);
		this.#tag(`/${name}`);
		this.#cr();
	}

	/**
	 * An image prints its alternative text by rendering its children with tags
	 * suppressed, which is how the reference implementation keeps the words of a
	 * nested link or emphasis and drops the markup.
	 */
	#image(node: Markdown.Image) {
		if (this.#alt === 0) this.#lit(`<img src="${escapeHref(node.src)}" alt="`);
		this.#alt += 1;
		this.#children(node.children, false);
		this.#alt -= 1;
		if (this.#alt > 0) return;
		if (node.title) this.#lit(`" title="${escapeHtml(node.title)}`);
		this.#lit(`" />`);
	}

	/** A reference carries the number of its definition, and the identifier when it has none. */
	#reference(node: Markdown.FootnoteReference) {
		let index = this.#footnotes.findIndex((entry) => entry.identifier === node.identifier);
		let label = index === -1 ? node.identifier : String(index + 1);
		let id = escapeHtml(node.identifier);
		this.#lit(
			`<sup class="footnote-ref"><a href="#fn-${escapeHref(node.identifier)}" id="fnref-${id}">${escapeHtml(label)}</a></sup>`,
		);
	}

	/** The definitions are drawn once, after the document, wherever they were written. */
	#section() {
		if (this.#footnotes.length === 0) return;

		this.#cr();
		this.#lit(`<section class="footnotes">`);
		this.#cr();
		this.#tag("ol");
		this.#cr();

		for (let definition of this.#footnotes) {
			this.#lit(`<li id="fn-${escapeHref(definition.identifier)}">`);
			this.#cr();
			this.#children(definition.children, false);
			this.#cr();
			this.#lit(
				`<a href="#fnref-${escapeHref(definition.identifier)}" class="footnote-backref">↩</a>`,
			);
			this.#cr();
			this.#tag("/li");
			this.#cr();
		}

		this.#tag("/ol");
		this.#cr();
		this.#tag("/section");
		this.#cr();
	}
}

/**
 * Prints a node as the CommonMark and GFM specifications print it, so a spec
 * example's expected HTML can be compared against what the parser built.
 *
 * @param node - Any node, so a fragment of a document prints on its own
 * @returns The HTML for that subtree
 * @example expect(toHTML(document)).toBe(example.html)
 */
export function toHTML(node: Markdown.Node): string {
	return new Printer().render(node);
}
