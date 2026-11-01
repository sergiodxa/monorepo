/**
 * Tests the CMS date cell in a real browser: squeezed by a long title in a narrow table, its
 * date stays on one line, so a list's rows keep one height instead of growing per date.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { Table } from "@sdxc/ui/app/table";
import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { DateCell } from "~/resources/views/cms/cells";

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
