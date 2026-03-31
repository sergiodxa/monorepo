import { redirect } from "@pkg/http/response";
import middleware from "@pkg/remix-helpers/middleware";
import { Auth, type GoodAuth } from "remix/auth-middleware";

export default middleware((ctx, next) => {
	let auth = ctx.get(Auth) as GoodAuth<{ role: "admin" | "guest" }>;
	if (auth.identity.role === "admin") return next();
	return redirect("/", { status: redirect.Status.SeeOther });
});
