/**
 * Client island: the quick-check form. A real `<form>` posting to the run-ping action,
 * so it works with no JavaScript at all — a plain navigating submit that lands back on
 * the dashboard with the result. Once hydrated, `on("submit")` intercepts instead and
 * `fetch()`es the same action, then reloads the enclosing `Frame` so only the card
 * re-renders: running a check must not cost the dashboard its stat cards, its tab
 * table, and every fetch behind them.
 *
 * The whole column under the card's header lives here — caption, field, the last
 * check's answer, then the button — because the answer belongs between the field and
 * the button, and the two used to sit in different containers. Reordering them
 * visually would have left the reading and tabbing order saying the opposite, so the
 * button came in here instead. What it did not bring with it is any say over the
 * answer: that arrives as finished strings, already decided, formatted and translated
 * by the fragment that read them out of the session, so the scripted and unscripted
 * paths still render the same card from the same one place.
 *
 * The answer's slot is held open whether or not there is one to draw, so a check
 * fills the card rather than growing it and shoving the dashboard down: a `Badge`'s
 * own pill — an `xs` line box, its `0.5` block padding and its two borders — the
 * `0.5rem` under it, and one `sm` line for the code and the timing. Whatever is left
 * over then falls to the button's leading margin, which drops it onto the card's
 * bottom edge while the grid stretches this card to the two stat rows beside it, and
 * costs nothing on the narrower layout where it is stretched to nothing at all.
 *
 * The `<label>` wraps the `<input>` rather than pointing at it by `id`: that is what
 * the control's accessible name rests on, and it survives whichever way the caption
 * is styled.
 *
 * Its labels come in as props rather than through `@pkg/i18n/ui`'s `intl(handle)`,
 * since the fragment this renders inside wires up no `IntlProvider` of its own for the
 * server-rendered pass.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { Badge, Button, Input, Label } from "@pkg/r3-ui";
import { fg } from "@pkg/u/color";
import { flex, flexCol, gap, grow, items } from "@pkg/u/layout";
import { m, mbs, minBs } from "@pkg/u/size";
import { text } from "@pkg/u/typography";
import { clientEntry, on } from "remix/ui";

import type { BadgeTone } from "~/resources/components/badge";

import { badgeVariant } from "~/resources/components/badge";

/** Props must be a `type` (not `interface`) to satisfy `SerializableProps`. */
type QuickPingFormProps = {
	/** Where the form posts; the team-scoped `run-ping` action. */
	action: string;
	/** Fragment URL the frame reloads from once the check has run. */
	src: string;
	/** Kept after a check so the field still names the target the answer above it is about. */
	url?: string;
	label: string;
	placeholder: string;
	submit: string;
	/** Why the last submission never ran a check at all, already translated. */
	error?: string;
	/** What the last check came back as, already translated and formatted. */
	result?: {
		tone: BadgeTone;
		status: string;
		detail: string;
	};
};

/** Posts the URL to the run-ping action, then reloads the card's frame with the result. */
export const QuickPingForm = clientEntry(
	"/resources/components/quick-ping-form.tsx#QuickPingForm",
	function QuickPingForm(handle: Handle<QuickPingFormProps>) {
		let pending = false;

		return () => {
			let { action, src, url, label, placeholder, submit, error, result } = handle.props;

			return (
				<form
					method="post"
					action={action}
					mix={[
						m(0),
						flex(),
						flexCol(),
						gap("12px"),
						grow(1),
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
					<Label mix={[flex(), flexCol(), gap("4px")]}>
						<span>{label}</span>
						<Input
							type="url"
							name="url"
							required
							inputMode="url"
							autoComplete="url"
							placeholder={placeholder}
							defaultValue={url}
							disabled={pending}
						/>
					</Label>

					<div
						mix={[
							flex(),
							flexCol(),
							gap("8px"),
							items("start"),
							minBs("calc(0.75rem + 0.25rem + 2px + 0.5rem + 1.25rem)"),
						]}
					>
						{error && <span mix={[text("sm"), fg("danger")]}>{error}</span>}

						{result && (
							<>
								<Badge {...badgeVariant(result.tone)}>{result.status}</Badge>
								<span mix={[text("sm"), fg("neutral.muted")]}>{result.detail}</span>
							</>
						)}
					</div>

					<Button type="submit" isPending={pending} disabled={pending} mix={[mbs("auto")]}>
						{submit}
					</Button>
				</form>
			);
		};
	},
);

export default QuickPingForm;
