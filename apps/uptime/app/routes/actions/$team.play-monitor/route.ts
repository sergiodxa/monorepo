import { badRequest, notFound, ok } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { toast } from "sonner";
import { z } from "zod/v4";

import { db } from "~/middleware/drizzle";
import { i18next } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { team } from "~/middleware/team";
import Monitor from "~/models/monitor";
import retry from "~/utils/retry";

import type { Route } from "./+types/route";

const inputSchema = z.object({ monitorId: z.uuid() });

export async function action({ request, context }: Route.ActionArgs) {
	let result = await validate(request, inputSchema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.play-monitor.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.playMonitor.errors.generic") });
	}

	let monitor = await db().query.monitors.findFirst({
		where(fields, operators) {
			return operators.eq(fields.id, result.data.monitorId);
		},
	});

	if (!monitor) {
		logger().info("action.play-monitor.not-found", {
			monitorId: result.data.monitorId,
		});
		return notFound({ message: t("actions.playMonitor.errors.notFound") });
	}

	let { workflow } = await Monitor.ping(db(), monitor.id);

	logger().info("action.play-monitor.triggered", {
		teamId: team().id,
		monitorId: monitor.id,
	});

	let promise = retry(500, async ({ stop, retry, attempts }) => {
		if (attempts > 5) stop("Too many attempts");
		let { status } = await workflow.status();
		if (status === "complete") return;
		if (status === "terminated") stop("Monitor was terminated");
		if (status === "errored") stop("Monitor encountered an error");
		if (status === "unknown") stop("Monitor status is unknown");
		retry();
	});

	return ok({
		promise,
		message: {
			pending: t("actions.playMonitor.pending", monitor),
			success: t("actions.playMonitor.success", monitor),
			failure: t("actions.playMonitor.failure", monitor),
		},
	});
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	let result = await serverAction();

	if (result.ok) {
		toast.promise(result.promise, {
			loading: result.message.pending,
			error: result.message.failure,
			success: result.message.success,
		});

		// We need to await the promise to ensure revalidation happens after the
		// promise is resolved
		try {
			await result.promise;
		} catch {
			// Do nothing in case of error, the toast will handle it
		}
	} else {
		toast.error(result.message);
	}

	return result;
}
