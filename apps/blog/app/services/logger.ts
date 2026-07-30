/**
 * Logger service provider for blog. Registers the shared `@pkg/logger` Logger
 * as an application-container singleton for the current isolate, giving
 * non-request-scoped infrastructure code a common logging instance.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Container, ServiceProvider } from "@pkg/service-container";

import { Logger } from "@pkg/logger";

/** Registers the shared application logger for non-request-scoped infrastructure logs. */
export class LoggerServiceProvider implements ServiceProvider {
	/** Stores a singleton logger instance for the current isolate. */
	register(container: Container) {
		container.singleton(Logger, () => new Logger());
	}
}
