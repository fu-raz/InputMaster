/** Fit the title icon to the text column height without stretching title↔subtitle. */
export function fitHeaderIcon(header) {
  if (!header) return;
  const icon = header.querySelector(".ui-page-header__icon");
  const copy = header.querySelector(".ui-page-header__copy");
  if (!icon || !copy) return;

  const apply = () => {
    const h = Math.round(copy.getBoundingClientRect().height);
    if (h <= 0) return;
    // Cap to a sensible title-stack size; never drive the copy taller.
    const size = Math.max(28, Math.min(40, h));
    icon.style.width = `${size}px`;
    icon.style.height = `${size}px`;
    icon.style.minWidth = `${size}px`;
    icon.style.minHeight = `${size}px`;
    icon.style.maxWidth = `${size}px`;
    icon.style.maxHeight = `${size}px`;
  };

  apply();
  if (icon.dataset.fitBound === "1") return;
  icon.dataset.fitBound = "1";
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => apply());
    ro.observe(copy);
  }
}

export function bindMasterPanelOpacity({ input, panel, getEnabled }) {
  if (!input || !panel) return;
  const sync = () => {
    const on = typeof getEnabled === "function" ? Boolean(getEnabled()) : Boolean(input.checked);
    // Only the bordered panel dims — header stays full opacity.
    panel.classList.toggle("is-master-off", !on);
    if ("inert" in panel) panel.inert = !on;
  };
  sync();
  return sync;
}
