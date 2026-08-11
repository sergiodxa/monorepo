/**
 * Client island: the quick-check form that lives in the dashboard's header, where the
 * "create monitor" button used to be. A real `<form>` posting to the run-ping action, so
 * it works with no JavaScript at all — a plain navigating submit that lands back on the
 * dashboard with the answer. Once hydrated, `on("submit")` intercepts instead and
 * `fetch()`es the same action, then reloads the enclosing `Frame` so only this bar
 * re-renders: running a check must not cost the dashboard its stat cards, its tab table,
 * and every fetch behind them.
 *
 * What a check came back as is not drawn here at all — it is a toast the fragment renders
 * beside this form, which is what a 64px header row has room for. That also means this
 * island holds no state about the last check beyond the URL still sitting in the field.
 *
 * The form element is its own `[popover]`, and that is what makes one form serve both
 * layouts. At ≥768px a `display: flex !important` rule beats the UA's
 * `[popover]:not(:popover-open) { display: none }` and the bar simply sits in the header
 * as a row. Below that there is no room for a URL field next to the page title, so the
 * bar stays a popover: the fragment's icon button opens it as a sheet under the header,
 * a column with room for the caption explaining what a check does. Two renderings of the
 * same form would have been two frames reading one session, and only whichever ran first
 * would have found the result in it.
 *
 * The `<label>` wraps the `<input>` rather than pointing at it by `id`: that is what the
 * control's accessible name rests on, and it survives whichever way the caption is
 * styled. Only the caption's `<span>` is clipped, never the label itself — clipping the
 * label would take the field down with it.
 *
 * Its labels come in as props rather than through `@pkg/i18n/ui`'s `intl(handle)`,
 * since the fragment this renders inside wires up no `IntlProvider` of its own for the
 * server-rendered pass.
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
	label: string;
	placeholder: string;
	/** What a check does and does not do; drawn in the popover, read out in both layouts. */
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
						 * The narrow-viewport sheet: a panel pinned under the header's own 64px
						 * row, inset from both edges, laid out as a column. Every declaration
						 * here is undone by the `raw()` block in the media query below, where
						 * this becomes an ordinary row in the header's flex line.
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
							handle.update();
							try {
								/**
								 * `manual` so the browser doesn't spend a request rendering the
								 * dashboard the action redirects to — that redirect exists for the
								 * no-JavaScript path. The response's `Set-Cookie` still lands, which
								 * is what carries the flashed result into the reload below.
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
								handle.update();
							}
						}),
					]}
				>
					{/**
					 * The one place a visitor is told a check saves nothing and sends no alerts.
					 * The sheet has a line to draw it on; the header row does not, so there it is
					 * clipped rather than dropped — the field points `aria-describedby` at it
					 * either way.
					 */}
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
