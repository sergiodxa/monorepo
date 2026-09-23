/**
 * Live preview island for `Checkbox`. The control is a real `<input type="checkbox">`, so
 * it toggles, submits and reads its own checkedness with no script. Two things need
 * wiring: `aria-checked` is a static attribute, so every box carries `ariaChecked()` to
 * keep it following the live state, and a "select all" box's third, partially-checked
 * state is DOM-only — nothing in HTML expresses it, so the island sets it from the run
 * of boxes beneath.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { pis } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Checkbox, Separator } from "@sdxc/ui";
import { ariaChecked } from "@sdxc/ui/mixins";
import { clientEntry, on } from "remix/ui";

/** The scopes a deploy token can be granted, in the order the form lists them. */
const SCOPES = [
	{ value: "read", label: "Read repositories", hint: "Clone and read metadata" },
	{ value: "write", label: "Write repositories", hint: "Push branches and tags" },
	{ value: "deploy", label: "Trigger deploys", hint: "Start a production release" },
	{ value: "secrets", label: "Read secrets", hint: "Decrypt environment values" },
];

/** The source the page shows, matching the markup below. */
const CODE = `let granted = new Set(["read"]);

function toggle(value: string, checked: boolean) {
	if (checked) granted.add(value);
	else granted.delete(value);
	void handle.update();
}

<div mix={[vstack({ gap: 3, align: "stretch" })]}>
	<span mix={[text("xs"), weight("semibold"), fg("neutral.muted")]}>Token scopes</span>

	<Checkbox
		checked={granted.size === SCOPES.length}
		indeterminate={granted.size > 0 && granted.size < SCOPES.length}
		aria-checked={granted.size === SCOPES.length ? "true" : "mixed"}
		mix={[
			ariaChecked(),
			on<HTMLInputElement, "change">("change", (event) => {
				granted = event.currentTarget.checked
					? new Set(SCOPES.map((scope) => scope.value))
					: new Set();
				void handle.update();
			}),
		]}
	>
		<span mix={[weight("medium")]}>Grant every scope</span>
	</Checkbox>

	<Separator />

	{SCOPES.map((scope) => (
		<Checkbox
			key={scope.value}
			name="scopes"
			value={scope.value}
			checked={granted.has(scope.value)}
			color={scope.value === "secrets" ? "danger" : "brand"}
			mix={[
				ariaChecked(),
				on<HTMLInputElement, "change">("change", (event) =>
					toggle(scope.value, event.currentTarget.checked),
				),
			]}
		>
			<span mix={[vstack({ gap: 0, align: "start" })]}>
				<span mix={[text("sm")]}>{scope.label}</span>
				<span mix={[text("xs"), fg("neutral")]}>{scope.hint}</span>
			</span>
		</Checkbox>
	))}

	<p mix={[pis(7), text("sm"), fg("neutral")]}>
		{granted.size} of {SCOPES.length} scopes granted
	</p>
</div>`;

/** A token-scope list with a partially-checked parent, hydrated so the third state is real. */
export const CheckboxPreview = clientEntry(
	"/resources/components/previews/checkbox.tsx#CheckboxPreview",
	function CheckboxPreview(handle: Handle) {
		let granted = new Set(["read"]);

		/** Records one scope's new state, so the parent box and the count follow it. */
		function toggle(value: string, checked: boolean) {
			if (checked) granted.add(value);
			else granted.delete(value);
			void handle.update();
		}

		return () => (
			<div mix={[vstack({ gap: 3, align: "stretch" })]}>
				<span mix={[text("xs"), weight("semibold"), fg("neutral.muted")]}>Token scopes</span>

				<Checkbox
					checked={granted.size === SCOPES.length}
					indeterminate={granted.size > 0 && granted.size < SCOPES.length}
					aria-checked={granted.size === SCOPES.length ? "true" : "mixed"}
					mix={[
						ariaChecked(),
						on<HTMLInputElement, "change">("change", (event) => {
							granted = event.currentTarget.checked
								? new Set(SCOPES.map((scope) => scope.value))
								: new Set();
							void handle.update();
						}),
					]}
				>
					<span mix={[weight("medium")]}>Grant every scope</span>
				</Checkbox>

				<Separator />

				{SCOPES.map((scope) => (
					<Checkbox
						key={scope.value}
						name="scopes"
						value={scope.value}
						checked={granted.has(scope.value)}
						color={scope.value === "secrets" ? "danger" : "brand"}
						mix={[
							ariaChecked(),
							on<HTMLInputElement, "change">("change", (event) =>
								toggle(scope.value, event.currentTarget.checked),
							),
						]}
					>
						<span mix={[vstack({ gap: 0, align: "start" })]}>
							<span mix={[text("sm")]}>{scope.label}</span>
							<span mix={[text("xs"), fg("neutral")]}>{scope.hint}</span>
						</span>
					</Checkbox>
				))}

				<p mix={[pis(7), text("sm"), fg("neutral")]}>
					{granted.size} of {SCOPES.length} scopes granted
				</p>
			</div>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <CheckboxPreview /> };
