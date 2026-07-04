import type { Handle } from "remix/ui";

import { ok } from "@pkg/http/response/html";
import { css } from "remix/ui";
import { renderToString } from "remix/ui/server";

import action from "~/lib/action";
import { Layout } from "~/tenant/components/layout";
import Brand from "~/tenant/models/brand";
import EmailVerificationToken from "~/tenant/models/email-verification-token";
import Subject from "~/tenant/models/subject";

export default action<"GET", "/verify-email">(async ({ db, request, logger }) => {
	let log = logger.loader("/verify-email");
	let url = new URL(request.url);
	let token = url.searchParams.get("token");

	let brand = await Brand.show(db);

	if (!token) {
		log.info("Missing verification token");
		let body = await renderToString(
			<VerifyEmailPage brand={brand} status="error" message="Invalid verification link." />,
		);
		return ok(body);
	}

	try {
		let { subjectId } = await EmailVerificationToken.consume(db, token);
		await Subject.verifyEmail(db, subjectId);

		log.info("Email verified", { subjectId });

		let body = await renderToString(
			<VerifyEmailPage
				brand={brand}
				status="success"
				message="Your email has been verified successfully. You can now close this window."
			/>,
		);
		return ok(body);
	} catch (error) {
		let message = "Verification failed. Please try again.";

		if (error instanceof EmailVerificationToken.ExpiredTokenError) {
			log.info("Expired verification token");
			message = "This verification link has expired. Please request a new one.";
		} else if (error instanceof EmailVerificationToken.InvalidTokenError) {
			log.info("Invalid verification token");
			message = "This verification link is invalid or has already been used.";
		} else {
			log.error("Verification failed", { error: String(error) });
		}

		let body = await renderToString(
			<VerifyEmailPage brand={brand} status="error" message={message} />,
		);
		return ok(body);
	}
});

interface VerifyEmailPageProps {
	brand: Awaited<ReturnType<typeof Brand.show>>;
	status: "success" | "error";
	message: string;
}

/**
 * Renders the email verification result page for success and error states.
 * @param handle - Component handle exposing the brand, status, and message props.
 * @returns A render function producing the page markup.
 */
function VerifyEmailPage(handle: Handle<VerifyEmailPageProps>) {
	return () => {
		let { brand, status, message } = handle.props;
		let backgroundColor = brand.background_color;
		return (
			<Layout title={status === "success" ? "Email Verified" : "Verification Failed"}>
				<div
					mix={[
						css({
							minHeight: "100vh",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							backgroundColor: backgroundColor,
							padding: "1rem",
						}),
					]}
				>
					<div
						mix={[
							css({
								maxWidth: "400px",
								width: "100%",
								backgroundColor: "#fff",
								borderRadius: "0.5rem",
								boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1)",
								padding: "2rem",
								textAlign: "center",
							}),
						]}
					>
						{brand.logo_url && (
							<img
								src={brand.logo_url}
								alt="Logo"
								mix={[
									css({
										maxWidth: "150px",
										marginBottom: "1.5rem",
									}),
								]}
							/>
						)}

						{status === "success" ? (
							<>
								<div
									mix={[
										css({
											width: "64px",
											height: "64px",
											borderRadius: "50%",
											backgroundColor: "#10B981",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											margin: "0 auto 1.5rem",
										}),
									]}
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										mix={[css({ width: "32px", height: "32px", color: "#fff" })]}
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
									</svg>
								</div>
								<h1
									mix={[
										css({
											fontSize: "1.5rem",
											fontWeight: "600",
											color: "#111827",
											marginBottom: "0.5rem",
										}),
									]}
								>
									Email Verified
								</h1>
							</>
						) : (
							<>
								<div
									mix={[
										css({
											width: "64px",
											height: "64px",
											borderRadius: "50%",
											backgroundColor: "#EF4444",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											margin: "0 auto 1.5rem",
										}),
									]}
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										mix={[css({ width: "32px", height: "32px", color: "#fff" })]}
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</div>
								<h1
									mix={[
										css({
											fontSize: "1.5rem",
											fontWeight: "600",
											color: "#111827",
											marginBottom: "0.5rem",
										}),
									]}
								>
									Verification Failed
								</h1>
							</>
						)}

						<p
							mix={[
								css({
									color: "#6B7280",
									marginBottom: "1.5rem",
								}),
							]}
						>
							{message}
						</p>

						{status === "error" && (
							<p
								mix={[
									css({
										fontSize: "0.875rem",
										color: "#9CA3AF",
									}),
								]}
							>
								If you continue to have issues, please contact support.
							</p>
						)}

						{brand.custom_css && <style>{brand.custom_css}</style>}
					</div>
				</div>
			</Layout>
		);
	};
}
