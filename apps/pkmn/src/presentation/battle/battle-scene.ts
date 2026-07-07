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
import type { GameEvent } from "~/game/events";
import type { BattleView, CreatureSummaryView } from "~/game/selectors";
import type { MoveSet } from "~/game/world/creature";
import type { BattleId, CreatureId, PlayerId } from "~/game/world/ids";

import { DamageClass } from "~/game/data/move";
import { isMedicineEffect } from "~/game/systems/medicine-system";

import type { Scene } from "../core/scene";

import { GameClient } from "../core/game-client";
import { Button } from "../core/input";
import { SCREEN_WIDTH } from "../core/loop";
import { type Atlas, drawSprite } from "../render/atlas";
import { buildPlaceholderAtlas } from "../render/placeholder-atlas";
import { drawText, Typewriter, wrapText } from "../render/text";
import * as theme from "../render/theme";
import { Window } from "../render/window";
import { EvolutionScene } from "../scenes/evolution";
import { LearnMoveScene } from "../scenes/learn-move";

import type { SfxPlayer } from "./battle-sfx";

import { AnimationQueue } from "./animation-queue";
import { BattleBag, type BattleBagItem, battleItemUse } from "./battle-bag";
import { sfxForGameEvent } from "./battle-sfx";
import { BattleSwitch, decideReplacement, type SwitchChoice } from "./battle-switch";
import { BattleCommandMenu } from "./command-menu";
import { chooseEnemyAction, type EnemyMoveOption } from "./enemy-ai";
import { buildBattleTasks, type BattleHud } from "./event-animations";
import { HpBar } from "./hp-bar";
import { statusBoxLayout } from "./status-layout";

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
	/** Opposing trainer's name; drives the intro/defeat lines when set (trainer fights). */
	trainerName?: string;
}

/** Renders and drives one battle from the engine's event stream. */
export class BattleScene implements Scene {
	/** The ordered animation queue for the current event burst. */
	private readonly queue = new AnimationQueue();

	/** The command menu shown on the player's turn. */
	private readonly menu = new BattleCommandMenu();

	/** The in-battle item menu, opened from the action menu's Bag option. */
	private readonly bag = new BattleBag();

	/** Whether the Bag item menu is currently open over the action menu. */
	private bagOpen = false;

	/** The creature picker for forced replacements and voluntary switches. */
	private readonly switcher = new BattleSwitch();

	/**
	 * How the switch picker is open, or null when it is closed.
	 *
	 * `replacement` fills a forced faint replacement for the player slot in
	 * `switchSlot` (cancel blocked); `switch` is a voluntary switch from the action
	 * menu that spends the turn (cancel returns to the action menu).
	 */
	private switchMode: "replacement" | "switch" | null = null;

	/** The player slot the open replacement picker fills, when in `replacement` mode. */
	private switchSlot = 0;

	/** Chosen replacement creature per player slot, cached across frames mid-prompt. */
	private readonly playerChoices = new Map<number, number>();

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
	 * The atlas creatures are drawn from, or null to draw procedural placeholders.
	 *
	 * Prefers a manifest atlas ("overworld") and falls back to the generated demo
	 * atlas; when neither is available the scene draws the procedural per-species
	 * blob exactly as before.
	 */
	private atlas: Atlas | null = null;

	/**
	 * The effect player, captured on enter so `onEngineEvents` can reach it.
	 *
	 * Engine events (a level-up rides in on `creature-experience-granted`) arrive
	 * through `onEngineEvents`, which the scene stack calls without the client, so
	 * the scene keeps the audio reference from `enter`. Null before enter; every
	 * play is a safe no-op regardless.
	 */
	private audio: SfxPlayer | null = null;

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
			// A level-up (creature-experience-granted crossing a level) plays its jingle
			// as it arrives; other engine events carry no sound.
			let sfx = sfxForGameEvent(event);
			if (sfx) this.audio?.playSynthSfx(sfx);
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
		this.audio = game.audio;
		this.bag.useAudio(game.audio);
		this.switcher.useAudio(game.audio);
		this.atlas = game.assets.atlas("overworld") ?? buildPlaceholderAtlas();
		let view = game.engine.selectBattle(this.battleId);
		this.syncBars(view);
		let foe = view.enemies[0];
		let trainerName = this.options.trainerName;
		if (trainerName) this.message = `${trainerName} wants to battle!`;
		else if (foe) this.message = `A wild ${foe.name} appeared!`;
		this.consumed = view.events.length; // the opening burst needs no narration
	}

	exit() {
		this.queue.clear();
	}

	update(game: GameClient, dt: number) {
		let view = game.engine.selectBattle(this.battleId);
		for (let bar of this.bars.values()) bar.update(dt);

		this.processNewEvents(game, view);
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
			let trainerName = this.options.trainerName;
			this.message = this.captured
				? "The wild creature was caught!"
				: winnerSide === 0
					? trainerName
						? `You defeated ${trainerName}!`
						: "You won the battle!"
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
			if (this.bagOpen) {
				this.updateBag(game, view, request.turn);
				return;
			}
			if (this.switchMode === "switch") {
				this.updateVoluntarySwitch(game, view, request.turn);
				return;
			}
			let moves = this.playerMoves(view);
			let result = this.menu.update(game.input, moves);
			if (result?.kind === "fight") this.submitTurn(game, request.turn, result.move);
			else if (result?.kind === "run") this.submitRun(game, request.turn);
			else if (result?.kind === "bag") this.openBag();
			else if (result?.kind === "switch") this.openVoluntarySwitch(view);
		} else if (request?.type === "replacement") {
			this.updateReplacement(game, view, request.replacement);
		}
	}

	render(game: GameClient, ctx: CanvasRenderingContext2D) {
		let view = game.engine.selectBattle(this.battleId);

		// The switch/replacement picker is a full-screen party list drawn over the
		// battlefield, mirroring the party screen.
		if (this.switchMode !== null && this.queue.idle) {
			this.switcher.render(ctx, this.switcherChoices(view));
			return;
		}

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
			if (this.bagOpen) {
				this.bag.render(
					ctx,
					this.battleBagItems(game),
					view.allies.map((ally) => ally.name),
				);
			} else this.menu.render(ctx, this.playerMoves(view));
		}
	}

	/** The choices the open switch picker should draw, per its current mode. */
	private switcherChoices(view: BattleView): SwitchChoice[] {
		if (this.switchMode === "replacement") {
			let request = this.pendingRequest(view);
			let selection =
				request?.type === "replacement"
					? request.replacement.find((entry) => entry.side === 0 && entry.slot === this.switchSlot)
					: undefined;
			return this.switchChoices(view, selection?.choices ?? []);
		}
		return this.voluntarySwitchChoices(view);
	}

	/** Turns any unconsumed battle-log events into queued animation tasks. */
	private processNewEvents(game: GameClient, view: BattleView) {
		if (this.consumed >= view.events.length) return;
		let fresh = view.events.slice(this.consumed);
		this.consumed = view.events.length;
		this.queue.enqueue(...buildBattleTasks(fresh, this.hud(view), game.audio));
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
		this.processNewEvents(game, game.engine.selectBattle(this.battleId));
	}

	/** Opens the in-battle item menu over the action menu. */
	private openBag() {
		this.bagOpen = true;
		this.bag.reset();
	}

	/**
	 * Drives the open Bag menu for the current turn and routes the chosen item.
	 *
	 * A ball routes to the capture attempt, a medicine submits a `use-item` turn on
	 * the chosen active party member, and cancelling closes the bag back to the
	 * action menu. Selecting the bag no longer captures on its own — the player picks
	 * here — which is the behavior the regression tests lock in.
	 */
	private updateBag(game: GameClient, view: BattleView, request: BattlePosition[]) {
		let items = this.battleBagItems(game);
		let targets = view.allies.map((ally) => ally.name);
		let result = this.bag.update(game.input, items, targets);
		if (!result) return;
		if (result.kind === "cancel") {
			this.bagOpen = false;
			return;
		}
		this.bagOpen = false;
		if (result.kind === "ball") this.throwBall(game);
		else this.submitUseItem(game, request, result.itemId, result.target);
	}

	/**
	 * Builds the usable battle items the bag lists from the current inventory.
	 *
	 * Each stocked item is classified as a ball or a medicine; balls are dropped when
	 * capture is disallowed (trainer fights), and everything else the bag cannot use
	 * in battle is left out. Order follows the inventory so the list is stable.
	 */
	private battleBagItems(game: GameClient): BattleBagItem[] {
		let items: BattleBagItem[] = [];
		for (let entry of game.engine.selectInventory().entries) {
			if (entry.count <= 0) continue;
			let use = battleItemUse(game.content.items[entry.id]);
			if (use === null) continue;
			if (use === "ball" && !this.canCapture) continue;
			items.push({ id: entry.id, name: entry.name, count: entry.count, use });
		}
		return items;
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
		this.processNewEvents(game, game.engine.selectBattle(this.battleId));
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
		this.processNewEvents(game, game.engine.selectBattle(this.battleId));
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

	/**
	 * Resolves the forced replacements requested after a burst of faints.
	 *
	 * Enemy slots (side ≠ 0) auto-send their first available bench creature, matching
	 * the deterministic enemy AI. A player slot (side 0) is decided by
	 * `decideReplacement`: a lone healthy creature is auto-sent, while two or more open
	 * a blocking picker so the player chooses which creature to send in — the fainted
	 * creature is never left active. Because the engine validates one command per
	 * request, the chosen player creature and the auto enemy creatures are submitted
	 * together once every player slot has a choice. `playerChoices` caches choices
	 * across frames while the picker is open.
	 */
	private updateReplacement(game: GameClient, view: BattleView, requests: ReplacementSelection[]) {
		// The first player slot still waiting on a picker choice, if any.
		let pendingPrompt = requests.find(
			(request) =>
				request.side === 0 &&
				decideReplacement(request.choices).kind === "prompt" &&
				this.playerChoices.get(request.slot) === undefined,
		);

		if (pendingPrompt) {
			this.message = null;
			if (this.switchMode !== "replacement" || this.switchSlot !== pendingPrompt.slot) {
				this.switchMode = "replacement";
				this.switchSlot = pendingPrompt.slot;
				this.switcher.open(true);
			}
			let result = this.switcher.update(
				game.input,
				this.switchChoices(view, pendingPrompt.choices),
			);
			if (result?.kind === "switch") {
				this.playerChoices.set(pendingPrompt.slot, result.creature);
				this.switchMode = null;
			}
			return;
		}

		// Every player prompt is answered: assemble one command per requested slot.
		let commands: ReplacementCommand[] = [];
		for (let selection of requests) {
			let creature =
				selection.side === 0 ? this.resolvePlayerReplacement(selection) : selection.choices[0];
			if (creature === undefined) continue;
			commands.push({
				type: "replace",
				target: { side: selection.side, slot: selection.slot },
				creature,
			});
		}
		this.playerChoices.clear();
		this.switchMode = null;
		if (commands.length === 0) return;
		game.dispatch({ type: "submit-battle-replacements", battleId: this.battleId, commands });
		this.processNewEvents(game, game.engine.selectBattle(this.battleId));
	}

	/** The creature index to send into one player replacement slot (auto or picked). */
	private resolvePlayerReplacement(selection: ReplacementSelection): number | undefined {
		let decision = decideReplacement(selection.choices);
		if (decision.kind === "auto") return decision.creature;
		if (decision.kind === "prompt") return this.playerChoices.get(selection.slot);
		return undefined;
	}

	/** Opens the voluntary switch picker over the action menu (cancel allowed). */
	private openVoluntarySwitch(view: BattleView) {
		if (this.voluntarySwitchChoices(view).length === 0) {
			// Nothing healthy on the bench to switch to; leave the action menu up.
			this.enqueueMessage("There's no one else to send in!");
			return;
		}
		this.switchMode = "switch";
		this.switcher.open(false);
	}

	/**
	 * Drives the open voluntary switch picker and submits the switch as a turn action.
	 *
	 * Cancelling returns to the action menu. Confirming submits a `switch` turn
	 * command for the player's lead slot — an engine turn-action that resolves before
	 * moves and spends the player's turn, so the foe still acts. The chosen creature is
	 * the team-local bench index the picker reports.
	 */
	private updateVoluntarySwitch(game: GameClient, view: BattleView, request: BattlePosition[]) {
		this.message = null;
		let result = this.switcher.update(game.input, this.voluntarySwitchChoices(view));
		if (!result) return;
		this.switchMode = null;
		if (result.kind === "cancel") {
			this.menu.reset();
			return;
		}
		this.submitSwitch(game, request, result.creature);
	}

	/**
	 * Submits a voluntary switch for the player's lead slot; foe slots still act.
	 *
	 * The switch is one player-side turn command (the engine orders it ahead of moves
	 * by priority), and each foe slot gets its AI-chosen move, so switching consumes
	 * the turn exactly like fighting does.
	 */
	private submitSwitch(game: GameClient, request: BattlePosition[], creature: number) {
		let view = game.engine.selectBattle(this.battleId);
		let commands: TurnCommand[] = request.map((position) =>
			position.side === 0
				? { type: "switch", target: { side: 0, slot: position.slot }, creature }
				: this.enemyCommand(game, view, position),
		);
		game.dispatch({ type: "submit-battle-turn", battleId: this.battleId, commands });
		this.menu.reset();
		this.processNewEvents(game, game.engine.selectBattle(this.battleId));
	}

	/** The healthy benched creatures the player may voluntarily switch the lead slot to. */
	private voluntarySwitchChoices(view: BattleView): SwitchChoice[] {
		let active = view.allies[0];
		let choices: number[] = [];
		view.allies.forEach((ally, index) => {
			if (index === 0) return; // the active lead cannot switch to itself
			if (ally.id === active?.id) return;
			if (ally.currentHP <= 0) return;
			choices.push(index);
		});
		return this.switchChoices(view, choices);
	}

	/** Maps a list of team-local ally indices to the picker's display rows. */
	private switchChoices(view: BattleView, choices: number[]): SwitchChoice[] {
		let rows: SwitchChoice[] = [];
		for (let creature of choices) {
			let ally = view.allies[creature];
			if (!ally) continue;
			rows.push({
				creature,
				name: ally.name,
				level: ally.level,
				currentHP: ally.currentHP,
				maxHP: ally.maxHP,
				status: ally.status,
			});
		}
		return rows;
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
			// A slot's bar is reused across replacements; bind it to the active creature
			// so it snaps to a fresh creature's HP (instead of easing up from 0) and only
			// eases ordinary damage/heal while the animation queue is idle.
			else if (this.queue.idle) bar.bindTo(summary.id, summary.currentHP, summary.maxHP);
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
			switchedIn: (position) => {
				let key = `${position.side}:${position.slot}`;
				this.fainted.delete(key);
				let summary = summaryAt(position);
				// Snap the reused slot bar onto the fresh creature at a full bar so a
				// following drain eases down rather than the bar climbing up from 0.
				if (summary) this.barAt(position)?.bindTo(summary.id, summary.maxHP, summary.maxHP);
			},
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

	/**
	 * Draws one combatant from the atlas creature region, or procedurally.
	 *
	 * The 32px atlas silhouette is centered on the same spot the procedural blob
	 * used; the back (ally) sprite is mirrored so the two face each other. The
	 * species initials are still drawn over the sprite so different species read
	 * apart even sharing one generic silhouette. When no atlas art is available the
	 * original per-species colored ellipse is drawn instead.
	 */
	private drawCreature(
		ctx: CanvasRenderingContext2D,
		summary: CreatureSummaryView,
		x: number,
		y: number,
		back: boolean,
	) {
		if (this.fainted.has(`${back ? 0 : 1}:0`)) return;

		if (drawSprite(ctx, this.atlas, "creature.body", x + 8, y + 8, { flipX: back })) {
			drawText(ctx, initials(summary.speciesId), x + 24, y + 20, {
				align: "center",
				color: theme.TEXT.inverseWhite,
			});
			return;
		}

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
	}

	/** Draws a combatant's name, level, and HP bar. */
	private drawInfo(
		ctx: CanvasRenderingContext2D,
		summary: CreatureSummaryView,
		x: number,
		y: number,
		showNumbers: boolean,
	) {
		// Stack the rows so the HP fraction (when shown) fits inside the frame above
		// the bar instead of spilling below it.
		let layout = statusBoxLayout(showNumbers, HpBar.HEIGHT);
		Window.frame(ctx, x, y, 104, layout.height);
		drawText(ctx, `${summary.name}`, x + 6, y + layout.nameY);
		drawText(ctx, `L${summary.level}`, x + 98, y + layout.nameY, { align: "right" });
		this.barAt({ side: showNumbers ? 0 : 1, slot: 0 })?.draw(
			ctx,
			x + 6,
			y + layout.barY,
			92,
			showNumbers,
			y + layout.hpTextY,
		);
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
