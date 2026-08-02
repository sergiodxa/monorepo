/**
 * Client island: the quick-check form. A real `<form>` posting to the run-ping action,
 * so it works with no JavaScript at all — a plain navigating submit that lands back on
 * the dashboard with the result. Once hydrated, `on("submit")` intercepts instead and
 * `fetch()`es the same action, then reloads the enclosing `Frame` so only the card
 * re-renders: running a check must not cost the dashboard its stat cards, its tab
 * table, and every fetch behind them.
 *
 * The result itself never travels through this component. The action flashes it to the
 * session and the frame's own fragment route renders it, which is what lets the
 * scripted and unscripted paths produce identical markup instead of one of them
 * re-implementing the result in the browser.
 *
 * Its labels come in as props rather than through `@pkg/i18n/ui`'s `intl(handle)`,
 * since the fragment this renders inside wires up no `IntlProvider` of its own for the
 * server-rendered pass.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { Button, Input, Label } from "@pkg/r3-ui";
import { fieldStackLayout } from "@pkg/r3-ui/styles";
import { flex, flexWrap, gap, grow, items } from "@pkg/u/layout";
import { is, m, maxIs } from "@pkg/u/size";
import { clientEntry, on } from "remix/ui";

/** Props must be a `type` (not `interface`) to satisfy `SerializableProps`. */
type QuickPingFormProps = {
	/** Where the form posts; the team-scoped `run-ping` action. */
	action: string;
	/** Fragment URL the frame reloads from once the check has run. */
	src: string;
	/** Kept after a check so the result rendered below still names its target. */
	url?: string;
	label: string;
	placeholder: string;
	submit: string;
};

/** Posts the URL to the run-ping action, then reloads the card's frame with the result. */
export const QuickPingForm = clientEntry(
	"/resources/components/quick-ping-form.tsx#QuickPingForm",
	function QuickPingForm(handle: Handle<QuickPingFormProps>) {
		let pending = false;

		return () => {
			let { action, src, url, label, placeholder, submit } = handle.props;

			return (
				<form
					method="post"
					action={action}
					mix={[
						m(0),
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
					<div mix={[flex(), flexWrap(), gap("8px"), items("end")]}>
						<Label mix={[fieldStackLayout(), grow(1), is("full"), maxIs("480px")]}>
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
						<Button type="submit" isPending={pending} disabled={pending}>
							{submit}
						</Button>
					</div>
				</form>
			);
		};
	},
);

export default QuickPingForm;
