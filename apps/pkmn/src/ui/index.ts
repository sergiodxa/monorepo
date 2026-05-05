import type { Engine } from "~/game/engine";
/**
 * Builds the selector-driven browser UI entrypoint for this module. It mounts the
 * current application shell into a host element and translates selector output
 * from the engine boundary into DOM sections, controls, and event history.
 *
 * The module stays focused on presentation concerns by reading derived views,
 * wiring user interactions back through engine dispatch calls, and rerendering
 * from the latest state without mutating engine internals directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameEvent } from "~/game/events";
import type { BattleView } from "~/game/selectors";

/** Mounts the selector-driven UI shell into the given root element. */
export function mountUI(root: HTMLElement, engine: Engine, initialEvents: GameEvent[] = []) {
	let app = createAppShell(engine, initialEvents);
	root.replaceChildren(app);
}

/** Builds the current selector-driven UI shell. */
function createAppShell(engine: Engine, initialEvents: GameEvent[]): HTMLElement {
	let container = document.createElement("main");
	let eventLog = [...initialEvents];

	container.className = "app-shell";
	render();

	return container;

	/** Renders the current engine state without mutating engine internals directly. */
	function render() {
		let player = engine.selectPlayer();
		let activeBattle = engine.selectActiveBattle();

		container.replaceChildren(
			createHeading(player.name),
			createPlayerSection(player),
			createControls(engine, activeBattle, updateEvents),
			createBattleSection(activeBattle),
			createEngineEventsSection(eventLog),
		);
	}

	/** Applies new engine events and triggers a full selector-based rerender. */
	function updateEvents(events: GameEvent[]) {
		eventLog = [...eventLog, ...events];
		render();
	}
}

/** Renders the top-level heading. */
function createHeading(playerName: string): HTMLElement {
	let header = document.createElement("header");
	let heading = document.createElement("h1");
	let summary = document.createElement("p");

	heading.textContent = "Runtime Demo";
	summary.textContent = `${playerName} is loaded through engine selectors.`;
	header.append(heading, summary);

	return header;
}

/** Renders the current player summary from selector views only. */
function createPlayerSection(player: ReturnType<Engine["selectPlayer"]>): HTMLElement {
	let section = document.createElement("section");
	let heading = document.createElement("h2");
	let party = document.createElement("ul");
	let inventory = document.createElement("ul");
	let storage = document.createElement("ul");

	heading.textContent = "Player";
	for (let creature of player.party.creatures) {
		let item = document.createElement("li");
		item.textContent = `${creature.name} Lv.${creature.level} HP ${creature.currentHP}/${creature.maxHP}`;
		party.append(item);
	}

	for (let entry of player.inventory.entries) {
		let item = document.createElement("li");
		item.textContent = `${entry.name} x${entry.count}`;
		inventory.append(item);
	}

	for (let box of player.storage.boxes) {
		let item = document.createElement("li");
		item.textContent = `${box.name}: ${box.creatures.map((creature) => creature.name).join(", ") || "empty"}`;
		storage.append(item);
	}

	section.append(
		heading,
		createSubsection("Party", party),
		createSubsection("Inventory", inventory),
		createSubsection("Storage", storage),
	);

	return section;
}

/** Renders the command buttons that talk to the engine boundary. */
function createControls(
	engine: Engine,
	activeBattle: BattleView | null,
	onEvents: (events: GameEvent[]) => void,
): HTMLElement {
	let section = document.createElement("section");
	let heading = document.createElement("h2");
	let markSeenButton = document.createElement("button");
	let addItemButton = document.createElement("button");
	let advanceBattleButton = document.createElement("button");

	heading.textContent = "Controls";
	markSeenButton.textContent = "Record Sighting";
	addItemButton.textContent = "Add Potion";
	advanceBattleButton.textContent = activeBattle ? "Advance Battle" : "No Active Battle";
	advanceBattleButton.disabled = activeBattle === null;

	markSeenButton.addEventListener("click", () => {
		onEvents(
			engine.dispatch({
				type: "mark-species-seen",
				playerId: "player:hero",
				speciesId: "BULBASAUR",
			}),
		);
	});

	addItemButton.addEventListener("click", () => {
		onEvents(
			engine.dispatch({
				type: "add-inventory-item",
				playerId: "player:hero",
				itemId: "POTION",
				count: 1,
			}),
		);
	});

	advanceBattleButton.addEventListener("click", () => {
		let battle = engine.selectActiveBattle();
		if (!battle) return;
		let lastEvent = battle.events[battle.events.length - 1];
		if (!lastEvent) return;

		if (lastEvent.type === "request-turn-commands") {
			onEvents(
				engine.dispatch({
					type: "submit-battle-turn",
					battleId: battle.id,
					commands: lastEvent.requests.map((request) => ({
						type: "fight" as const,
						move: 0,
						target: { side: request.side === 0 ? 1 : 0, slot: 0 },
					})),
				}),
			);
		}

		if (lastEvent.type === "request-replacements") {
			let commands = lastEvent.requests
				.filter((request) => request.choices.length > 0)
				.map((request) => ({
					type: "replace" as const,
					target: { side: request.side, slot: request.slot },
					creature: request.choices[0]!,
				}));

			onEvents(
				engine.dispatch({ type: "submit-battle-replacements", battleId: battle.id, commands }),
			);
		}
	});

	section.append(heading, markSeenButton, addItemButton, advanceBattleButton);
	return section;
}

/** Renders the current active battle from the selector layer. */
function createBattleSection(activeBattle: BattleView | null): HTMLElement {
	let section = document.createElement("section");
	let heading = document.createElement("h2");
	let summary = document.createElement("p");
	let allies = document.createElement("ul");
	let enemies = document.createElement("ul");
	let events = document.createElement("ol");

	heading.textContent = "Battle";
	if (activeBattle === null) {
		summary.textContent = "No active battle.";
		section.append(heading, summary);
		return section;
	}

	summary.textContent = `Turn ${activeBattle.turn}, phase ${activeBattle.phase}, pending ${activeBattle.pendingRequest?.type ?? "none"}.`;
	for (let creature of activeBattle.allies) {
		let item = document.createElement("li");
		item.textContent = `${creature.name} HP ${creature.currentHP}/${creature.maxHP}`;
		allies.append(item);
	}
	for (let creature of activeBattle.enemies) {
		let item = document.createElement("li");
		item.textContent = `${creature.name} HP ${creature.currentHP}/${creature.maxHP}`;
		enemies.append(item);
	}
	for (let event of activeBattle.events) {
		let item = document.createElement("li");
		item.textContent = JSON.stringify(event);
		events.append(item);
	}

	section.append(
		heading,
		summary,
		createSubsection("Allies", allies),
		createSubsection("Enemies", enemies),
		createSubsection("Battle Events", events),
	);
	return section;
}

/** Renders the latest engine-level events emitted by dispatch calls. */
function createEngineEventsSection(events: GameEvent[]): HTMLElement {
	let section = document.createElement("section");
	let heading = document.createElement("h2");
	let list = document.createElement("ol");

	heading.textContent = "Engine Events";
	for (let event of events) {
		let item = document.createElement("li");
		item.textContent = JSON.stringify(event);
		list.append(item);
	}

	section.append(heading, list);
	return section;
}

/** Wraps a list element in a titled subsection. */
function createSubsection(title: string, content: HTMLElement): HTMLElement {
	let wrapper = document.createElement("section");
	let heading = document.createElement("h3");
	heading.textContent = title;
	wrapper.append(heading, content);
	return wrapper;
}
