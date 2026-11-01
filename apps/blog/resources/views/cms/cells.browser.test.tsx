/**
 * Tests the CMS table cells in a real browser: squeezed into a narrow table, a date stays on
 * one line in whatever form it was stored, and a long path ends inside its own cell.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { Table } from "@sdxc/ui/app/table";
import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { DateCell, PathCell } from "~/resources/views/cms/cells";

/** The table the current test mounted, unmounted after it. */
let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

describe("DateCell", () => {
	test("keeps its date on one line when the title squeezes its column", () => {
		let host = document.createElement("div");
		host.style.inlineSize = "360px";
		document.body.appendChild(host);
		mounted = render(
			<Table.Container>
				<Table aria-label="Articles" density="comfortable">
					<Table.Header>
						<Table.Row>
							<Table.Column>Title</Table.Column>
							<Table.Column>Date</Table.Column>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						<Table.Row>
							<Table.Cell>A title long enough to take every pixel the table can give it</Table.Cell>
							<DateCell date="2026-03-14T12:00:00.000Z" />
						</Table.Row>
					</Table.Body>
				</Table>
			</Table.Container>,
			{ container: host },
		);

		let time = mounted.$("time");
		if (!time) throw new Error("The cell rendered no time");

		expect(time.getClientRects()).toHaveLength(1);
	});
});

describe("DateCell's stored forms", () => {
	test.each([
		["epoch seconds", 1_600_000_000],
		["digits", "1600000000000"],
	])("reads a date stored as %s", (_, date) => {
		mounted = render(
			<table>
				<tbody>
					<tr>
						<DateCell date={date} />
					</tr>
				</tbody>
			</table>,
		);

		expect(mounted.$("time")?.getAttribute("datetime")).toBe("2020-09-13T12:26:40.000Z");
	});

	test("draws an unreadable date as a dash", () => {
		mounted = render(
			<table>
				<tbody>
					<tr>
						<DateCell date="not a date" />
					</tr>
				</tbody>
			</table>,
		);

		expect(mounted.$("time")).toBeNull();
	});
});

describe("PathCell", () => {
	test("cuts a long path at its cell's edge", () => {
		let host = document.createElement("div");
		host.style.inlineSize = "360px";
		document.body.appendChild(host);
		mounted = render(
			<Table.Container>
				<Table aria-label="Redirects" density="comfortable">
					<Table.Header>
						<Table.Row>
							<Table.Column>From</Table.Column>
							<Table.Column>To</Table.Column>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						<Table.Row>
							<PathCell path="/blog/an-old-path-that-is-long" maxInlineSize="35cqi" />
							<PathCell path="/articles/the-new-path-it-moved-to" maxInlineSize="35cqi" muted />
						</Table.Row>
					</Table.Body>
				</Table>
			</Table.Container>,
			{ container: host },
		);

		let [from] = mounted.$$("td");
		let path = from?.querySelector("span");
		if (!from || !path) throw new Error("The cell rendered no path");

		expect(path.getBoundingClientRect().right).toBeLessThanOrEqual(
			from.getBoundingClientRect().right,
		);
	});
});
