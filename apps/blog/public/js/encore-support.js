/**
 * Progressive enhancement for the Encore support form: once a submission starts, the submit
 * button turns busy and further submissions are ignored, so a double click sends one request.
 * The form works the same without it, since the server handles every outcome.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Label the submit button shows while the request is in flight. */
const PENDING_LABEL = "Sending…";

/**
 * Marks the form as submitting on its first valid submit and cancels any later one. The
 * `submit` event fires only after native validation passes, so an invalid form stays editable.
 *
 * @param {HTMLFormElement} form The support form.
 */
function enhance(form) {
	let button = form.querySelector("[data-support-submit]");
	let label = button?.textContent ?? "";

	form.addEventListener("submit", (event) => {
		if (form.dataset.submitting === "true") {
			event.preventDefault();
			return;
		}
		form.dataset.submitting = "true";
		form.setAttribute("aria-busy", "true");
		if (button) {
			button.setAttribute("aria-disabled", "true");
			button.textContent = PENDING_LABEL;
		}
	});

	/** A page restored from the back/forward cache comes back ready for a new submission. */
	window.addEventListener("pageshow", (event) => {
		if (!event.persisted) return;
		delete form.dataset.submitting;
		form.removeAttribute("aria-busy");
		if (button) {
			button.removeAttribute("aria-disabled");
			button.textContent = label;
		}
	});
}

for (let form of document.querySelectorAll("form[data-support-form]")) enhance(form);
