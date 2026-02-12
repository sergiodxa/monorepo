import type { Log } from "./types";

/**
 * Immediate logger that outputs each log call directly to console.
 * Use this for non-request contexts like cron jobs or entry.server.tsx error handling.
 */
export class Logger {
	private createLogData(event: string, payload?: Log.Payload) {
		return { ...payload, event, timestamp: Date.now() };
	}

	info(event: string, payload?: Log.Payload) {
		console.info(this.createLogData(event, payload));
	}

	error(event: string, payload?: Log.Payload) {
		console.error(this.createLogData(event, payload));
	}
}
