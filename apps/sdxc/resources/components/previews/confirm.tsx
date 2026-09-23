/**
 * Live preview island for `Confirm`. One call composes the whole interruption — the
 * alertdialog, its heading, its supporting copy and the cancel/confirm pair — and a
 * trigger opens it with an invoker command, so the interruption itself needs no script.
 * Without a `form`, confirming closes the panel and leaves the page to decide what the
 * decision means, so the island wires each control through `parts` and reports the
 * outcome, which is the same seam an app hangs its own effect on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { maxIs } from "@sdxc/u/size";
import { text, textAlign } from "@sdxc/u/typography";
import { Button, Confirm } from "@sdxc/ui";
import { clientEntry, on } from "remix/ui";

/** The copy under the heading, which is where a cancellation's real consequences belong. */
const CONSEQUENCES =
	"Billing stops at the end of the period on 30 September. The workspace keeps read access, and the nine seats over the free limit lose theirs that day.";

/** The source the page shows, matching the markup below. */
const CODE = `let outcome: string | null = null;

function settle(next: string) {
	outcome = next;
	void handle.update();
}

<div mix={[vstack({ gap: 3, align: "center" }), maxIs("26rem")]}>
	<Button commandfor="preview-confirm" command="show-modal" color="danger" variant="outline">
		Cancel subscription
	</Button>

	<Confirm
		id="preview-confirm"
		title="Cancel the Team plan?"
		description={CONSEQUENCES}
		confirmLabel="Cancel the plan"
		cancelLabel="Keep the plan"
		color="danger"
		parts={{
			action: on<HTMLButtonElement, "click">("click", () =>
				settle("Cancellation scheduled for 30 September."),
			),
			cancel: on<HTMLButtonElement, "click">("click", () => settle("Still on the Team plan.")),
		}}
	/>

	<p mix={[text("sm"), fg("neutral"), textAlign("center")]}>{outcome ?? "No decision yet."}</p>
</div>`;

/** A subscription cancellation behind a confirmation, hydrated so the decision reports itself. */
export const ConfirmPreview = clientEntry(
	"/resources/components/previews/confirm.tsx#ConfirmPreview",
	function ConfirmPreview(handle: Handle) {
		let outcome: string | null = null;

		/** Records which control closed the panel, the seam an app hangs its own effect on. */
		function settle(next: string) {
			outcome = next;
			void handle.update();
		}

		return () => (
			<div mix={[vstack({ gap: 3, align: "center" }), maxIs("26rem")]}>
				<Button commandfor="preview-confirm" command="show-modal" color="danger" variant="outline">
					Cancel subscription
				</Button>

				<Confirm
					id="preview-confirm"
					title="Cancel the Team plan?"
					description={CONSEQUENCES}
					confirmLabel="Cancel the plan"
					cancelLabel="Keep the plan"
					color="danger"
					parts={{
						action: [
							on<HTMLButtonElement, "click">("click", () =>
								settle("Cancellation scheduled for 30 September."),
							),
						],
						cancel: [
							on<HTMLButtonElement, "click">("click", () => settle("Still on the Team plan.")),
						],
					}}
				/>

				<p mix={[text("sm"), fg("neutral"), textAlign("center")]}>
					{outcome ?? "No decision yet."}
				</p>
			</div>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <ConfirmPreview /> };
