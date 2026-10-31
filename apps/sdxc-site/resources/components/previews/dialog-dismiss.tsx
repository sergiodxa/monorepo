/**
 * Live preview for `DialogDismiss`: a phone-style navigation sheet whose links point at
 * sections of the same page. Following one, or pressing outside the panel, closes the
 * sheet, which a same-page link leaves open on its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { Button, Dialog, DialogDismiss, Link } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Button commandfor="menu" command="show-modal">Menu</Button>

<Dialog id="menu" aria-labelledby="menu-title">
	<Dialog.Header>
		<Dialog.Title id="menu-title">Menu</Dialog.Title>
	</Dialog.Header>
	<nav>
		<Link href="#features">Features</Link>
		<Link href="#pricing">Pricing</Link>
		<Link href="#faq">FAQ</Link>
	</nav>
	<Dialog.Close commandfor="menu" aria-label="Close" />
	<DialogDismiss />
</Dialog>`;

/** What the preview registry reads: the source to show, and the sheet to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[vstack({ gap: 3, align: "center" })]}>
			<Button commandfor="preview-dialog-dismiss" command="show-modal">
				Menu
			</Button>
			<Dialog id="preview-dialog-dismiss" aria-labelledby="preview-dialog-dismiss-title">
				<Dialog.Header>
					<Dialog.Title id="preview-dialog-dismiss-title">Menu</Dialog.Title>
				</Dialog.Header>
				<nav mix={[vstack({ gap: 2, align: "start" })]}>
					<Link href="#features">Features</Link>
					<Link href="#pricing">Pricing</Link>
					<Link href="#faq">FAQ</Link>
				</nav>
				<Dialog.Close commandfor="preview-dialog-dismiss" aria-label="Close" />
				<DialogDismiss />
			</Dialog>
		</div>
	),
};
