/**
 * Live preview island for `OtpField`. The field's own shape is one input, since that is
 * what carries `autocomplete="one-time-code"` reliably; `otpSlots()` coordinates a group
 * of single-character slots instead. The preview shows both — the single field a form
 * submits, and a slot group composed from one-character fields with the mixin attached.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { hstack, vstack } from "@sdxc/u/layout";
import { is, m } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Button, Description, Header, Label, Link, OtpField } from "@sdxc/ui";
import { otpSlots } from "@sdxc/ui/mixins";
import { clientEntry, on } from "remix/component";

/** How many characters the code carries, which is how many slots the group renders. */
const LENGTH = 6;

/** Slot positions, so each one gets its own accessible name. */
const SLOTS = Array.from({ length: LENGTH }, (_, index) => index + 1);

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const CODE = `let code: string | null = null;

<form method="post" action="/login/verify" mix={[vstack({ gap: 5, align: "stretch" })]}>
	<div mix={[vstack({ gap: 2, align: "stretch" })]}>
		<Label htmlFor="otp">One-time code</Label>
		<OtpField id="otp" name="code" aria-describedby="otp-hint" />
		<Description id="otp-hint">
			We sent a six-digit code to sergio@example.com. <Link href="/login/resend">Resend</Link>.
		</Description>
	</div>

	<div mix={[vstack({ gap: 2, align: "stretch" })]}>
		<Header mix={[m(0)]}>As separate slots</Header>
		{/* Each slot takes focus on its own and rings itself, so the row carries the group's
		    name and its layout and leaves the focus indicator to whichever slot holds it. */}
		<div
			role="group"
			aria-label="One-time code"
			mix={[
				hstack({ gap: 2, align: "center" }),
				otpSlots(),
				on<HTMLDivElement, "ui:otp-complete">("ui:otp-complete", (event) => {
					code = event.code;
					void handle.update();
				}),
			]}
		>
			{SLOTS.map((position) => (
				<OtpField
					key={position}
					length={1}
					data-otp-slot
					aria-label={"Digit " + position}
					autoComplete={position === 1 ? "one-time-code" : "off"}
					mix={[is("2.75rem")]}
				/>
			))}
		</div>
		<Description>
			Typing moves to the next slot, Backspace returns to the last one, and pasting the whole
			code fills every slot at once.
		</Description>
	</div>

	<Button type="submit" disabled={code === null}>
		{code === null ? "Enter the code" : "Verify " + code}
	</Button>

	<p mix={[m(0), text("xs")]}>
		The single field submits as one value; the slot group reports its own through the
		mixin's completion event.
	</p>
</form>`;

/** A verification step, hydrated so the slot group advances, retreats and splits a paste. */
export const OtpFieldPreview = clientEntry(
	import.meta.url,
	function OtpFieldPreview(handle: Handle) {
		let code: string | null = null;

		return () => (
			<form method="post" action="/login/verify" mix={[vstack({ gap: 5, align: "stretch" })]}>
				<div mix={[vstack({ gap: 2, align: "stretch" }), is("20rem")]}>
					<Label htmlFor="preview-otp">One-time code</Label>
					<OtpField id="preview-otp" name="code" aria-describedby="preview-otp-hint" />
					<Description id="preview-otp-hint">
						We sent a six-digit code to sergio@example.com. <Link href="/login/resend">Resend</Link>
						.
					</Description>
				</div>

				<div mix={[vstack({ gap: 2, align: "stretch" })]}>
					<Header mix={[m(0)]}>As separate slots</Header>
					{/* Each slot takes focus on its own and rings itself, so the row carries the group's
					    name and its layout and leaves the focus indicator to whichever slot holds it. */}
					<div
						role="group"
						aria-label="One-time code, as separate slots"
						mix={[
							hstack({ gap: 2, align: "center" }),
							otpSlots(),
							on<HTMLDivElement, "ui:otp-complete">("ui:otp-complete", (event) => {
								code = event.code;
								void handle.update();
							}),
						]}
					>
						{SLOTS.map((position) => (
							<OtpField
								key={position}
								length={1}
								data-otp-slot
								aria-label={`Digit ${position}`}
								autoComplete={position === 1 ? "one-time-code" : "off"}
								mix={[is("2.75rem")]}
							/>
						))}
					</div>
					<Description>
						Typing moves to the next slot, Backspace returns to the last one, and pasting the whole
						code fills every slot at once.
					</Description>
				</div>

				<Button type="submit" disabled={code === null}>
					{code === null ? "Enter the code" : `Verify ${code}`}
				</Button>

				<p mix={[m(0), text("xs"), fg("neutral.muted")]}>
					The single field submits as one value; the slot group reports its own through the mixin's
					completion event.
				</p>
			</form>
		);
	},
);

export default { code: CODE, render: () => <OtpFieldPreview /> };
