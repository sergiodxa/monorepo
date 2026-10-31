/**
 * The email form every page that asks for an address shares: the homepage's list sign-up,
 * the free chapter's gate and the upgrade lookup. A plain POST with native validation, the
 * field and its button on one row from `sm`, and the server's error under the field.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { combine, raw } from "@sdxc/u/general";
import { flexCol, flexRow, items, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { m } from "@sdxc/u/size";
import { pretty, text } from "@sdxc/u/typography";
import { Button, TextField } from "@sdxc/ui";
import { marketingCtaChrome } from "@sdxc/ui/styles";

export namespace EmailForm {
	export interface Props {
		/** Where the form posts. */
		action: string;
		/** The submit button's label, in sentence case. */
		submitLabel: string;
		/** The visible label above the field. */
		label?: string;
		/** A server-rendered error, shown under the field; a `\n` starts a new line. */
		error?: string;
		/**
		 * The address a typo suggestion was just shown for. It is prefilled in the field and
		 * posted back as `confirmed`, so submitting it unchanged keeps it as typed.
		 */
		confirmEmail?: string;
		/** The line under the form; a sign-up promises no spam, the upgrade lookup says nothing. */
		note?: RemixNode;
	}
}

/**
 * Renders the form. The field is `required` and `type="email"`, so the browser holds back an
 * empty or malformed address before a request is made.
 *
 * @param handle Runtime handle carrying the form's endpoint, labels and error.
 * @returns The render function producing the form.
 */
export default function EmailForm(handle: Handle<EmailForm.Props>) {
	return () => {
		let { action, confirmEmail, error, label = "Email address", note, submitLabel } = handle.props;

		return (
			<form
				method="post"
				action={action}
				mix={[vstack({ gap: 3, align: "stretch" }), raw({ maxInlineSize: "34rem" })]}
			>
				{confirmEmail && <input type="hidden" name="confirmed" value={confirmEmail} />}
				<div
					mix={[
						combine([
							flexCol(),
							raw({ display: "flex", gap: "0.75rem" }),
							at("sm", [flexRow(), items("start")]),
						]),
					]}
				>
					<TextField
						label={label}
						type="email"
						name="email"
						autoComplete="email"
						placeholder="you@example.com"
						required
						value={confirmEmail}
						errorMessage={error ? <Lines text={error} /> : undefined}
						mix={[raw({ flex: "1" })]}
					/>
					<Button
						type="submit"
						color="brand"
						mix={[marketingCtaChrome(), at("sm", raw({ marginBlockStart: "1.375rem" }))]}
					>
						{submitLabel}
					</Button>
				</div>
				{note && <p mix={[m(0), text("sm"), pretty(), fg("neutral.muted")]}>{note}</p>}
			</form>
		);
	};
}

/** An error message whose `\n` separators become line breaks, as the server writes them. */
function Lines(handle: Handle<{ text: string }>) {
	return () => (
		<>
			{handle.props.text.split("\n").map((line, index) => (
				<>
					{index > 0 && <br />}
					{line.trim()}
				</>
			))}
		</>
	);
}
