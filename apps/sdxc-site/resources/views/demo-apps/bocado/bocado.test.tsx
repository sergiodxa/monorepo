/**
 * Holds Bocado's server side to what a visitor relies on: the cart survives in a cookie and a
 * tampered one only loses lines, a dish needs every required pick, a cart never mixes two
 * restaurants without the visitor's say, checkout prices exactly and places an order whose
 * progress streams, and every screen renders.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";

import { ADDRESSES, RESTAURANTS, findRestaurant, readSearch, searchRestaurants } from "./data";
import { deliveryRoute, routeView } from "./delivery-map";
import { cartCookie, decodeLines, lineTotal, priceLines, readVisitor, validLine } from "./state";
import { parseProgressLine, progressAt, progressLine } from "./tracking";

import app from "./index";

/** The restaurant most tests order from. */
const TRES = findRestaurant("tres-empanadas")!;

/** Posts a form to a Bocado action path with the given cookie. */
async function post(page: string, fields: Array<[string, string]>, cookie = "") {
	return await fetchApp(`/demo/apps/bocado/${page}`, {
		method: "POST",
		body: new URLSearchParams(fields),
		headers: cookie === "" ? {} : { Cookie: cookie },
		redirect: "manual",
	});
}

/** The `name=value` parts of a response's `Set-Cookie` headers, joined as a request would send them. */
function cookiesOf(response: Response): string {
	return response.headers
		.getSetCookie()
		.map((cookie) => cookie.split(";")[0] ?? "")
		.join("; ");
}

/** A cart cookie holding one hand-cut beef trio, baked, with chimichurri. */
const ONE_TRIO = cartCookie(TRES, [
	{ item: "cuchillo", choices: ["horno", "chimi"], qty: 1 },
]).split(";")[0]!;

describe("Bocado's cart", () => {
	test("needs exactly one pick per required group and no more extras than allowed", () => {
		expect(validLine(TRES, { item: "cuchillo", choices: ["horno", "chimi"] })).toBe(true);
		expect(validLine(TRES, { item: "cuchillo", choices: ["horno"] })).toBe(false);
		expect(validLine(TRES, { item: "cuchillo", choices: ["horno", "frita", "chimi"] })).toBe(false);
		expect(
			validLine(TRES, {
				item: "cuchillo",
				choices: ["horno", "chimi", "humita-add", "caprese-add", "verdura-add", "jyq-add"],
			}),
		).toBe(false);
		expect(validLine(TRES, { item: "limonada", choices: ["humita-add"] })).toBe(false);
	});

	test("prices a line with its picks, times how many", () => {
		let line = { item: "cuchillo", choices: ["frita", "picante", "humita-add"], qty: 2 };
		expect(lineTotal(TRES, line)).toBe((1150 + 50 + 75 + 150) * 2);
	});

	test("drops tampered lines and reads an unknown restaurant as no cart", () => {
		expect(
			decodeLines(TRES, "cuchillo~horno.chimi~2,ghost~~1,cuchillo~horno~1,limonada~~99"),
		).toEqual([{ item: "cuchillo", choices: ["horno", "chimi"], qty: 2 }]);
		expect(readVisitor("bocado.cart=nowhere%7Climonada~~1").cart).toBeUndefined();
		expect(readVisitor(ONE_TRIO).cart?.restaurant.id).toBe("tres-empanadas");
	});

	test("adds a dish and grows the same dish's line rather than repeating it", async () => {
		let fields: Array<[string, string]> = [
			["restaurant", "tres-empanadas"],
			["item", "cuchillo"],
			["g.bake", "horno"],
			["g.dip", "chimi"],
			["qty", "2"],
			["back", "r/tres-empanadas"],
		];
		let response = await post("cart/add", fields, ONE_TRIO);
		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toMatch(
			/^\/demo\/apps\/bocado\/r\/tres-empanadas\?toast=added\./,
		);
		expect(readVisitor(cookiesOf(response)).cart?.lines).toEqual([
			{ item: "cuchillo", choices: ["horno", "chimi"], qty: 3 },
		]);
	});

	test("sends a dish missing a required pick back with a toast, and changes nothing", async () => {
		let response = await post("cart/add", [
			["restaurant", "tres-empanadas"],
			["item", "cuchillo"],
			["g.bake", "horno"],
		]);
		expect(response.headers.get("Location")).toMatch(/toast=pick-missing\./);
		expect(response.headers.getSetCookie()).toEqual([]);
	});

	test("never mixes restaurants without the dialog's say, and starts a new cart with it", async () => {
		let dish: Array<[string, string]> = [
			["restaurant", "sin-grieta"],
			["item", "crinkle"],
		];
		let refused = await post("cart/add", dish, ONE_TRIO);
		expect(refused.headers.get("Location")).toMatch(/toast=cart-conflict\./);
		expect(refused.headers.getSetCookie()).toEqual([]);
		let replaced = await post("cart/add", [...dish, ["replace", "1"]], ONE_TRIO);
		expect(replaced.headers.get("Location")).toMatch(/toast=new-cart\./);
		let cart = readVisitor(cookiesOf(replaced)).cart;
		expect(cart?.restaurant.id).toBe("sin-grieta");
		expect(cart?.lines).toEqual([{ item: "crinkle", choices: [], qty: 1 }]);
	});

	test("refuses a dish from a kitchen that has not opened", async () => {
		let response = await post("cart/add", [
			["restaurant", "ni-frio-ni-calor"],
			["item", "ddl-granizado"],
			["g.size", "cuarto"],
		]);
		expect(response.headers.get("Location")).toMatch(/toast=closed\./);
	});

	test("a stepper post sets a line's count, and zero removes it and clears the cart", async () => {
		let more = await post(
			"cart/line",
			[
				["line", "0"],
				["qty", "4"],
				["back", "cart"],
			],
			ONE_TRIO,
		);
		expect(readVisitor(cookiesOf(more)).cart?.lines[0]?.qty).toBe(4);
		let gone = await post(
			"cart/line",
			[
				["line", "0"],
				["qty", "0"],
				["back", "cart"],
			],
			ONE_TRIO,
		);
		expect(gone.headers.get("Location")).toMatch(/^\/demo\/apps\/bocado\/cart\?toast=removed\./);
		expect(gone.headers.getSetCookie()[0]).toMatch(/^bocado\.cart=; .*Max-Age=0/);
	});

	test("names the cart button's count in the singular for one item", async () => {
		let body = await (
			await fetchApp("/demo/apps/bocado/cart", { headers: { Cookie: ONE_TRIO } })
		).text();
		expect(body).toContain('aria-label="Cart, 1 item, $11.50"');
	});

	test("returns a post only to Bocado's own pages", async () => {
		let away = await post("address", [
			["address", "studio"],
			["back", "https://example.com"],
		]);
		expect(away.headers.get("Location")).toMatch(/^\/demo\/apps\/bocado\?toast=address\./);
		expect(cookiesOf(away)).toBe("bocado.address=studio");
	});
});

describe("Bocado's checkout", () => {
	test("prices the subtotal, fees, priority and tip", () => {
		let totals = priceLines(
			TRES,
			[{ item: "cuchillo", choices: ["frita", "picante", "humita-add"], qty: 1 }],
			{
				tip: 20,
				priority: true,
			},
		);
		expect(totals).toEqual({
			subtotal: 1425,
			delivery: 0,
			service: 114,
			priority: 249,
			tip: 285,
			total: 2073,
		});
	});

	test("places the cart as an order, empties the cart and tracks it", async () => {
		let response = await post(
			"checkout",
			[
				["address", "studio"],
				["payment", "work"],
				["tip", "15"],
				["speed", "priority"],
			],
			ONE_TRIO,
		);
		let location = response.headers.get("Location") ?? "";
		expect(location).toMatch(/^\/demo\/apps\/bocado\/orders\/[0-9a-f-]{36}\?toast=placed\./);
		let cookies = cookiesOf(response);
		let visitor = readVisitor(cookies);
		expect(visitor.cart).toBeUndefined();
		expect(visitor.address.id).toBe("studio");
		let order = visitor.orders[0]!;
		expect(order).toMatchObject({
			restaurant: "tres-empanadas",
			tip: 15,
			payment: "work",
			priority: true,
		});
		let page = await fetchApp(location.split("?")[0]!, { headers: { Cookie: cookies } });
		expect(page.status).toBe(200);
		expect(await page.text()).toContain("Sending your order");
	});

	test("refuses a payment method that isn't one of the saved ones, or an odd tip", async () => {
		let fields = (payment: string, tip: string): Array<[string, string]> => [
			["address", "home"],
			["payment", payment],
			["tip", tip],
		];
		expect((await post("checkout", fields("4242424242424242", "15"), ONE_TRIO)).status).toBe(400);
		expect((await post("checkout", fields("everyday", "99"), ONE_TRIO)).status).toBe(400);
	});

	test("reorders a past order into the cart", async () => {
		let order = readVisitor(null).orders[0]!;
		let response = await post(`orders/${order.id}/reorder`, []);
		expect(response.headers.get("Location")).toMatch(
			/^\/demo\/apps\/bocado\/cart\?toast=reordered\./,
		);
		expect(readVisitor(cookiesOf(response)).cart?.lines).toEqual(order.lines);
	});
});

describe("Bocado's order tracking", () => {
	test("steps through the delivery on its clock and moves the courier only while on the way", () => {
		expect(progressAt(0).step.id).toBe("placed");
		expect(progressAt(30).step.id).toBe("preparing");
		expect(progressAt(30).courier).toBe(0);
		expect(progressAt(130).courier).toBeCloseTo(0.5);
		expect(progressAt(500)).toMatchObject({ courier: 1, eta: 0, done: true });
	});

	test("writes stream lines the page can read back", () => {
		let line = progressLine(progressAt(130));
		expect(line).toBe("on-the-way 0.500 7\n");
		expect(parseProgressLine(line)).toEqual({ step: "on-the-way", courier: 0.5, eta: 7 });
		expect(parseProgressLine("lost 1 2")).toBeUndefined();
	});

	test("streams a placed order's progress, and nothing for an order the visitor lacks", async () => {
		let order = readVisitor(null).orders[0]!;
		let response = await fetchApp(`/demo/apps/bocado/streams/orders/${order.id}`);
		expect(response.headers.get("Content-Type")).toMatch(/^text\/plain/);
		expect(await response.text()).toBe("delivered 1.000 0\n");
		expect((await fetchApp("/demo/apps/bocado/streams/orders/nope")).status).toBe(404);
	});
});

describe("Bocado's delivery map", () => {
	test("has a route along the streets from every restaurant to every saved address", () => {
		for (let restaurant of RESTAURANTS) {
			for (let address of ADDRESSES) {
				let path = deliveryRoute(restaurant, address);
				expect(path.length, `${restaurant.id} → ${address.id}`).toBeGreaterThan(2);
				expect(path[0]).toEqual([...restaurant.at]);
				expect(path.at(-1)).toEqual([...address.at]);
			}
		}
	});

	test("starts on a view where the whole route fits a phone's 340 × 255 map with room for pins", () => {
		let pixel = ([longitude, latitude]: [number, number], zoom: number): [number, number] => {
			let size = 512 * 2 ** zoom;
			let sin = Math.sin((latitude * Math.PI) / 180);
			return [
				((longitude + 180) / 360) * size,
				(0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
			];
		};
		for (let restaurant of RESTAURANTS) {
			for (let address of ADDRESSES) {
				let path = deliveryRoute(restaurant, address);
				let view = routeView(path);
				let [cx, cy] = pixel(view.center, view.zoom);
				for (let point of path) {
					let [x, y] = pixel(point, view.zoom);
					expect(Math.abs(x - cx), `${restaurant.id} → ${address.id}`).toBeLessThanOrEqual(
						170 - 20,
					);
					expect(Math.abs(y - cy), `${restaurant.id} → ${address.id}`).toBeLessThanOrEqual(
						127 - 20,
					);
				}
			}
		}
	});
});

describe("Bocado's screens", () => {
	test("search filters by cuisine, fee and rating, and ranks a name match first", () => {
		let empanadas = searchRestaurants(readSearch(new URLSearchParams("cuisine=empanadas")));
		expect(empanadas.map((restaurant) => restaurant.id)).toEqual(["tres-empanadas"]);
		let free = searchRestaurants(readSearch(new URLSearchParams("free=1")));
		expect(free.every((restaurant) => restaurant.fee === 0)).toBe(true);
		let rated = searchRestaurants(readSearch(new URLSearchParams("rating=4.8")));
		expect(rated.every((restaurant) => restaurant.rating >= 4.8)).toBe(true);
		expect(searchRestaurants(readSearch(new URLSearchParams("q=ceviche")))[0]?.id).toBe(
			"ceviche-che",
		);
	});

	test.each(app.screens)("renders %s", async (page) => {
		let response = await fetchApp(`/demo/apps/bocado${page === "" ? "" : `/${page}`}`);
		expect(response.status).toBe(200);
	});

	test("answers its own 404 for a restaurant or order it lacks", async () => {
		expect((await fetchApp("/demo/apps/bocado/r/nowhere")).status).toBe(404);
		expect((await fetchApp("/demo/apps/bocado/orders/nope")).status).toBe(404);
	});

	test("gives every dish on every menu a dialog that posts to the cart", async () => {
		let body = await (await fetchApp("/demo/apps/bocado/r/tres-empanadas")).text();
		for (let section of TRES.sections) {
			for (let entry of section.items) expect(body).toContain(`id="bocado-item-${entry.id}"`);
		}
		expect(RESTAURANTS.length).toBeGreaterThan(10);
	});
});
