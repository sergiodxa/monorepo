/**
 * Renders `ProfilePicker` in a real browser: the question is the page's heading, each profile
 * is a submit button that posts to its own address and is named by the profile, the current one
 * is marked, and the grid holds two profiles to a row on a phone and all of them when wide.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { ProfilePicker } from "./profile-picker.js";

import "../reset.css";
import "../theme.css";

/** The household the tests pick from. */
const NAMES = ["Noa", "Theo", "Ines", "Kids"];

/** Mounts a picker `width` pixels wide inside a form and returns the form. */
function mount(width: number): HTMLFormElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(
		<form method="post">
			<ProfilePicker title="Who's watching?" footer="Each profile keeps its own list.">
				{NAMES.map((name) => (
					<ProfilePicker.Profile
						name={name}
						avatar={<span style={{ background: "rgb(200 120 60)" }} />}
						formAction={`/profiles/${name.toLowerCase()}`}
						current={name === "Theo"}
					/>
				))}
			</ProfilePicker>
		</form>,
		{ container: host },
	);
	return host.querySelector("form")!;
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("ProfilePicker", () => {
	test("asks its question as the heading and offers each profile as its own post", () => {
		let form = mount(900);
		expect(form.querySelector("h1")?.textContent).toBe("Who's watching?");
		let buttons = [...form.querySelectorAll("button")];
		expect(buttons.map((button) => button.textContent)).toEqual(NAMES);
		expect(buttons.map((button) => button.type)).toEqual(NAMES.map(() => "submit"));
		expect(buttons[2]?.getAttribute("formaction")).toBe("/profiles/ines");
		expect(buttons[1]?.getAttribute("aria-current")).toBe("true");
		expect(buttons[0]?.hasAttribute("aria-current")).toBe(false);
	});

	test("draws every avatar square, two to a row on a phone and one row when wide", () => {
		let rows = (form: HTMLFormElement) =>
			new Set(
				[...form.querySelectorAll("[data-slot=profile-picker-avatar]")].map((avatar) =>
					Math.round(avatar.getBoundingClientRect().top),
				),
			).size;
		let wide = mount(900);
		let avatar = wide.querySelector("[data-slot=profile-picker-avatar]")!.getBoundingClientRect();
		expect(avatar.width).toBeCloseTo(avatar.height, 0);
		expect(rows(wide)).toBe(1);
		document.body.replaceChildren();
		expect(rows(mount(360))).toBe(2);
	});
});
