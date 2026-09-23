/**
 * Tests for the preparation a package README runs through. The same file is read on
 * npm and here, so these assertions are what keep the tail it carries for npm — the
 * release scheme, the licence, the author — off the page and out of its heading list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Markdown } from "@sdxc/markdown";
import { toPlainText } from "@sdxc/markdown/plain";
import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { preparePackageReadme, tableOfContents } from "~/app/services/article";
import { listPackages, readPackageReadme } from "~/app/services/packages";

/** Parses a README the way the package page does, so a test reads what a visitor gets. */
function prepare(source: string): Markdown.Document {
	let parsed = Markdown.parse(source);
	if (isFailure(parsed)) throw parsed.error;

	let prepared = preparePackageReadme(parsed.data.document, "result");
	if (isFailure(prepared)) throw prepared.error;

	return prepared.data;
}

/** The headings a prepared document offers a reader, as the aside lists them. */
function headings(document: Markdown.Document): string[] {
	return tableOfContents(document).map((anchor) => anchor.text);
}

const WITH_TAIL = `# @sdxc/result

A result type.

## Usage

Call it.

### Failures

Read the error.

## Versioning

Releases are dated rather than semantic.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
`;

describe("preparePackageReadme", () => {
	test("drops the versioning, licence and author sections a README ends on", () => {
		let text = toPlainText(prepare(WITH_TAIL));

		expect(text).toContain("Call it.");
		expect(text).toContain("Read the error.");
		expect(text).not.toContain("Releases are dated");
		expect(text).not.toContain("MIT");
		expect(text).not.toContain("Sergio Xalambrí");
	});

	test("keeps a section the document carries on past", () => {
		let text = toPlainText(
			prepare(`# @sdxc/result

## License

MIT

## Usage

Call it.
`),
		);

		expect(text).toContain("MIT");
		expect(text).toContain("Call it.");
	});

	test("leaves a README carrying none of them as it was written", () => {
		let source = `# @sdxc/result

A result type.

## Usage

Call it.

## Notes

Read them.
`;

		let parsed = Markdown.parse(source);
		if (isFailure(parsed)) throw parsed.error;

		let prepared = prepare(source);

		expect(prepared.children).toHaveLength(parsed.data.document.children.length - 1);
		expect(headings(prepared)).toEqual(["Usage", "Notes"]);
	});

	test("keeps a deeper heading that reads as one of those names", () => {
		let prepared = prepare(`# @sdxc/result

## Usage

Call it.

### License

MIT
`);

		expect(headings(prepared)).toEqual(["Usage", "License"]);
		expect(toPlainText(prepared)).toContain("MIT");
	});
});

describe("tableOfContents", () => {
	test("lists the headings that survived the trim and no others", () => {
		expect(headings(prepare(WITH_TAIL))).toEqual(["Usage", "Failures"]);
	});
});

describe("the published corpus", () => {
	test("reaches a reader with no npm tail left on any package", async () => {
		let checked = 0;

		for (let entry of listPackages()) {
			let source = await readPackageReadme(entry.directory);
			if (source === null) continue;

			checked++;
			let listed = headings(prepare(source));

			expect(listed).not.toContain("Versioning");
			expect(listed).not.toContain("License");
			expect(listed).not.toContain("Author");
		}

		expect(checked).toBeGreaterThan(0);
	});
});
