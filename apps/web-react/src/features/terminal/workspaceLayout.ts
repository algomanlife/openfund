import { normalizeLocale, pick } from "../../i18n/locales";
import { closeOthers, detailsPopover, registerPopover, watchDocument, type Popover } from "./popovers";
/** Presentation-only controls for the disposable iframe. No account, market,
 * chart-engine or order state is read or changed here. */
export function setupWorkspaceLayout(doc: Document) {
  doc.body.dataset.workspaceView = "chart";
  const language = () => {
    const locale = normalizeLocale(doc.documentElement.lang, "en");
    doc.querySelectorAll<HTMLElement>("[data-fa][data-en]").forEach((el) => {
      el.textContent = pick(locale, el.dataset.fa || "", el.dataset.en || "");
    });
  };
  language();
  const observer = new MutationObserver(language);
  observer.observe(doc.documentElement, { attributes: true, attributeFilter: ["lang"] });
  doc.defaultView?.addEventListener("pagehide", () => observer.disconnect(), { once: true });
  doc.querySelectorAll<HTMLButtonElement>("button[data-workspace-view]").forEach((button) => {
    button.addEventListener("click", () => {
      doc.body.dataset.workspaceView = button.dataset.workspaceView;
      doc.querySelectorAll<HTMLButtonElement>("button[data-workspace-view]").forEach((tab) => {
        tab.setAttribute("aria-pressed", String(tab === button));
      });
    });
  });
  setupWorkspacePopovers(doc);
  doc.querySelectorAll<HTMLDetailsElement>(".order-details").forEach((details) => {
    details.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        details.open = false;
        details.querySelector("summary")?.focus();
      }
    });
  });
}

/** Workspace popovers join the shell's shared dismissal (popovers.ts):
 *  market selector and More stats close on outside clicks in either document,
 *  on Escape, and when another popover opens. The notifications dialog also
 *  closes on a backdrop click. Interaction only. */
function setupWorkspacePopovers(doc: Document) {
  const win = doc.defaultView;
  if (!win) return;
  const cleanups: Array<() => void> = [watchDocument(doc)];
  const stats = doc.querySelector<HTMLDetailsElement>(".market-details");
  if (stats) cleanups.push(registerPopover(detailsPopover(stats)));
  const trigger = doc.getElementById("market-select-btn");
  const dropdown = doc.getElementById("market-dropdown");
  if (trigger && dropdown) {
    const market: Popover = {
      contains: (target) => !!target && !!doc.querySelector(".market-select")?.contains(target),
      isOpen: () => !dropdown.hidden,
      close: (restoreFocus) => {
        const focusInside = !!doc.querySelector(".market-select")?.contains(doc.activeElement);
        win.dispatchEvent(new win.Event("of-close-popovers"));
        if (restoreFocus && focusInside) trigger.focus();
      },
    };
    cleanups.push(registerPopover(market));
    const opened = new MutationObserver(() => { if (trigger.getAttribute("aria-expanded") === "true") closeOthers(market); });
    opened.observe(trigger, { attributes: true, attributeFilter: ["aria-expanded"] });
    cleanups.push(() => opened.disconnect());
  }
  const notifications = doc.getElementById("notifications-dialog") as HTMLDialogElement | null;
  if (notifications) {
    const backdrop = (event: MouseEvent) => {
      if (event.target !== notifications) return;
      const box = notifications.getBoundingClientRect();
      const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
      if (!inside) notifications.close();
    };
    notifications.addEventListener("click", backdrop);
    cleanups.push(() => notifications.removeEventListener("click", backdrop));
  }
  win.addEventListener("pagehide", () => cleanups.forEach((cleanup) => cleanup()), { once: true });
}
