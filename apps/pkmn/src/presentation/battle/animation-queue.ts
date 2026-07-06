/**
 * A strictly-ordered queue of animation tasks for the battle scene.
 *
 * Engine battle events arrive in bursts (everything between two input requests);
 * the scene turns each into one or more tasks and drains them in order, so the
 * presentation is a fold over the ordered event stream rather than a diff of
 * before/after state. A task is any object with an `update(dt)` that returns true
 * when finished; the small factories here (wait, callback, run) cover the common
 * shapes so callers rarely define a task class.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A unit of battle animation; `update` returns true when the task is complete. */
export interface AnimationTask {
	update(dt: number): boolean;
}

/** Runs animation tasks one at a time, in enqueue order. */
export class AnimationQueue {
	/** Pending tasks; the first entry is the one currently running. */
	private tasks: AnimationTask[] = [];

	/** Appends tasks to the end of the queue. */
	enqueue(...tasks: AnimationTask[]) {
		this.tasks.push(...tasks);
	}

	/** Advances only the current task, dropping it when it completes. */
	update(dt: number) {
		let current = this.tasks[0];
		if (!current) return;
		if (current.update(dt)) this.tasks.shift();
	}

	/** Removes every queued task. */
	clear() {
		this.tasks = [];
	}

	/** True when no tasks remain. */
	get idle(): boolean {
		return this.tasks.length === 0;
	}
}

/** A task that simply waits `ms` milliseconds. */
export function waitTask(ms: number): AnimationTask {
	let elapsed = 0;
	return {
		update(dt) {
			elapsed += dt;
			return elapsed >= ms;
		},
	};
}

/** A task that runs `fn` once and completes immediately. */
export function callbackTask(fn: () => void): AnimationTask {
	return {
		update() {
			fn();
			return true;
		},
	};
}

/** A task backed directly by an `update` function. */
export function runTask(update: (dt: number) => boolean): AnimationTask {
	return { update };
}
