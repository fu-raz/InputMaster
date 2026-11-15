import { createKeyboardConnectionTab } from "../keyboard/connection_tab.js";
import { getNavIndicatorMetrics } from "../../app/connections_panel.js";

const INPUT_SECTIONS = ["midi", "keyboard", "controller", "wheel"];

/** Top-level Inputs page: left nav + MIDI / Keyboard panes (Controller/Wheel stubs). */
export function createInputsFeature({ i18n, invoke }) {
  const t = (key, params = {}) =>
    i18n && typeof i18n.t === "function" ? i18n.t(key, params) : String(key || "");

  let root = null;
  let sidebar = null;
  let content = null;
  let activeSection = "midi";
  let navIndicatorRaf = 0;
  let keyboardTab = null;
  let keyboardMounted = false;

  function syncNavIndicator() {
    if (!sidebar) return;
    const indicator = sidebar.querySelector(".inputs-nav-indicator");
    const active = sidebar.querySelector(".inputs-nav-item.active");
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
    const pane = content?.querySelector('[data-inputs-panel="keyboard"] [data-role="keyboard-host"]');
    if (!pane) return;
    try {
      keyboardTab.mount(pane);
      keyboardMounted = true;
    } catch (error) {
      console.error("Failed to mount keyboard inputs pane", error);
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
      item.setAttribute("aria-current", isActive ? "page" : "false");
    });
    content.querySelectorAll("[data-inputs-panel]").forEach((pane) => {
      pane.classList.toggle("active", pane.dataset.inputsPanel === activeSection);
    });

    if (activeSection === "keyboard") {
      ensureKeyboardMounted();
      keyboardTab?.refresh?.();
    }
    scheduleNavIndicatorSync();
  }

  function bindSidebar() {
    if (!sidebar) return;
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
    root = document.getElementById("inputs-page");
    sidebar = document.getElementById("inputs-sidebar");
    content = document.getElementById("inputs-content");
    if (!keyboardTab) {
      keyboardTab = createKeyboardConnectionTab({
        invoke: typeof invoke === "function" ? invoke : async () => ({}),
        t,
      });
    }
    activateSection(sectionId || "midi");
  }

  function bindUi({ switchAppPage } = {}) {
    bindSidebar();
    const shortcut = document.getElementById("inputs-midi-shortcut");
    if (shortcut) {
      shortcut.addEventListener("click", () => {
        const go = async () => {
          if (typeof switchAppPage === "function") {
            await switchAppPage("inputs");
          } else {
            document.querySelector('[data-page="inputs"]')?.click?.();
          }
          openInputsPanel("midi");
        };
        go().catch(() => openInputsPanel("midi"));
      });
    }
  }

  return {
    openInputsPanel,
    activateSection,
    bindUi,
    refreshKeyboard: () => keyboardTab?.refresh?.(),
  };
}
