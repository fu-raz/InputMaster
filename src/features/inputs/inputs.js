import { createKeyboardConnectionTab } from "../keyboard/connection_tab.js";
import { createControllerConnectionTab } from "../controller/connection_tab.js";
import { getNavIndicatorMetrics } from "../../app/connections_panel.js";
import { fitHeaderIcon } from "../../shared/page_header.js";
import { hydrateFaIcons } from "../../shared/fa_icons.js";

const INPUT_SECTIONS = ["midi", "keyboard", "controller", "wheel"];

/** Top-level Inputs page: left nav + MIDI / Keyboard / Controller panes. */
export function createInputsFeature({ i18n, invoke, onMidiSectionShown }) {
  const t = (key, params = {}) =>
    i18n && typeof i18n.t === "function" ? i18n.t(key, params) : String(key || "");

  let sidebar = null;
  let content = null;
  let activeSection = "midi";
  let navIndicatorRaf = 0;
  let sidebarBound = false;
  let keyboardTab = null;
  let keyboardMounted = false;
  let controllerTab = null;
  let controllerMounted = false;

  function syncNavIndicator() {
    if (!sidebar) return;
    const indicator = sidebar.querySelector(".inputs-nav-indicator");
    const active = sidebar.querySelector(".inputs-nav-item.active:not(.is-soon)");
    if (!indicator || !active) {
      if (indicator) indicator.style.opacity = "0";
      return;
    }
    const metrics = getNavIndicatorMetrics(
      sidebar.getBoundingClientRect(),
      active.getBoundingClientRect(),
      sidebar.scrollLeft,
      sidebar.scrollTop,
    );
    indicator.style.width = `${metrics.width}px`;
    indicator.style.height = `${metrics.height}px`;
    indicator.style.transform = `translate(${metrics.x}px, ${metrics.y}px)`;
    indicator.style.opacity = "1";
  }

  function scheduleNavIndicatorSync() {
    if (navIndicatorRaf) cancelAnimationFrame(navIndicatorRaf);
    navIndicatorRaf = requestAnimationFrame(() => {
      navIndicatorRaf = 0;
      syncNavIndicator();
    });
  }

  function ensureKeyboardMounted() {
    if (keyboardMounted || !keyboardTab) return;
    const pane = content?.querySelector('[data-inputs-panel="keyboard"] [data-role="keyboard-host"], [data-role="keyboard-host"]');
    if (!pane) return;
    try {
      keyboardTab.mount(pane);
      keyboardMounted = true;
    } catch (error) {
      console.error("Failed to mount keyboard inputs pane", error);
    }
  }

  function ensureControllerMounted() {
    if (controllerMounted || !controllerTab) return;
    const pane = content?.querySelector(
      '[data-inputs-panel="controller"] [data-role="controller-host"], [data-role="controller-host"]',
    );
    if (!pane) return;
    try {
      controllerTab.mount(pane);
      controllerMounted = true;
    } catch (error) {
      console.error("Failed to mount controller inputs pane", error);
    }
  }

  function activateSection(sectionId) {
    const next = INPUT_SECTIONS.includes(sectionId) ? sectionId : "midi";
    activeSection = next;
    if (!sidebar || !content) return;

    sidebar.querySelectorAll(".inputs-nav-item").forEach((item) => {
      const id = item.dataset.inputsSection;
      const isActive = id === activeSection;
      item.classList.toggle("active", isActive);
      if (!item.disabled) {
        item.setAttribute("aria-current", isActive ? "page" : "false");
      }
    });
    content.querySelectorAll("[data-inputs-panel]").forEach((pane) => {
      pane.classList.toggle("active", pane.dataset.inputsPanel === activeSection);
    });

    if (activeSection === "keyboard") {
      ensureKeyboardMounted();
      keyboardTab?.refresh?.();
    }
    if (activeSection === "controller") {
      ensureControllerMounted();
      controllerTab?.refresh?.();
    }
    if (activeSection === "midi" && typeof onMidiSectionShown === "function") {
      try {
        onMidiSectionShown();
      } catch (error) {
        console.error("Failed to refresh MIDI inputs pane", error);
      }
    }
    const activePane = content.querySelector(".inputs-panel.active");
    if (activePane) {
      hydrateFaIcons(activePane);
      activePane.querySelectorAll(".ui-page-header").forEach((header) => fitHeaderIcon(header));
    }
    scheduleNavIndicatorSync();
  }

  function ensureSidebarBound() {
    if (sidebarBound || !sidebar) return;
    sidebarBound = true;
    sidebar.addEventListener("click", (event) => {
      const btn = event.target?.closest?.(".inputs-nav-item");
      if (!btn || btn.disabled || btn.classList.contains("is-soon")) return;
      const section = String(btn.dataset.inputsSection || "");
      if (!section) return;
      activateSection(section);
    });
    window.addEventListener("resize", scheduleNavIndicatorSync);
  }

  function openInputsPanel(sectionId = activeSection) {
    sidebar = document.getElementById("inputs-sidebar");
    content = document.getElementById("inputs-content");
    ensureSidebarBound();
    if (!keyboardTab) {
      keyboardTab = createKeyboardConnectionTab({
        invoke: typeof invoke === "function" ? invoke : async () => ({}),
        t,
      });
    }
    if (!controllerTab) {
      controllerTab = createControllerConnectionTab({
        invoke: typeof invoke === "function" ? invoke : async () => ({}),
        t,
      });
    }
    activateSection(sectionId || activeSection || "midi");
  }

  function bindUi() {
    // Sidebar is bound lazily in openInputsPanel once the DOM refs exist.
  }

  return {
    openInputsPanel,
    activateSection,
    bindUi,
    refreshKeyboard: () => keyboardTab?.refresh?.(),
    refreshController: () => controllerTab?.refresh?.(),
  };
}
