/**
 * Shoelace design system bootstrap (R8).
 * Local vendor + importmap (index.html) resolve bare lit/* under file://.
 */
import { setBasePath } from "../vendor/shoelace/dist/utilities/base-path.js";

const base = new URL("../vendor/shoelace/dist/", import.meta.url).href;
setBasePath(base.endsWith("/") ? base.slice(0, -1) : base);

const shellMods = [
  "button/button.js",
  "button-group/button-group.js",
  "icon/icon.js",
  "badge/badge.js",
  "tag/tag.js",
  "divider/divider.js",
  "tooltip/tooltip.js",
  "spinner/spinner.js",
  "alert/alert.js",
  "card/card.js",
  "dialog/dialog.js",
  "dropdown/dropdown.js",
  "input/input.js",
  "textarea/textarea.js",
  "select/select.js",
  "option/option.js",
  "switch/switch.js",
  "checkbox/checkbox.js",
];

const results = await Promise.allSettled(
  shellMods.map((m) => import("../vendor/shoelace/dist/components/" + m)),
);
const failed = results.filter((r) => r.status === "rejected");
if (failed.length) {
  console.warn("[HFQ DS] Shoelace modules failed:", failed.length, failed[0]?.reason);
}
import("../vendor/shoelace/dist/shoelace-autoloader.js").catch(() => {});

window.HFQDesignSystem = {
  name: "shoelace",
  version: "2.20.1",
  basePath: base,
  ready: failed.length === 0,
};
document.documentElement.classList.add(failed.length ? "ds-partial" : "ds-ready");
document.dispatchEvent(new CustomEvent("hfq:ds-ready"));
