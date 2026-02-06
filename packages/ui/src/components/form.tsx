import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { FormProps as ReactRouterFormProps } from "react-router";

import { cn } from "@pkg/cn";
import { FormValidationContext } from "react-aria-components";
import { Form as ReactRouterForm } from "react-router";

export type ValidationIssue = StandardSchemaV1.Issue;

export namespace Form {
	export interface Props extends Omit<ReactRouterFormProps, "className"> {
		className?: cn.ClassName;
		/**
		 * Validation issues from `@pkg/validate` or any Standard Schema compliant validator.
		 * Issues are automatically mapped to form fields by their path.
		 *
		 * @example
		 * ```tsx
		 * let result = await validate(request, schema);
		 * if (isFailure(result)) return badRequest({ issues: result.issues });
		 *
		 * // In component:
		 * <Form issues={actionData?.issues}>
		 *   <TextField name="email" />
		 * </Form>
		 * ```
		 */
		issues?: ValidationIssue[];
	}
}

/**
 * Transforms validation issues into the format expected by RAC's FormValidationContext.
 */
function issuesToValidationErrors(issues: ValidationIssue[]): Record<string, string[]> {
	let errors: Record<string, string[]> = {};

	for (let issue of issues) {
		let path = issue.path;
		if (!path || path.length === 0) continue;

		// Build the field name from path segments (e.g., ["user", "email"] -> "user.email")
		let fieldName = path
			.map((segment) => {
				if (typeof segment === "object" && "key" in segment) {
					return String(segment.key);
				}
				return String(segment);
			})
			.join(".");

		if (!errors[fieldName]) errors[fieldName] = [];
		errors[fieldName].push(issue.message);
	}

	return errors;
}

export function Form({ issues, className, ...props }: Form.Props) {
	let validationErrors = issues ? issuesToValidationErrors(issues) : {};

	return (
		<FormValidationContext.Provider value={validationErrors}>
			<ReactRouterForm {...props} className={cn("ui-form", className)} />
		</FormValidationContext.Provider>
	);
}
