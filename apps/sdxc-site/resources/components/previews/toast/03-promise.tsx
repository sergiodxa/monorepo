/**
 * Live example island for `toaster.promise()`. One toast follows the save from start to
 * finish: a spinner while it runs, then the outcome patched onto the same toast, and an
 * error that ends with its recovery step.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack } from "@sdxc/u/layout";
import { Button } from "@sdxc/ui";
import { pageToaster } from "@sdxc/ui/app/toast";
import { Toasts } from "@sdxc/ui/app/toasts";
import { clientEntry, on } from "remix/component";

/** The queue this example draws, kept apart from the other stacks on the page. */
const QUEUE = "toast-promise";

/** The source the page shows, matching the markup below. */
const CODE = `pageToaster().promise(saveMonitor(), {
	loading: { title: "Saving monitor", loading: true },
	success: { title: "Monitor saved", color: "success" },
	error: { title: "Couldn't save monitor. Try again.", color: "danger" },
});`;

/**
 * Settles after a second and a half, the way a slow save would.
 *
 * @param fail Rejects instead of resolving.
 * @returns The pending save.
 */
function saveMonitor(fail: boolean): Promise<void> {
	return new Promise((resolve, reject) => {
		setTimeout(() => (fail ? reject(new Error("timeout")) : resolve()), 1500);
	});
}

/** Two buttons whose saves report through one toast each. */
export const PromiseToast = clientEntry(import.meta.url, function PromiseToast() {
	let toaster = pageToaster(QUEUE);

	/** Starts a save and lets one toast follow it. */
	function save(fail: boolean): void {
		toaster.promise(saveMonitor(fail), {
			loading: { title: "Saving monitor", loading: true },
			success: { title: "Monitor saved", color: "success" },
			error: { title: "Couldn't save monitor. Try again.", color: "danger" },
		});
	}

	return () => (
		<>
			<div mix={[hstack({ gap: 2, align: "center" })]}>
				<Button mix={[on<HTMLButtonElement, "click">("click", () => save(false))]}>Save</Button>
				<Button variant="outline" mix={[on<HTMLButtonElement, "click">("click", () => save(true))]}>
					Save, then fail
				</Button>
			</div>
			<Toasts labels={{ region: "Notifications", dismiss: "Dismiss" }} queue={QUEUE} />
		</>
	);
});

/** What the preview registry reads: the title, the source to show, and the island to draw. */
export default { title: "Promise", code: CODE, render: () => <PromiseToast /> };
