import type { Container, ServiceProvider } from "@pkg/service-container";

import { Logger } from "@pkg/logger";

/** Registers the shared application logger for non-request-scoped infrastructure logs. */
export class LoggerServiceProvider implements ServiceProvider {
	/** Stores a singleton logger instance for the current isolate. */
	register(container: Container) {
		container.singleton(Logger, () => new Logger());
	}
}
