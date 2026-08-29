/**
 * Client island: the dashboard header's quick-check form, a real `<form>`
 * posting to the run-ping action so it works as a plain navigating submit.
 * Once hydrated, `on("submit")` intercepts it instead, `fetch()`es the same
 * action, then reloads the enclosing `Frame` so only this bar re-renders.
 *
 * The form is its own `[popover]`, letting one form serve both layouts —
 * a `display: flex !important` header row at ≥768px, a sheet below — since
 * two forms would race to write the same session. Labels arrive as props,
 * translated by the caller ahead of this fragment's server-rendered pass.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { visuallyHidden } from "@pkg/u/a11y";
import { bg, border, fg } from "@pkg/u/color";
import { rounded, shadow } from "@pkg/u/effects";
import { raw } from "@pkg/u/general";
import {
	boxSizing,
	fixed,
	flex,
	flexCol,
	gap,
	grow,
	hidden,
	insBs,
	insIe,
	insIs,
	items,
	shrink,
} from "@pkg/u/layout";
import { media } from "@pkg/u/responsive";
import { is, m, maxIs, minIs, p } from "@pkg/u/size";
import { when } from "@pkg/u/state";
import { text } from "@pkg/u/typography";
import { Button, Input, Label } from "@pkg/ui";
import { clientEntry, on } from "remix/ui";

/**
 * The form's own element id, which the fragment's narrow-viewport trigger button points
 * `commandfor` at to open it as a popover. Exported so the two can never drift apart.
 */
export const QUICK_PING_FORM_ID = "quick-ping-form";

/** The caption's element id, referenced by the field's `aria-describedby`. */
const HELP_ID = "quick-ping-help";

/** Props must be a `type` (not `interface`) to satisfy `SerializableProps`. */
type QuickPingFormProps = {
	/** Where the form posts; the team-scoped `run-ping` action. */
	action: string;
	/** Fragment URL the frame reloads from once the check has run. */
	src: string;
	/** Kept after a check so the field still names the target the toast is about. */
	url?: string;
	/** Wraps the input to give it an accessible name that holds regardless of how the caption is styled. */
	label: string;
	placeholder: string;
	/**
	 * Caption explaining what a check does; shown as a visible line in the
	 * popover, and kept for assistive tech via `visuallyHidden` where the
	 * header row has no room to show it.
	 */
	description: string;
	submit: string;
};

/** Posts the URL to the run-ping action, then reloads the bar's frame with the answer. */
export const QuickPingForm = clientEntry(
	"/resources/components/quick-ping-form.tsx#QuickPingForm",
	function QuickPingForm(handle: Handle<QuickPingFormProps>) {
		let pending = false;

		return () => {
			let { action, src, url, label, placeholder, description, submit } = handle.props;

			return (
				<form
					id={QUICK_PING_FORM_ID}
					popover="auto"
					method="post"
					action={action}
					mix={[
						/**
						 * The narrow-viewport sheet: pinned under the header's 64px row as a
						 * column. The media query below undoes every declaration here via its
						 * own `raw()` block, turning this into an ordinary flex row at ≥768px.
						 */
						fixed(),
						insBs("64px"),
						insIs("12px"),
						insIe("12px"),
						m(0),
						p(3),
						boxSizing("border-box"),
						is("auto"),
						bg("neutral.tint"),
						border({ color: "neutral", width: 1 }),
						rounded("lg"),
						shadow("lg"),
						hidden(),
						flexCol(),
						gap("8px"),
						/**
						 * Beats the UA stylesheet's `[popover]:not(:popover-open) { display: none }`,
						 * which wins on specificity over a plain `display` declaration.
						 */
						when("&:popover-open", raw({ display: "flex !important" })),
						media("(min-width: 768px)", [
							raw({
								display: "flex !important",
								flexDirection: "row",
								position: "static",
								inset: "auto",
								padding: "0",
								background: "transparent",
								border: "none",
								borderRadius: "0",
								boxShadow: "none",
							}),
							items("center"),
						]),
						on("submit", async (event) => {
							event.preventDefault();
							if (pending) return;

							pending = true;
							void handle.update();
							try {
								/**
								 * `manual` captures the redirect response itself, so its `Set-Cookie`
								 * lands immediately — the redirect exists only for the no-JavaScript
								 * submit path.
								 */
								await fetch(action, {
									method: "POST",
									body: new FormData(event.currentTarget),
									redirect: "manual",
								});
								handle.frame.src = src;
								await handle.frame.reload();
							} finally {
								pending = false;
								void handle.update();
							}
						}),
					]}
				>
					<p
						id={HELP_ID}
						mix={[
							m(0),
							text("sm"),
							fg("neutral.muted"),
							media("(min-width: 768px)", visuallyHidden()),
						]}
					>
						{description}
					</p>

					<Label mix={[flex(), grow(1), minIs(0), media("(min-width: 768px)", maxIs("360px"))]}>
						<span mix={[visuallyHidden()]}>{label}</span>
						<Input
							type="url"
							name="url"
							required
							inputMode="url"
							autoComplete="url"
							aria-describedby={HELP_ID}
							placeholder={placeholder}
							defaultValue={url}
							disabled={pending}
							mix={[is("full")]}
						/>
					</Label>

					<Button type="submit" isPending={pending} disabled={pending} mix={[shrink()]}>
						{submit}
					</Button>
				</form>
			);
		};
	},
);

export default QuickPingForm;
