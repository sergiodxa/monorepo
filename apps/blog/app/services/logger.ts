/**
 * Logger service provider for blog. Registers the shared `@sdxc/logger` Logger
 * as an application-container singleton for the current isolate, giving
 * non-request-scoped infrastructure code a common logging instance.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Container, ServiceProvider } from "@sdxc/service-container";

import { Logger } from "@sdxc/logger";

/** Registers the shared application logger for non-request-scoped infrastructure logs. */
export class LoggerServiceProvider implements ServiceProvider {
	register(container: Container) {
		container.singleton(Logger, () => new Logger());
	}
}
