import requestHandler from "../lib/request-handler";

export default requestHandler(() => {
	return new Response("Not Found", { status: 404 });
});
