/**
 * Sample chapter route that, on form submission, validates the email and subscribes
 * the visitor, then transforms the bundled sample Markdoc into React to render the
 * free chapter; it shows the chapter even when the email already exists and themes
 * code with Prism GitHub styles.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import Markdoc from "@markdoc/markdoc";
import { getClientIP } from "@pkg/get-client-ip";
import { badRequest, ok } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate, ValidationError } from "@pkg/validate";
import dark from "prism-theme-github/themes/prism-theme-github-copilot.css?url";
import light from "prism-theme-github/themes/prism-theme-github-light.css?url";
import * as React from "react";

import { Fence, fence } from "~/components/fence";
import { SampleChapterForm } from "~/components/sample-chapter-form";
import sample from "~/data/sample.md?raw";
import { subscribeSchema } from "~/schemas/subscribe";
import { ButtondownError } from "~/services/buttondown";
import { subscribe } from "~/use-case/subscribe";

import type { Route } from "./+types/sample";

export async function action({ request }: Route.ActionArgs) {
	let formData = await request.formData();
	let validationResult = await validate(formData, subscribeSchema);

	if (isFailure(validationResult)) {
		let error = validationResult.error;
		if (error instanceof ValidationError && error.issues[0]) {
			return badRequest({ error: error.issues[0].message });
		}
		return badRequest({ error: "Invalid form data" });
	}

	let payload = validationResult.data;
	let ipAddress = getClientIP(request);

	let result = await subscribe(payload, ipAddress);

	let sampleContent = Markdoc.transform(Markdoc.parse(sample), { nodes: { fence } });

	if (isFailure(result)) {
		let error = result.error;

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

			// If already exists, show them the content anyway
			if (error.code === "email_already_exists") {
				return ok({ value: sampleContent });
			}
		}

		return badRequest({ error: error.message });
	}

	return ok({ value: sampleContent });
}

export default function Component({ actionData }: Route.ComponentProps) {
	if (actionData?.ok) {
		return (
			<article className="mx-auto prose max-w-prose px-5 py-10 prose-stone lg:prose-xl lg:py-20 dark:prose-invert">
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
