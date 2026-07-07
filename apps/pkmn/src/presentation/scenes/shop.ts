/**
 * The shop screen: buy and sell items against the player's money.
 *
 * A shop NPC pushes this scene. It shows the hero's balance, a Buy list (content
 * items with a finite buy price) and a Sell list (the player's stock the shop
 * will take back), toggled with L/R. The D-pad moves the cursor and B leaves.
 * Confirming a sell entry offloads one unit at once, while confirming a buy entry
 * opens a quantity prompt so the player picks how many to buy — capped by what
 * they can afford — before the `buy-item` command deducts the running total.
 * Money and inventory are always re-read from the selectors, so the panel
 * reflects the engine's truth after every trade rather than tracking its own copy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { maxAffordable } from "~/game/systems/shop-system";

import type { GameClient } from "../core/game-client";
import type { Scene } from "../core/scene";

import { Button } from "../core/input";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../core/loop";
import { HERO_ID } from "../core/new-game";
import { ListMenu } from "../render/list-menu";
import { drawText } from "../render/text";
import * as theme from "../render/theme";
import { Window } from "../render/window";

import { DialogueScene } from "./dialogue";
import { type BuyEntry, buyableItems, type SellEntry, sellableItems } from "./shop-list";

/** How much the Left/Right keys nudge the buy quantity in one step. */
const QUANTITY_STEP = 10;

/**
 * Moves a quantity by `delta` and clamps the result into `[1, max]`.
 *
 * Used by the buy prompt so Up/Down (`delta = ±1`) and Left/Right
 * (`delta = ±QUANTITY_STEP`) both stop at 1 and at the affordable maximum rather
 * than wrapping. A `max` below 1 collapses the range to `1`.
 */
export function clampQuantity(current: number, delta: number, max: number): number {
	let upper = Math.max(1, max);
	return Math.min(upper, Math.max(1, current + delta));
}

/** Which side of the shop the player is browsing. */
type ShopTab = "buy" | "sell";

/** The buy prompt's live state: which item, its unit price, and the chosen count. */
interface BuyPrompt {
	/** The item being bought, doubling as its display name. */
	itemId: string;
	/** The price of a single unit. */
	unitPrice: number;
	/** The most units the player can currently afford (1..999). */
	max: number;
	/** The quantity the player has dialed in so far. */
	quantity: number;
}

/** Lets the player buy and sell items using their money. */
export class ShopScene implements Scene {
	/** The scrolling list widget shared by both tabs. */
	private readonly list = new ListMenu(6);

	/** The active tab, toggled with L/R. */
	private tab: ShopTab = "buy";

	/** The open buy prompt, or `null` while browsing the lists. */
	private prompt: BuyPrompt | null = null;

	enter(game: GameClient) {
		this.list.useAudio(game.audio);
		this.list.reset();
		this.prompt = null;
	}

	exit() {}

	update(game: GameClient) {
		// While the buy prompt is open it captures all input; the lists are frozen.
		if (this.prompt) {
			this.updatePrompt(game);
			return;
		}

		if (game.input.isPressed(Button.L) || game.input.isPressed(Button.R)) {
			this.tab = this.tab === "buy" ? "sell" : "buy";
			this.list.reset();
		}

		let buy = this.buyEntries(game);
		let sell = this.sellEntries(game);
		let count = this.tab === "buy" ? buy.length : sell.length;

		this.list.update(game.input, count);
		if (this.list.cancelled(game.input)) {
			game.scenes.pop();
			return;
		}
		if (!this.list.confirmed(game.input) || count === 0) return;

		if (this.tab === "buy") {
			let entry = buy[this.list.selected];
			if (entry) this.openBuyPrompt(game, entry);
		} else {
			let entry = sell[this.list.selected];
			if (entry) this.sellOne(game, entry);
		}
	}

	/** Advances the open buy prompt: adjusts the quantity or resolves confirm/cancel. */
	private updatePrompt(game: GameClient) {
		let prompt = this.prompt;
		if (!prompt) return;

		let before = prompt.quantity;
		if (game.input.isRepeating(Button.Up)) {
			prompt.quantity = clampQuantity(prompt.quantity, 1, prompt.max);
		}
		if (game.input.isRepeating(Button.Down)) {
			prompt.quantity = clampQuantity(prompt.quantity, -1, prompt.max);
		}
		if (game.input.isRepeating(Button.Right)) {
			prompt.quantity = clampQuantity(prompt.quantity, QUANTITY_STEP, prompt.max);
		}
		if (game.input.isRepeating(Button.Left)) {
			prompt.quantity = clampQuantity(prompt.quantity, -QUANTITY_STEP, prompt.max);
		}
		if (prompt.quantity !== before) game.audio.playSynthSfx("menu-move");

		if (game.input.isPressed(Button.B)) {
			game.audio.playSynthSfx("menu-cancel");
			this.prompt = null;
			return;
		}
		if (game.input.isPressed(Button.A)) {
			game.audio.playSynthSfx("menu-confirm");
			game.dispatch({
				type: "buy-item",
				playerId: HERO_ID,
				itemId: prompt.itemId,
				count: prompt.quantity,
			});
			this.prompt = null;
		}
	}

	render(game: GameClient, ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = theme.SCENE_BACKGROUND.bag;
		ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
		drawText(ctx, this.tab === "buy" ? "SHOP - BUY" : "SHOP - SELL", 8, 6, {
			color: theme.TEXT.default,
		});
		drawText(ctx, "L/R: switch  A: trade  B: leave", 8, 150, { color: theme.TEXT.muted });

		this.drawMoney(game, ctx);

		let rows =
			this.tab === "buy"
				? this.buyEntries(game).map((entry) => `${entry.id}  ₽${entry.price}`)
				: this.sellEntries(game).map((entry) => `${entry.id}  x${entry.count}  ₽${entry.price}`);

		if (rows.length === 0) {
			drawText(ctx, this.tab === "buy" ? "Nothing for sale." : "Nothing to sell.", 16, 40, {
				color: theme.TEXT.muted,
			});
			return;
		}
		this.list.render(ctx, rows, 8, 34, 224);

		if (this.prompt) this.drawPrompt(ctx, this.prompt);
	}

	/** Draws the buy quantity prompt: the item, the live count, and the running total. */
	private drawPrompt(ctx: CanvasRenderingContext2D, prompt: BuyPrompt) {
		let total = prompt.quantity * prompt.unitPrice;
		Window.frame(ctx, 40, 46, 160, 68);
		drawText(ctx, `Buy ${prompt.itemId}`, 48, 52, { color: theme.TEXT.default });
		drawText(ctx, `x ${prompt.quantity}  / ${prompt.max}`, 48, 70, { color: theme.TEXT.default });
		drawText(ctx, `TOTAL  ₽${total}`, 48, 84, { color: theme.TEXT.default });
		drawText(ctx, "↕1  ↔10  A: buy  B: back", 48, 100, { color: theme.TEXT.muted });
	}

	/** The shop's buy listing derived from content. */
	private buyEntries(game: GameClient): BuyEntry[] {
		return buyableItems(game.content.items);
	}

	/** The player's sellable stock derived from inventory and content. */
	private sellEntries(game: GameClient): SellEntry[] {
		return sellableItems(game.engine.selectInventory(HERO_ID).entries, game.content.items);
	}

	/**
	 * Opens the quantity prompt for a chosen item, or reports it is unaffordable.
	 *
	 * When the balance cannot cover a single unit no prompt opens; instead a short
	 * message window explains why. Otherwise the prompt starts at one unit and lets
	 * the player dial the count up to what they can afford.
	 */
	private openBuyPrompt(game: GameClient, entry: BuyEntry) {
		let money = game.engine.selectPlayer(HERO_ID).money;
		let max = maxAffordable(money, entry.price);
		if (max === 0) {
			game.scenes.push(new DialogueScene(["You can't afford that."]));
			return;
		}
		this.prompt = { itemId: entry.id, unitPrice: entry.price, max, quantity: 1 };
	}

	/**
	 * Sells one unit of an item.
	 *
	 * The list re-derives from inventory next frame, so `ListMenu` clamps the
	 * cursor on its own once the last unit of an entry is gone.
	 */
	private sellOne(game: GameClient, entry: SellEntry) {
		game.dispatch({ type: "sell-item", playerId: HERO_ID, itemId: entry.id, count: 1 });
	}

	/** Draws the hero's current balance in a small framed panel. */
	private drawMoney(game: GameClient, ctx: CanvasRenderingContext2D) {
		let money = game.engine.selectPlayer(HERO_ID).money;
		Window.frame(ctx, 150, 4, 86, 24);
		drawText(ctx, "MONEY", 158, 8, { color: theme.TEXT.muted });
		drawText(ctx, `₽${money}`, 158, 18, { color: theme.TEXT.default });
	}
}
