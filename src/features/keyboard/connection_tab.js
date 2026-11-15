import { KEYBOARD_DEVICE_ID } from "./catalog.js";
import { faSvg, hydrateFaIcons } from "../../shared/fa_icons.js";

/** Inputs → Keyboard input panel. */
export function createKeyboardConnectionTab({ invoke, t }) {
  let root = null;
  let status = {
    enabled: false,
    supported: true,
    deviceId: KEYBOARD_DEVICE_ID,
    deviceName: "Keyboard",
    controls: [],
  };
  let busy = false;

  function read(role) {
    return root?.querySelector(`[data-role="${role}"]`);
  }

  function syncMasterPanelOpacity() {
    const panel = read("content-panel");
    if (!panel) return;
    const enabled = Boolean(status.enabled) && status.supported !== false;
    panel.classList.toggle("is-master-off", !enabled);
  }

  function renderControls() {
    const list = read("controls");
    if (!list) return;
    list.innerHTML = "";
    const controls = Array.isArray(status.controls) ? status.controls : [];
    if (!controls.length) {
      const empty = document.createElement("div");
      empty.className = "ui-toggle-row";
      empty.innerHTML = `<span class="ui-toggle-row__label">${t("keyboard.noControls")}</span>`;
      list.appendChild(empty);
      return;
    }
    for (const control of controls) {
      const row = document.createElement("div");
      row.className = "ui-toggle-row";

      const label = document.createElement("span");
      label.className = "ui-toggle-row__label";
      label.textContent = control.name || control.id;

      const toggleLabel = document.createElement("label");
      toggleLabel.className = "settings-toggle";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = control.enabled !== false;
      checkbox.disabled = busy;
      checkbox.onchange = () => {
        void setControlEnabled(control.id, checkbox.checked);
      };
      const ui = document.createElement("span");
      ui.className = "plugins-toggle-ui";
      ui.setAttribute("aria-hidden", "true");
      toggleLabel.appendChild(checkbox);
      toggleLabel.appendChild(ui);

      row.appendChild(label);
      row.appendChild(toggleLabel);
      list.appendChild(row);
    }
  }

  function update() {
    if (!root) return;
    const supported = status.supported !== false;
    const enabled = Boolean(status.enabled);
    const masterInput = read("master-input");
    const controlsBlock = read("controls-block");
    const unsupported = read("unsupported");

    if (masterInput) {
      masterInput.checked = enabled;
      masterInput.disabled = !supported || busy;
    }
    if (unsupported) {
      unsupported.classList.toggle("hidden", supported);
      unsupported.textContent = t("keyboard.unsupported");
    }
    if (controlsBlock) {
      controlsBlock.classList.toggle("hidden", !enabled || !supported);
    }
    syncMasterPanelOpacity();
    if (enabled && supported) {
      renderControls();
    }
  }

  async function refresh() {
    try {
      const next = await invoke("get_keyboard_input_status");
      status = {
        enabled: Boolean(next?.enabled),
        supported: next?.supported !== false,
        deviceId: next?.deviceId || KEYBOARD_DEVICE_ID,
        deviceName: next?.deviceName || status.deviceName,
        controls: Array.isArray(next?.controls) ? next.controls : [],
      };
    } catch (error) {
      console.error("Failed to load keyboard input status", error);
      status.supported = false;
    }
    update();
  }

  async function setEnabled(enabled) {
    if (busy) return;
    busy = true;
    update();
    try {
      await invoke("set_keyboard_input_enabled", { enabled: Boolean(enabled) });
      await refresh();
    } catch (error) {
      console.error("Failed to update keyboard input", error);
      await refresh();
    } finally {
      busy = false;
      update();
    }
  }

  async function setControlEnabled(controlId, enabled) {
    if (busy) return;
    busy = true;
    update();
    try {
      await invoke("set_keyboard_control_enabled", {
        controlId: String(controlId),
        enabled: Boolean(enabled),
      });
      await refresh();
    } catch (error) {
      console.error("Failed to update keyboard control", error);
      await refresh();
    } finally {
      busy = false;
      update();
    }
  }

  function mount(container) {
    root = container;
    root.innerHTML = `
      <div class="ui-page-header" data-role="master-row">
        <div class="ui-page-header__main">
          <span class="ui-page-header__icon" aria-hidden="true">${faSvg("keyboard")}</span>
          <div class="ui-page-header__copy">
            <h1 class="ui-content-title" data-role="master-label"></h1>
            <p class="ui-help" data-role="master-help"></p>
          </div>
        </div>
        <div class="ui-enable-control">
          <span class="ui-enable-caption">${t("ui.enable")}</span>
          <label class="settings-toggle" data-role="master-toggle" title="${t("ui.enable")}">
            <input type="checkbox" data-role="master-input" />
            <span class="plugins-toggle-ui" aria-hidden="true"></span>
          </label>
        </div>
      </div>
      <div class="ui-panel keyboard-settings" data-role="content-panel">
        <p class="ui-help keyboard-unsupported hidden" data-role="unsupported"></p>
        <div class="keyboard-controls-block hidden" data-role="controls-block">
          <h3 class="ui-subsection-title" data-role="controls-heading"></h3>
          <div class="ui-list-card" data-role="controls"></div>
        </div>
      </div>
    `;
    hydrateFaIcons(root);
    const masterLabel = read("master-label");
    if (masterLabel) masterLabel.textContent = t("keyboard.masterLabel");
    const masterHelp = read("master-help");
    if (masterHelp) masterHelp.textContent = t("inputs.keyboard.help");
    const heading = read("controls-heading");
    if (heading) heading.textContent = t("keyboard.controlsHeading");
    const masterInput = read("master-input");
    if (masterInput) {
      masterInput.addEventListener("change", () => {
        void setEnabled(masterInput.checked);
      });
    }
    update();
    void refresh();
  }

  function unmount() {
    root = null;
  }

  return {
    id: "keyboard",
    nameKey: "keyboard.title",
    get name() {
      return t("keyboard.title");
    },
    mount,
    unmount,
    refresh,
  };
}
