/**
 * Editor helper that detects Apple platforms (Mac, iPhone, iPod, or iPad) by
 * sniffing the browser user agent. It lets the editor pick the correct modifier
 * key (Cmd vs Ctrl) for keyboard shortcuts based on the user's device.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Detect if a computer is a Mac, iPhone, iPod or iPad
 * @returns If it's or not
 */
export function isMac() {
	return !!navigator.userAgent.match(/(Mac|iPhone|iPod|iPad)/i);
}
