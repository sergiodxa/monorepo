/**
 * Tests for {@link "./aria-checked"}, in the two halves the mixin has: the
 * token it renders during the server pass, asserted through
 * `renderToString` over the controls a consumer applies it to, and the
 * client-side refresh, asserted by driving {@link syncAriaChecked} with
 * minimal objects standing in for a mounted `HTMLInputElement` and the form or
 * document a radio group is scoped by — the same DOM-free stand-in style the
 * rest of this package's element-facing helpers are tested with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { renderToString } from "remix/ui/server";

import { Checkbox } from "../components/checkbox";
import { RadioGroup } from "../components/radio-group";
import { Switch } from "../components/switch";

import { ariaChecked, syncAriaChecked } from "./aria-checked";

/** A stand-in for the form or document a radio group's lookup runs over. */
interface Scope {
	/** The object handed to the mixin as a `form` or `ownerDocument`. */
	node: HTMLFormElement;
	/** Controls the stand-in's `querySelectorAll` returns, pushed to after the controls exist. */
	members: HTMLInputElement[];
	/** Every selector `querySelectorAll` was called with. */
	selectors: string[];
}

/**
 * Builds a stand-in scope whose `querySelectorAll` returns whatever has been
 * pushed into `members`, recording the selector it was asked for.
 */
function createScope(): Scope {
	let members: HTMLInputElement[] = [];
	let selectors: string[] = [];

	let node = {
		querySelectorAll(selector: string) {
			selectors.push(selector);
			return members;
		},
	};

	return { node: node as unknown as HTMLFormElement, members, selectors };
}

/** A stand-in for one mounted checkbox or radio, plus a reader for the attribute under test. */
interface Control {
	/** The object the mixin treats as its host or as a group member. */
	node: HTMLInputElement;
	/** The `aria-checked` value currently written on it, or `undefined` while it carries none. */
	token(): string | undefined;
}

/**
 * Builds a stand-in for a mounted control, defaulting to an unchecked
 * checkbox belonging to no form and sitting in an empty document.
 */
function createControl(init: {
	type?: string;
	name?: string;
	checked?: boolean;
	indeterminate?: boolean;
	form?: HTMLFormElement | null;
	document?: HTMLFormElement;
}): Control {
	let attributes = new Map<string, string>();

	let node = {
		type: init.type ?? "checkbox",
		name: init.name ?? "",
		checked: init.checked ?? false,
		indeterminate: init.indeterminate ?? false,
		form: init.form ?? null,
		ownerDocument: init.document ?? createScope().node,
		setAttribute(name: string, value: string) {
			attributes.set(name, value);
		},
	};

	return {
		node: node as unknown as HTMLInputElement,
		token: () => attributes.get("aria-checked"),
	};
}

describe("ariaChecked", () => {
	/**
	 * The whole point of reading the state off the host's own props: the
	 * markup carries the right token before any JavaScript runs, and there is
	 * no second copy of the checked state for a consumer to get wrong.
	 */
	describe("the server-rendered token", () => {
		test("renders the token matching a switch's own initial state, in both directions", async () => {
			let on = await renderToString(
				<Switch
					name="notifications"
					aria-label="Notifications"
					defaultChecked
					mix={[ariaChecked()]}
				/>,
			);
			let off = await renderToString(
				<Switch name="notifications" aria-label="Notifications" mix={[ariaChecked()]} />,
			);

			expect(on).toContain('aria-checked="true"');
			expect(off).toContain('aria-checked="false"');
		});

		test("lets a tracked checked prop decide over an initial one", async () => {
			let html = await renderToString(
				<Switch
					name="notifications"
					aria-label="Notifications"
					defaultChecked
					checked={false}
					mix={[ariaChecked()]}
				/>,
			);

			expect(html).toContain('aria-checked="false"');
		});

		test("renders a checkbox's token, and the mixed token for a partially-checked one", async () => {
			let checked = await renderToString(
				<Checkbox name="terms" checked mix={[ariaChecked()]}>
					Accept
				</Checkbox>,
			);
			let mixed = await renderToString(
				<Checkbox name="terms" indeterminate mix={[ariaChecked()]}>
					Accept
				</Checkbox>,
			);

			expect(checked).toContain('aria-checked="true"');
			expect(mixed).toContain('aria-checked="mixed"');
		});

		test("renders each radio's own token on its input", async () => {
			let html = await renderToString(
				<RadioGroup aria-label="Shipping">
					<RadioGroup.Radio value="standard" parts={{ input: [ariaChecked()] }}>
						Standard
					</RadioGroup.Radio>
					<RadioGroup.Radio value="express" defaultChecked parts={{ input: [ariaChecked()] }}>
						Express
					</RadioGroup.Radio>
				</RadioGroup>,
			);

			expect(html).toContain('aria-checked="false"');
			expect(html).toContain('aria-checked="true"');
		});

		/**
		 * The opt-in half of the contract: the components render no
		 * `aria-checked` of their own, so a control the mixin was not applied to
		 * keeps announcing its state through the live control alone.
		 */
		test("leaves a control the mixin was not applied to carrying no aria-checked at all", async () => {
			let html = await renderToString(
				<Switch name="notifications" aria-label="Notifications" defaultChecked />,
			);

			expect(html).not.toContain("aria-checked");
		});
	});

	describe("syncAriaChecked", () => {
		test("writes the token a checkbox's live state now holds", () => {
			let checkbox = createControl({ checked: true });

			syncAriaChecked(checkbox.node);

			expect(checkbox.token()).toBe("true");
		});

		test("writes the false token once the same checkbox is toggled back off", () => {
			let checkbox = createControl({ checked: true });

			syncAriaChecked(checkbox.node);
			checkbox.node.checked = false;
			syncAriaChecked(checkbox.node);

			expect(checkbox.token()).toBe("false");
		});

		test("writes the mixed token for a checkbox whose indeterminate property is set", () => {
			let checkbox = createControl({ checked: false, indeterminate: true });

			syncAriaChecked(checkbox.node);

			expect(checkbox.token()).toBe("mixed");
		});

		test("never looks for a group around a checkbox", () => {
			let scope = createScope();
			let checkbox = createControl({ checked: true, document: scope.node });

			syncAriaChecked(checkbox.node);

			expect(scope.selectors).toEqual([]);
		});

		/**
		 * The case a radio cannot do without: picking B unchecks A silently, with
		 * no event of A's own, so a refresh limited to the control that fired
		 * would leave A announcing itself as still checked — worse than the
		 * attribute never being there.
		 */
		test("flips a radio group's previously checked sibling to false", () => {
			let scope = createScope();
			let a = createControl({ type: "radio", name: "shipping", document: scope.node });
			let b = createControl({ type: "radio", name: "shipping", document: scope.node });
			scope.members.push(a.node, b.node);

			a.node.checked = true;
			syncAriaChecked(a.node);

			a.node.checked = false;
			b.node.checked = true;
			syncAriaChecked(b.node);

			expect(b.token()).toBe("true");
			expect(a.token()).toBe("false");
		});

		test("looks a radio's group up over its form when it belongs to one", () => {
			let form = createScope();
			let document = createScope();
			let a = createControl({
				type: "radio",
				name: "shipping",
				form: form.node,
				document: document.node,
			});
			let b = createControl({
				type: "radio",
				name: "shipping",
				checked: true,
				form: form.node,
				document: document.node,
			});
			form.members.push(a.node, b.node);

			syncAriaChecked(b.node);

			expect(a.token()).toBe("false");
			expect(document.selectors).toEqual([]);
			expect(form.selectors).toEqual(['input[type="radio"][aria-checked]']);
		});

		test("leaves a radio of another name or another form alone", () => {
			let scope = createScope();
			let otherName = createControl({ type: "radio", name: "payment", document: scope.node });
			let otherForm = createControl({
				type: "radio",
				name: "shipping",
				form: createScope().node,
				document: scope.node,
			});
			let picked = createControl({
				type: "radio",
				name: "shipping",
				checked: true,
				document: scope.node,
			});
			scope.members.push(otherName.node, otherForm.node, picked.node);

			syncAriaChecked(picked.node);

			expect(picked.token()).toBe("true");
			expect(otherName.token()).toBeUndefined();
			expect(otherForm.token()).toBeUndefined();
		});

		/**
		 * A disabled radio that started out checked still loses its checkedness
		 * the moment somebody picks an enabled sibling, so it is refreshed along
		 * with the rest of the group rather than skipped the way a mixin
		 * synthesizing an interaction would skip it.
		 */
		test("refreshes a disabled sibling along with the rest of the group", () => {
			let scope = createScope();
			let disabled = createControl({ type: "radio", name: "shipping", document: scope.node });
			let picked = createControl({
				type: "radio",
				name: "shipping",
				checked: true,
				document: scope.node,
			});
			scope.members.push(disabled.node, picked.node);

			syncAriaChecked(picked.node);

			expect(disabled.token()).toBe("false");
		});

		test("never looks for a group around an unnamed radio, which groups with nothing", () => {
			let scope = createScope();
			let radio = createControl({ type: "radio", checked: true, document: scope.node });

			syncAriaChecked(radio.node);

			expect(radio.token()).toBe("true");
			expect(scope.selectors).toEqual([]);
		});
	});
});
