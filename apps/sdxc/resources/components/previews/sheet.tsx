/**
 * Live preview island for `Sheet`. An edge-docked column is only worth docking when
 * it holds something, so the opened panel carries a real cart: a header, line items
 * it can remove, a running total, and a footer that checks out. The panel opens from
 * Invoker Commands with no script at all, so what the island adds is the
 * `hotkey("mod+b")` wiring a reader applies to reach it from the keyboard.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { Trash2Icon } from "@sdxc/icons";
import { hstack, vstack } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Badge, Button, Empty, Keyboard, Separator, Sheet, Text } from "@sdxc/ui";
import { hotkey } from "@sdxc/ui/mixins";
import { clientEntry, css, on } from "remix/ui";

/** One line of the cart, so removing an item visibly changes the total. */
interface Line {
	id: string;
	name: string;
	detail: string;
	price: number;
}

/** The cart the sheet opens with. */
const LINES: Line[] = [
	{ id: "pro", name: "Pro plan", detail: "Annual · 5 seats", price: 480 },
	{ id: "monitors", name: "Extra monitors", detail: "20 monitors", price: 96 },
	{ id: "support", name: "Priority support", detail: "Business hours", price: 240 },
];

/** The source the page shows, matching the markup below. */
const SHEET_CODE = `<Button commandfor="preview-cart" command="show-modal">
	Open cart
	<Badge variant="secondary">{lines.length}</Badge>
	<Keyboard>⌘B</Keyboard>
</Button>

<Sheet
	id="preview-cart"
	side="right"
	aria-labelledby="preview-cart-title"
	// A docked column fills the edge it is docked to; a dialog's own block size
	// hugs its content, so the panel states the full height it wants.
	mix={[hotkey("mod+b"), bs("100%")]}
>
	<Sheet.Header>
		<Sheet.Title id="preview-cart-title">Your cart</Sheet.Title>
		<Sheet.Description>
			{lines.length} {lines.length === 1 ? "item" : "items"} · billed yearly
		</Sheet.Description>
	</Sheet.Header>

	<div mix={[vstack({ gap: 3, align: "stretch" }), is("100%")]}>
		{lines.length === 0 ? (
			<Empty>
				<Empty.Title>Your cart is empty</Empty.Title>
				<Empty.Description>Put the sample lines back to look again.</Empty.Description>
				<Empty.Action>
					<Button
						size="sm"
						variant="outline"
						mix={[on<HTMLButtonElement, "click">("click", restore)]}
					>
						Restore the cart
					</Button>
				</Empty.Action>
			</Empty>
		) : (
			lines.map((line) => (
				<div key={line.id} mix={[vstack({ gap: 3, align: "stretch" })]}>
					<div mix={[hstack({ gap: 3, align: "center", justify: "between" })]}>
						<span mix={[vstack({ gap: 0, align: "start" }), css({ flexGrow: "1" })]}>
							<span mix={[text("sm"), weight("medium")]}>{line.name}</span>
							<Text>{line.detail}</Text>
						</span>
						<span mix={[text("sm"), weight("medium")]}>\${line.price}</span>
						<Button
							variant="ghost"
							size="sm"
							aria-label={\`Remove \${line.name}\`}
							mix={[on<HTMLButtonElement, "click">("click", () => remove(line.id))]}
						>
							<Trash2Icon />
						</Button>
					</div>
					<Separator />
				</div>
			))
		)}

		<div mix={[hstack({ gap: 2, align: "center", justify: "between" })]}>
			<Text>Total</Text>
			<span mix={[text("lg"), weight("semibold")]}>\${total}</span>
		</div>
	</div>

	<Sheet.Footer>
		<Button commandfor="preview-cart" command="close" variant="outline">
			Keep shopping
		</Button>
		<Button commandfor="preview-cart" command="close" disabled={lines.length === 0}>
			Check out
		</Button>
	</Sheet.Footer>
	<Sheet.Close commandfor="preview-cart" aria-label="Close the cart" />
</Sheet>`;

/** A cart docked to the inline edge, hydrated so the shortcut and the line removals work. */
export const SheetPreview = clientEntry(
	"/resources/components/previews/sheet.tsx#SheetPreview",
	function SheetPreview(handle: Handle) {
		let lines = LINES;

		/** Drops one line, so the panel has something to do besides open and close. */
		function remove(id: string) {
			lines = lines.filter((line) => line.id !== id);
			void handle.update();
		}

		/** Puts the cart back, so a reader who emptied it can look again. */
		function restore() {
			lines = LINES;
			void handle.update();
		}

		return () => {
			let total = lines.reduce((sum, line) => sum + line.price, 0);

			return (
				<>
					<Button commandfor="preview-cart" command="show-modal">
						Open cart
						<Badge variant="secondary">{lines.length}</Badge>
						<Keyboard>⌘B</Keyboard>
					</Button>

					<Sheet
						id="preview-cart"
						side="right"
						aria-labelledby="preview-cart-title"
						// A docked column fills the edge it is docked to; a dialog's own block
						// size hugs its content, so the panel states the full height it wants.
						mix={[hotkey("mod+b"), bs("100%")]}
					>
						<Sheet.Header>
							<Sheet.Title id="preview-cart-title">Your cart</Sheet.Title>
							<Sheet.Description>
								{lines.length} {lines.length === 1 ? "item" : "items"} · billed yearly
							</Sheet.Description>
						</Sheet.Header>

						<div mix={[vstack({ gap: 3, align: "stretch" }), is("100%")]}>
							{lines.length === 0 ? (
								<Empty>
									<Empty.Title>Your cart is empty</Empty.Title>
									<Empty.Description>Put the sample lines back to look again.</Empty.Description>
									<Empty.Action>
										<Button
											size="sm"
											variant="outline"
											mix={[on<HTMLButtonElement, "click">("click", restore)]}
										>
											Restore the cart
										</Button>
									</Empty.Action>
								</Empty>
							) : (
								lines.map((line) => (
									<div key={line.id} mix={[vstack({ gap: 3, align: "stretch" })]}>
										<div mix={[hstack({ gap: 3, align: "center", justify: "between" })]}>
											<span mix={[vstack({ gap: 0, align: "start" }), css({ flexGrow: "1" })]}>
												<span mix={[text("sm"), weight("medium")]}>{line.name}</span>
												<Text>{line.detail}</Text>
											</span>
											<span mix={[text("sm"), weight("medium")]}>${line.price}</span>
											<Button
												variant="ghost"
												size="sm"
												aria-label={`Remove ${line.name}`}
												mix={[on<HTMLButtonElement, "click">("click", () => remove(line.id))]}
											>
												<Trash2Icon />
											</Button>
										</div>
										<Separator />
									</div>
								))
							)}

							<div mix={[hstack({ gap: 2, align: "center", justify: "between" })]}>
								<Text>Total</Text>
								<span mix={[text("lg"), weight("semibold")]}>${total}</span>
							</div>
						</div>

						<Sheet.Footer>
							<Button commandfor="preview-cart" command="close" variant="outline">
								Keep shopping
							</Button>
							<Button commandfor="preview-cart" command="close" disabled={lines.length === 0}>
								Check out
							</Button>
						</Sheet.Footer>
						<Sheet.Close commandfor="preview-cart" aria-label="Close the cart" />
					</Sheet>
				</>
			);
		};
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: SHEET_CODE, render: () => <SheetPreview /> };
