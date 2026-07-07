/**
 * The battle scene: a consumer of the engine's ordered battle events.
 *
 * It never computes rules. Each burst of events (everything between two input
 * requests) is translated into animation tasks that drain in order, HP bars ease
 * toward the values the events report, and when the queue is idle the scene reads
 * the pending request and either opens the command menu (player turn) or fills a
 * forced replacement. Commands are assembled for every requested slot — the
 * player's choice for their side, and a move chosen by the deterministic enemy AI
 * for the opponent's, since the engine has no built-in AI — and dispatched back
 * through the client.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { BattlePosition, ReplacementSelection, TurnCommand } from "~/game/battle/battle";
import type { ReplacementCommand } from "~/game/battle/battle";
import type { State } from "~/game/data/status";
import type { GameEvent } from "~/game/events";
import type { BattleView, CreatureSummaryView } from "~/game/selectors";
import type { MoveSet } from "~/game/world/creature";
import type { BattleId, CreatureId, PlayerId } from "~/game/world/ids";

import { DamageClass } from "~/game/data/move";
import { applyMedicine, isMedicineEffect } from "~/game/systems/medicine-system";

import type { Scene } from "../core/scene";

import { GameClient } from "../core/game-client";
import { Button } from "../core/input";
import { SCREEN_WIDTH } from "../core/loop";
import { drawText, Typewriter, wrapText } from "../render/text";
import * as theme from "../render/theme";
import { Window } from "../render/window";
import { EvolutionScene } from "../scenes/evolution";
import { LearnMoveScene } from "../scenes/learn-move";

import { AnimationQueue } from "./animation-queue";
import { BattleCommandMenu } from "./command-menu";
import { chooseEnemyAction, type EnemyMoveOption } from "./enemy-ai";
import { buildBattleTasks, type BattleHud } from "./event-animations";
import { HpBar } from "./hp-bar";

/** A money stake settled when a battle ends (used by trainer fights). */
export interface BattleReward {
	/** The player whose balance the win/loss adjusts. */
	playerId: PlayerId;
	/** Money credited when the player wins (side 0). */
	winReward: number;
	/** Money debited when the player loses. */
	lossPenalty: number;
}

/** Optional configuration that turns a plain wild battle into a staked one. */
export interface BattleOptions {
	/** A money stake to settle on finish; omitted for ordinary wild battles. */
	reward?: BattleReward;
	/** Whether the Bag/throw-ball path is allowed; false disables capture (trainer fights). */
	canCapture?: boolean;
}

/** Renders and drives one battle from the engine's event stream. */
export class BattleScene implements Scene {
	/** The ordered animation queue for the current event burst. */
	private readonly queue = new AnimationQueue();

	/** The command menu shown on the player's turn. */
	private readonly menu = new BattleCommandMenu();

	/** HP bars for active slots, keyed by `side:slot`. */
	private readonly bars = new Map<string, HpBar>();

	/** Slots currently rendered as fainted. */
	private readonly fainted = new Set<string>();

	/** The narration line currently displayed, or null when a menu shows. */
	private message: string | null = null;

	/** Count of battle-log events already turned into tasks. */
	private consumed = 0;

	/** True once the finish message is showing and only the pop is pending. */
	private finishing = false;

	/** Winner reported by a battle-finished engine event (covers capture/flee endings). */
	private endedWinnerSide: number | null | undefined = undefined;

	/** Whether the last capture attempt caught the target. */
	private captured = false;

	/** Creatures that became eligible to evolve during the battle, shown after it ends. */
	private readonly pendingEvolutions: Array<{ creatureId: CreatureId; speciesId: string }> = [];

	/** Moves auto-learned into a free slot during the battle, narrated after it ends. */
	private readonly autoLearnedMoves: Array<{ creatureId: CreatureId; moveId: string }> = [];

	/** Full-moveset move offers surfaced during the battle, prompted after it ends. */
	private readonly pendingLearnMoves: Array<{
		creatureId: CreatureId;
		moveId: string;
		currentMoveset: MoveSet;
	}> = [];

	/** Whether the money stake has already been settled, so it fires exactly once. */
	private rewardSettled = false;

	/**
	 * @param battleId - The battle this scene presents.
	 * @param options - Optional stake and capture rules; wild battles pass nothing.
	 */
	constructor(
		private readonly battleId: BattleId,
		private readonly options: BattleOptions = {},
	) {}

	/** Whether throwing a ball is allowed in this battle (default true). */
	private get canCapture(): boolean {
		return this.options.canCapture ?? true;
	}

	/**
	 * Reacts to engine-level events a dispatch produced.
	 *
	 * Capture and flee end a battle outside the turn resolver, so their outcome
	 * arrives here as `capture-attempted`/`battle-finished` game events rather than
	 * in the battle log; this narrates the shakes and records the ending.
	 */
	onEngineEvents(events: GameEvent[]) {
		for (let event of events) {
			if (event.type === "capture-attempted") {
				this.captured ||= event.success;
				this.enqueueMessage(
					event.success
						? "Gotcha! It was caught!"
						: `It shook ${event.shakes} time(s), then broke free!`,
				);
			}
			if (event.type === "creature-can-evolve" && event.choices[0]) {
				this.pendingEvolutions.push({ creatureId: event.creatureId, speciesId: event.choices[0] });
			}
			if (event.type === "learned-move") {
				this.autoLearnedMoves.push({ creatureId: event.creatureId, moveId: event.moveId });
			}
			if (event.type === "can-learn-move") {
				this.pendingLearnMoves.push({
					creatureId: event.creatureId,
					moveId: event.moveId,
					currentMoveset: event.currentMoveset,
				});
			}
			if (event.type === "battle-finished") this.endedWinnerSide = event.winnerSide;
		}
	}

	/** Initializes HP bars and queues the intro message. */
	enter(game: GameClient) {
		let view = game.engine.selectBattle(this.battleId);
		this.syncBars(view);
		let foe = view.enemies[0];
		if (foe) this.message = `A wild ${foe.name} appeared!`;
		this.consumed = view.events.length; // the opening burst needs no narration
	}

	exit() {
		this.queue.clear();
	}

	update(game: GameClient, dt: number) {
		let view = game.engine.selectBattle(this.battleId);
		for (let bar of this.bars.values()) bar.update(dt);

		this.processNewEvents(view);
		this.queue.update(dt);
		if (!this.queue.idle) {
			// Let the player hurry narration along.
			if (game.input.isPressed(Button.A) || game.input.isPressed(Button.B)) {
				this.queue.update(dt * 12);
			}
			return;
		}

		this.syncBars(view);

		if (this.finishing) {
			if (game.input.isPressed(Button.A) || game.input.isPressed(Button.B)) {
				game.scenes.pop();
				// Offer any evolutions the level-ups unlocked, back on the overworld. Push
				// these first so the move prompts pushed after them sit on top and resolve
				// before evolving, matching the level-up-then-evolve order.
				for (let pending of this.pendingEvolutions) {
					let name = game.engine.selectCreatureSummary(pending.creatureId).name;
					game.scenes.push(new EvolutionScene(pending.creatureId, pending.speciesId, name));
				}
				// Prompt the player to replace or skip each move offered on a full moveset.
				for (let pending of this.pendingLearnMoves) {
					let name = game.engine.selectCreatureSummary(pending.creatureId).name;
					game.scenes.push(
						new LearnMoveScene(pending.creatureId, pending.moveId, pending.currentMoveset, name),
					);
				}
			}
			return;
		}

		let winnerSide = this.endedWinnerSide ?? view.winnerSide;
		if (winnerSide !== null) {
			// Narrate auto-learned moves once, before the closing message. Enqueuing makes
			// the queue non-idle so this block re-runs (and skips the drained list) only
			// after those lines have played.
			if (this.autoLearnedMoves.length > 0) {
				for (let learned of this.autoLearnedMoves) {
					let name = game.engine.selectCreatureSummary(learned.creatureId).name;
					this.enqueueMessage(`${name} learned ${learned.moveId}!`);
				}
				this.autoLearnedMoves.length = 0;
				return;
			}
			this.message = this.captured
				? "The wild creature was caught!"
				: winnerSide === 0
					? "You won the battle!"
					: winnerSide === 1
						? "You were defeated..."
						: "The battle ended in a draw.";
			this.settleReward(game, winnerSide);
			this.finishing = true;
			return;
		}

		let request = this.pendingRequest(view);
		if (request?.type === "turn") {
			this.message = null;
			let moves = this.playerMoves(view);
			let result = this.menu.update(game.input, moves);
			if (result?.kind === "fight") this.submitTurn(game, request.turn, result.move);
			else if (result?.kind === "run") this.submitRun(game, request.turn);
			else if (result?.kind === "bag") this.useBag(game, request.turn);
			// the Creatures (switch) menu is not wired to in-battle switching yet.
		} else if (request?.type === "replacement") {
			this.submitReplacements(game, request.replacement);
		}
	}

	render(game: GameClient, ctx: CanvasRenderingContext2D) {
		let view = game.engine.selectBattle(this.battleId);
		this.drawBackground(ctx);

		let foe = view.enemies[0];
		let ally = view.allies[0];
		if (foe) this.drawCreature(ctx, foe, 168, 20, false);
		if (ally) this.drawCreature(ctx, ally, 24, 78, true);
		if (foe) this.drawInfo(ctx, foe, 8, 8, false);
		if (ally) this.drawInfo(ctx, ally, 128, 78, true);

		let turnRequest = this.pendingRequest(view)?.type === "turn";
		let live = view.winnerSide === null && this.endedWinnerSide === undefined && !this.finishing;
		if (this.message !== null) this.drawMessage(ctx, this.message);
		else if (this.queue.idle && turnRequest && live) {
			this.menu.render(ctx, this.playerMoves(view));
		}
	}

	/** Turns any unconsumed battle-log events into queued animation tasks. */
	private processNewEvents(view: BattleView) {
		if (this.consumed >= view.events.length) return;
		let fresh = view.events.slice(this.consumed);
		this.consumed = view.events.length;
		this.queue.enqueue(...buildBattleTasks(fresh, this.hud(view)));
	}

	/** Submits a full turn: the player's move plus an AI-chosen move per foe slot. */
	private submitTurn(game: GameClient, request: BattlePosition[], move: 0 | 1 | 2 | 3) {
		let view = game.engine.selectBattle(this.battleId);
		let commands: TurnCommand[] = request.map((position) =>
			position.side === 0
				? { type: "fight", move, target: { side: 1, slot: 0 } }
				: this.enemyCommand(game, view, position),
		);
		game.dispatch({ type: "submit-battle-turn", battleId: this.battleId, commands });
		this.menu.reset();
		this.processNewEvents(game.engine.selectBattle(this.battleId));
	}

	/**
	 * Resolves the Bag command for the current turn.
	 *
	 * With no nested Bag UI yet, this auto-picks: a usable medicine on the party
	 * member that needs it takes priority (healing is the common in-battle use), then
	 * throwing a ball at a wild target. If neither applies it narrates why.
	 */
	private useBag(game: GameClient, request: BattlePosition[]) {
		if (this.useMedicine(game, request)) return;
		if (this.canCapture) this.throwBall(game);
		else this.enqueueMessage("There's nothing usable in the bag right now.");
	}

	/**
	 * Submits an item-use turn if a bagged medicine can help a party member.
	 *
	 * Scans the bag for a countable medicine whose effect actually changes some party
	 * member (using the same pure rule the engine applies), then submits a `use-item`
	 * turn command for that item and target. Returns whether a turn was submitted so
	 * the caller can fall back to the capture path when nothing is usable.
	 */
	private useMedicine(game: GameClient, request: BattlePosition[]): boolean {
		let view = game.engine.selectBattle(this.battleId);
		let inventory = game.engine.selectInventory();

		for (let entry of inventory.entries) {
			if (entry.count <= 0) continue;
			let item = game.content.items[entry.id];
			let effect = item && "effect" in item ? item.effect : undefined;
			if (!effect || !isMedicineEffect(effect)) continue;

			let target = view.allies.findIndex(
				(ally) =>
					applyMedicine(effect, {
						currentHP: ally.currentHP,
						maxHP: ally.maxHP,
						status: (ally.status as State | null) ?? null,
					}).applied,
			);
			if (target === -1) continue;

			this.submitUseItem(game, request, entry.id, target);
			return true;
		}

		return false;
	}

	/** Submits a use-item turn for the player's slots (foe slots still act). */
	private submitUseItem(
		game: GameClient,
		request: BattlePosition[],
		itemId: string,
		creature: number,
	) {
		let view = game.engine.selectBattle(this.battleId);
		let item = game.content.items[itemId];
		let effect = item && "effect" in item ? item.effect : undefined;
		if (!effect || !isMedicineEffect(effect)) return;

		let commands: TurnCommand[] = request.map((position) =>
			position.side === 0
				? { type: "use-item", itemId, effect, creature }
				: this.enemyCommand(game, view, position),
		);
		game.dispatch({ type: "submit-battle-turn", battleId: this.battleId, commands });
		this.menu.reset();
		this.processNewEvents(game.engine.selectBattle(this.battleId));
	}

	/** Throws the first ball in the bag at the wild target, if one is available. */
	private throwBall(game: GameClient) {
		this.menu.reset();
		let ball = game.engine
			.selectInventory()
			.entries.find((entry) => /ball/i.test(entry.id) && entry.count > 0);
		if (!ball) {
			this.enqueueMessage("You have no balls to throw!");
			return;
		}
		game.dispatch({
			type: "attempt-capture",
			battleId: this.battleId,
			playerId: game.engine.selectPlayer().id,
			itemId: ball.id,
		});
	}

	/** Enqueues a self-contained narration message (used for capture and prompts). */
	private enqueueMessage(text: string) {
		let writer = new Typewriter(text, 50);
		let linger = 0;
		this.queue.enqueue({
			update: (dt) => {
				writer.update(dt);
				this.message = writer.visibleText;
				if (!writer.done) return false;
				linger += dt;
				return linger >= 700;
			},
		});
	}

	/**
	 * Settles the money stake once, when the winner is first known.
	 *
	 * A win (side 0) credits the reward and a loss debits the penalty via
	 * `change-money`; a draw (any other side) leaves the balance untouched. The
	 * `rewardSettled` guard keeps the finish loop from paying out every frame.
	 */
	private settleReward(game: GameClient, winnerSide: number) {
		let reward = this.options.reward;
		if (!reward || this.rewardSettled) return;
		this.rewardSettled = true;
		if (winnerSide === 0) {
			game.dispatch({ type: "change-money", playerId: reward.playerId, amount: reward.winReward });
			this.enqueueMessage(`You won ₽${reward.winReward}!`);
		} else if (winnerSide === 1) {
			game.dispatch({
				type: "change-money",
				playerId: reward.playerId,
				amount: -reward.lossPenalty,
			});
			this.enqueueMessage(`You paid ₽${reward.lossPenalty}...`);
		}
	}

	/** Submits a fleeing turn for the player's slots (foe slots still act). */
	private submitRun(game: GameClient, request: BattlePosition[]) {
		let view = game.engine.selectBattle(this.battleId);
		let commands: TurnCommand[] = request.map((position) =>
			position.side === 0 ? { type: "leave-battle" } : this.enemyCommand(game, view, position),
		);
		game.dispatch({ type: "submit-battle-turn", battleId: this.battleId, commands });
		this.menu.reset();
		this.processNewEvents(game.engine.selectBattle(this.battleId));
	}

	/**
	 * Builds one foe slot's fight command using the deterministic enemy AI.
	 *
	 * Move base power and type come from the authored content the client already
	 * holds; the defender's typing comes from the player's active creature. The AI
	 * picks the slot, and the engine's own struggle fallback covers the empty/no-PP
	 * cases, so this always targets the player's lead slot.
	 */
	private enemyCommand(game: GameClient, view: BattleView, position: BattlePosition): TurnCommand {
		let enemy = view.enemies[position.slot];
		let defender = view.allies[0];
		let defenderTypes = defender ? (game.content.species[defender.speciesId]?.types ?? []) : [];
		let moves: EnemyMoveOption[] = (enemy?.moves ?? []).map((slot, index) => {
			let move = slot.id !== null ? game.content.moves[slot.id] : undefined;
			return {
				index: index as 0 | 1 | 2 | 3,
				id: slot.id,
				pp: slot.pp,
				power: move?.power ?? 0,
				type: move?.type ?? "",
				isStatus: move?.damageClass === DamageClass.Status,
			};
		});
		let move = chooseEnemyAction({ moves, defenderTypes, typeChart: game.content.typeChart });
		return { type: "fight", move, target: { side: 0, slot: 0 } };
	}

	/** Fills forced replacements with each slot's first available bench creature. */
	private submitReplacements(game: GameClient, requests: ReplacementSelection[]) {
		let commands: ReplacementCommand[] = [];
		for (let selection of requests) {
			let creature = selection.choices[0];
			if (creature === undefined) continue;
			commands.push({
				type: "replace",
				target: { side: selection.side, slot: selection.slot },
				creature,
			});
		}
		if (commands.length === 0) return;
		game.dispatch({ type: "submit-battle-replacements", battleId: this.battleId, commands });
		this.processNewEvents(game.engine.selectBattle(this.battleId));
	}

	/** The pending input request, resolved from the most recent request event. */
	private pendingRequest(
		view: BattleView,
	):
		| { type: "turn"; turn: BattlePosition[] }
		| { type: "replacement"; replacement: ReplacementSelection[] }
		| null {
		for (let index = view.events.length - 1; index >= 0; index--) {
			let event = view.events[index]!;
			if (event.type === "request-turn-commands") return { type: "turn", turn: event.requests };
			if (event.type === "request-replacements")
				return { type: "replacement", replacement: event.requests };
			if (event.type === "battle-finished") return null;
		}
		return null;
	}

	/** The player's active creature's move options, or an empty list. */
	private playerMoves(view: BattleView): Array<{ id: string | null; pp: number }> {
		return view.allies[0]?.moves ?? [];
	}

	/** Ensures an HP bar exists per active slot and refreshes maxima when idle. */
	private syncBars(view: BattleView) {
		let refresh = (summary: CreatureSummaryView | undefined, side: number, slot: number) => {
			if (!summary) return;
			let key = `${side}:${slot}`;
			let bar = this.bars.get(key);
			if (!bar) this.bars.set(key, new HpBar(summary.maxHP, summary.currentHP));
			else if (this.queue.idle) bar.setTarget(summary.currentHP, summary.maxHP);
			if (summary.currentHP > 0) this.fainted.delete(key);
		};
		view.allies.forEach((summary, slot) => refresh(summary, 0, slot));
		view.enemies.forEach((summary, slot) => refresh(summary, 1, slot));
	}

	/** Builds the narration surface `event-animations` writes through. */
	private hud(view: BattleView): BattleHud {
		let summaryAt = (position: BattlePosition): CreatureSummaryView | undefined =>
			position.side === 0 ? view.allies[position.slot] : view.enemies[position.slot];
		return {
			setMessage: (text) => (this.message = text),
			nameAt: (position) => summaryAt(position)?.name ?? "?",
			moveName: (moveId) => moveId,
			setHp: (position, remaining) => this.barAt(position)?.setTarget(remaining),
			isSettled: (position) => this.barAt(position)?.settled ?? true,
			markFainted: (position) => this.fainted.add(`${position.side}:${position.slot}`),
		};
	}

	/** The HP bar for a slot, if one exists. */
	private barAt(position: BattlePosition): HpBar | undefined {
		return this.bars.get(`${position.side}:${position.slot}`);
	}

	/** Draws the sky/ground battle backdrop. */
	private drawBackground(ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = theme.BATTLE_BACKDROP.sky;
		ctx.fillRect(0, 0, SCREEN_WIDTH, 112);
		ctx.fillStyle = theme.BATTLE_BACKDROP.ground;
		ctx.fillRect(0, 96, SCREEN_WIDTH, 16);
	}

	/** Draws one combatant as a procedural placeholder sprite. */
	private drawCreature(
		ctx: CanvasRenderingContext2D,
		summary: CreatureSummaryView,
		x: number,
		y: number,
		back: boolean,
	) {
		if (this.fainted.has(`${back ? 0 : 1}:0`)) return;
		ctx.fillStyle = colorFor(summary.speciesId);
		ctx.strokeStyle = theme.CREATURE_PLACEHOLDER.outline;
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.ellipse(x + 24, y + 24, 22, 22, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();
		drawText(ctx, initials(summary.speciesId), x + 24, y + 20, {
			align: "center",
			color: theme.TEXT.inverseWhite,
		});
		void back;
	}

	/** Draws a combatant's name, level, and HP bar. */
	private drawInfo(
		ctx: CanvasRenderingContext2D,
		summary: CreatureSummaryView,
		x: number,
		y: number,
		showNumbers: boolean,
	) {
		Window.frame(ctx, x, y, 104, 26);
		drawText(ctx, `${summary.name}`, x + 6, y + 4);
		drawText(ctx, `L${summary.level}`, x + 98, y + 4, { align: "right" });
		this.barAt({ side: showNumbers ? 0 : 1, slot: 0 })?.draw(ctx, x + 6, y + 16, 92, showNumbers);
	}

	/** Draws the bottom message box with wrapped text. */
	private drawMessage(ctx: CanvasRenderingContext2D, text: string) {
		Window.frame(ctx, 4, 112, 232, 44);
		let lines = wrapText(ctx, text, 220);
		lines.slice(0, 3).forEach((line, index) => drawText(ctx, line, 12, 120 + index * 12));
	}
}

/** A stable pastel color for a species id. */
function colorFor(speciesId: string): string {
	let hash = 0;
	for (let index = 0; index < speciesId.length; index++) {
		hash = (hash * 31 + speciesId.charCodeAt(index)) & 0xffff;
	}
	return theme.creatureColor(hash % 360);
}

/** The first two letters of a species id, for the placeholder sprite. */
function initials(speciesId: string): string {
	return speciesId.slice(0, 2);
}
