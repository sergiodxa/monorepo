/**
 * The New post dialog: one native `<dialog>` in the shell that the nav's Post button, the
 * phone's compose button, a profile's New post and the `n` key open in place, with the field
 * focused. Its post lands back on the page the visitor wrote it on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { Dialog } from "@sdxc/ui";

import { ComposeReturn } from "~/resources/views/demo-apps/chorus/compose-return";
import { ChorusComposer } from "~/resources/views/demo-apps/chorus/composer";
import { href } from "~/resources/views/demo-apps/chorus/data";

/** The dialog's id, which every New post control names in `commandfor`. */
export const COMPOSE_DIALOG = "chorus-compose";

/** From here the dialog floats near the top of the screen; below it fills the phone. */
const FLOATING = "(min-width: 40rem)";

/**
 * Renders the dialog closed. Opened, it floats near the top of a tablet or desktop screen and
 * fills a phone; a press outside it or Escape closes it, keeping what was typed.
 */
export function ComposeDialog(handle: Handle<{ page: string }>) {
	return () => (
		<Dialog
			id={COMPOSE_DIALOG}
			aria-label="New post"
			closedby="any"
			data-slot="chorus-compose"
			mix={[
				raw({
					gap: "0",
					padding: "0",
					inset: "0",
					margin: "0",
					inlineSize: "100%",
					maxInlineSize: "none",
					blockSize: "100dvh",
					maxBlockSize: "none",
					borderRadius: "0",
					backgroundColor: "var(--ui-bg)",
					[`@media ${FLOATING}`]: {
						insetBlock: "5vh auto",
						marginInline: "auto",
						marginBlock: "0 auto",
						maxInlineSize: "37.5rem",
						blockSize: "auto",
						maxBlockSize: "90vh",
						borderRadius: "1rem",
					},
				}),
			]}
		>
			<div
				mix={[
					raw({
						display: "flex",
						alignItems: "center",
						minBlockSize: "3.25rem",
						paddingInline: "0.5rem",
					}),
				]}
			>
				<Dialog.Close
					commandfor={COMPOSE_DIALOG}
					aria-label="Close"
					mix={[raw({ position: "static", borderRadius: "999px" })]}
				/>
			</div>
			<ChorusComposer
				id="dialog"
				from="compose"
				placeholder="Share something with your circle"
				autofocus
				tall
				fields={<ComposeReturn page={handle.props.page} root={href()} />}
			/>
		</Dialog>
	);
}
