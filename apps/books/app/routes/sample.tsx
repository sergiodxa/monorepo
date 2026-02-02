import { FormParser } from "@edgefirst-dev/data/parser";
import Markdoc from "@markdoc/markdoc";
import { getClientIP } from "@pkg/get-client-ip";
import { badRequest, ok } from "@pkg/response";
import dark from "prism-theme-github/themes/prism-theme-github-copilot.css?url";
import light from "prism-theme-github/themes/prism-theme-github-light.css?url";
import * as React from "react";
import { Fence, fence } from "~/components/fence";
import { SampleChapterForm } from "~/components/sample-chapter-form";
import sample from "~/data/sample.md?raw";
import { SubscribePayload } from "~/data/subscribe-payload";
import { ButtondownError } from "~/services/buttondown";
import { subscribe } from "~/use-case/subscribe";
import type { Route } from "./+types/sample";

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData();
	const parser = new FormParser(formData);
	const payload = new SubscribePayload(parser);

	let ipAddress = getClientIP(request);

	try {
		await subscribe(payload, ipAddress);
		return ok({
			value: Markdoc.transform(Markdoc.parse(sample), { nodes: { fence } }),
		});
	} catch (error) {
		if (error instanceof ButtondownError) {
			if (error.code === "subscriber_blocked") {
				return badRequest({
					error:
						"My upstream provider is blocking you for some reason.\nPlease try with another email address and sorry for the inconvenience.",
				});
			}

			if (error.code === "email_invalid") {
				return badRequest({
					error: "Invalid email address. \nPlease try with another email address.",
				});
			}

			if (error.code === "email_already_exists") {
				return ok({
					value: Markdoc.transform(Markdoc.parse(sample), {
						nodes: { fence },
					}),
				});
			}
		}

		if (error instanceof Error) return badRequest({ error: error.message });
		return badRequest({ error: "Unknown error" });
	}
}

export default function Component({ actionData }: Route.ComponentProps) {
	if (actionData?.ok) {
		return (
			<article className="prose prose-stone dark:prose-invert py-10 lg:py-20 px-5 max-w-prose mx-auto lg:prose-xl">
				<link rel="stylesheet" href={dark} media="(prefers-color-scheme: dark)" />
				<link rel="stylesheet" href={light} media="(prefers-color-scheme: light)" />
				{Markdoc.renderers.react(actionData.value, React, {
					components: { Fence },
				})}
			</article>
		);
	}

	if (actionData?.ok === false) {
		return <SampleChapterForm error={actionData.error} />;
	}

	return <SampleChapterForm />;
}
