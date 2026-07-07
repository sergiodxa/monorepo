/**
 * The shop screen: buy and sell items against the player's money.
 *
 * A shop NPC pushes this scene. It shows the hero's balance, a Buy list (content
 * items with a finite buy price) and a Sell list (the player's stock the shop
 * will take back), toggled with L/R. The D-pad moves the cursor, A trades one
 * unit through the `buy-item` / `sell-item` commands, and B leaves. Money and
 * inventory are always re-read from the selectors, so the panel reflects the
 * engine's truth after every trade rather than tracking its own copy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameClient } from "../core/game-client";
import type { Scene } from "../core/scene";

import { Button } from "../core/input";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../core/loop";
import { HERO_ID } from "../core/new-game";
import { ListMenu } from "../render/list-menu";
import { drawText } from "../render/text";
import * as theme from "../render/theme";
import { Window } from "../render/window";

import { type BuyEntry, buyableItems, type SellEntry, sellableItems } from "./shop-list";

/** Which side of the shop the player is browsing. */
type ShopTab = "buy" | "sell";

/** Lets the player buy and sell items using their money. */
export class ShopScene implements Scene {
	/** The scrolling list widget shared by both tabs. */
	private readonly list = new ListMenu(6);

	/** The active tab, toggled with L/R. */
	private tab: ShopTab = "buy";

	enter(game: GameClient) {
		this.list.useAudio(game.audio);
		this.list.reset();
	}

	exit() {}

	update(game: GameClient) {
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
			if (entry) this.buyOne(game, entry);
		} else {
			let entry = sell[this.list.selected];
			if (entry) this.sellOne(game, entry);
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
	}

	/** The shop's buy listing derived from content. */
	private buyEntries(game: GameClient): BuyEntry[] {
		return buyableItems(game.content.items);
	}

	/** The player's sellable stock derived from inventory and content. */
	private sellEntries(game: GameClient): SellEntry[] {
		return sellableItems(game.engine.selectInventory(HERO_ID).entries, game.content.items);
	}

	/** Buys one unit of an item, letting the engine reject an unaffordable purchase. */
	private buyOne(game: GameClient, entry: BuyEntry) {
		if (game.engine.selectPlayer(HERO_ID).money < entry.price) return;
		game.dispatch({ type: "buy-item", playerId: HERO_ID, itemId: entry.id, count: 1 });
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
