/**
 * Stacks avatars in a real browser and checks that each one's two-letter initials stay
 * clear of the avatar overlapping it, at every size, and that the cutout ring takes the
 * page surface behind the group.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { describe, expect, test } from "vitest";

import { Avatar } from "./avatar.js";

/** Two-letter initials as wide as a stack usually carries. */
const INITIALS = ["TS", "AG", "JL", "OV"];

/** Mounts a group of avatars at one size, trailed by an overflow count. */
function mountGroup(size: Avatar.Size) {
	let host = document.createElement("div");
	document.body.appendChild(host);
	let { container } = render(
		<Avatar.Group>
			{INITIALS.map((initials) => (
				<Avatar key={initials} size={size}>
					<Avatar.Fallback>{initials}</Avatar.Fallback>
				</Avatar>
			))}
			<Avatar.Group.Count>+3</Avatar.Group.Count>
		</Avatar.Group>,
		{ container: host },
	);
	return container.querySelector('[data-slot="group"]')!;
}

describe("Avatar.Group", () => {
	for (let size of ["sm", "md", "lg"] as const) {
		test(`keeps the second letter of every ${size} avatar's initials clear of the next one`, () => {
			let group = mountGroup(size);
			let children = [...group.children];

			for (let index = 0; index < INITIALS.length; index++) {
				let fallback = children[index]!.querySelector('[data-slot="fallback"]')!;
				let range = document.createRange();
				range.selectNodeContents(fallback);
				let text = range.getBoundingClientRect();
				let next = children[index + 1]!.getBoundingClientRect();

				expect(text.right, `${INITIALS[index]} at ${size}`).toBeLessThanOrEqual(next.left);
			}
		});
	}

	test("overlaps each avatar by a fifth of its size", () => {
		let group = mountGroup("md");
		let [first, second] = [...group.children].map((child) => child.getBoundingClientRect());

		expect(first!.right - second!.left).toBeCloseTo(first!.width / 5, 1);
	});

	test("rings every avatar and the count in the surface behind the group", () => {
		let group = mountGroup("md") as HTMLElement;
		group.style.setProperty("--ui-bg", "rgb(10, 20, 30)");

		for (let child of group.children) {
			expect(getComputedStyle(child).boxShadow).toContain("rgb(10, 20, 30)");
		}
	});
});
