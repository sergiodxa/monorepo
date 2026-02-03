type LogPayload = Record<string, unknown>;

export class Logger {
	private createLogData(event: string, payload?: LogPayload) {
		return { ...payload, event, timestamp: Date.now() };
	}

	info(event: string, payload?: LogPayload) {
		console.info(this.createLogData(event, payload));
	}

	warn(event: string, payload?: LogPayload) {
		console.warn(this.createLogData(event, payload));
	}

	error(event: string, payload?: LogPayload) {
		console.error(this.createLogData(event, payload));
	}
}

export let logger = new Logger();
