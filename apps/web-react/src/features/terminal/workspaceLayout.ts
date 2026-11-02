/** Presentation-only controls for the disposable iframe. No account, market,
 * chart-engine or order state is read or changed here. */
export function setupWorkspaceLayout(doc: Document) {
  doc.body.dataset.workspaceView = "chart";
  const language = () => {
    const locale = doc.documentElement.lang === "fa" ? "fa" : "en";
    doc.querySelectorAll<HTMLElement>("[data-fa][data-en]").forEach((el) => {
      el.textContent = el.dataset[locale] || "";
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
  doc.querySelectorAll<HTMLDetailsElement>(".order-details").forEach((details) => {
    details.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        details.open = false;
        details.querySelector("summary")?.focus();
      }
    });
  });
}
