/**
 * Mounts a plan notice in a real browser and checks it stays one quiet paragraph with a
 * hairline border, keeps its plan link usable, and wraps inside a phone-width column.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { render } from "remix/component/test";
import { describe, expect, test } from "vitest";

import { PlanNotice } from "./plan-notice.js";

import "../reset.css";
import "../theme.css";

/** Mounts a node in a column of the given width and returns its first child. */
function mount(node: RemixNode, width = 640): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	return render(node, { container: host }).container.firstElementChild as HTMLElement;
}

describe("PlanNotice", () => {
	test("renders one bordered paragraph with an underlined plan link", () => {
		let notice = mount(
			<PlanNotice>
				Available on the <a href="/pricing">Team plan</a>.
			</PlanNotice>,
		);
		let style = getComputedStyle(notice);
		let link = notice.querySelector("a")!;

		expect(notice.tagName).toBe("P");
		expect(notice.getAttribute("role")).toBeNull();
		expect(style.borderTopWidth).toBe("1px");
		expect(style.fontSize).toBe("14px");
		expect(link.getAttribute("href")).toBe("/pricing");
		expect(getComputedStyle(link).textDecorationLine).toBe("underline");
	});

	test("wraps a long sentence inside a 320px column", () => {
		let notice = mount(
			<PlanNotice>
				Available on the <a href="/pricing">Team and Business plans</a>, for workspace owners and
				admins with billing access.
			</PlanNotice>,
			320,
		);

		expect(notice.getBoundingClientRect().width).toBeLessThanOrEqual(320);
		expect(notice.scrollWidth).toBeLessThanOrEqual(notice.clientWidth);
		expect(notice.getClientRects()).toHaveLength(1);
	});
});
