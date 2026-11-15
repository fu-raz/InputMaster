import { KEYBOARD_DEVICE_ID } from "./catalog.js";

const KEYBOARD_ICON = `
  <svg viewBox="0 0 24 24" focusable="false">
    <path d="M4 7h16v10H4z"></path>
    <path d="M8 11h.01"></path>
    <path d="M12 11h.01"></path>
    <path d="M16 11h.01"></path>
    <path d="M7 15h10"></path>
  </svg>
`;

/** Inputs → Keyboard: Settings-style panel, short master toggle, advanced for ids. */
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

  function renderControls() {
    const list = read("controls");
    if (!list) return;
    list.innerHTML = "";
    const controls = Array.isArray(status.controls) ? status.controls : [];
    if (!controls.length) {
      const empty = document.createElement("li");
      empty.textContent = t("keyboard.noControls");
      list.appendChild(empty);
      return;
    }
    for (const control of controls) {
      const item = document.createElement("li");
      item.className = "keyboard-control-item";
      const label = document.createElement("label");
      label.className = "keyboard-control-label";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "keyboard-control-checkbox";
      checkbox.checked = control.enabled !== false;
      checkbox.disabled = busy;
      checkbox.onchange = () => {
        void setControlEnabled(control.id, checkbox.checked);
      };
      const name = document.createElement("span");
      name.textContent = control.name || control.id;
      label.appendChild(checkbox);
      label.appendChild(name);
      item.appendChild(label);
      list.appendChild(item);
    }
  }

  function update() {
    if (!root) return;
    const supported = status.supported !== false;
    const enabled = Boolean(status.enabled);
    const masterInput = read("master-input");
    const masterRow = read("master-row");
    const controlsBlock = read("controls-block");
    const unsupported = read("unsupported");
    const advancedId = read("advanced-id");

    if (masterInput) {
      masterInput.checked = enabled;
      masterInput.disabled = !supported || busy;
    }
    if (masterRow) {
      masterRow.classList.toggle("is-disabled", !supported || busy);
    }
    if (unsupported) {
      unsupported.classList.toggle("hidden", supported);
      unsupported.textContent = t("keyboard.unsupported");
    }
    if (controlsBlock) {
      controlsBlock.classList.toggle("hidden", !enabled || !supported);
    }
    if (advancedId) {
      advancedId.textContent = status.deviceId || KEYBOARD_DEVICE_ID;
    }
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
      <div class="ui-panel keyboard-settings">
        <p class="ui-help keyboard-unsupported hidden" data-role="unsupported"></p>
        <div class="ui-toggle-row" data-role="master-row">
          <div class="ui-toggle-row__main">
            <span class="ui-toggle-row__icon" aria-hidden="true">${KEYBOARD_ICON}</span>
            <span class="ui-toggle-row__label" data-role="master-label"></span>
          </div>
          <label class="settings-toggle" data-role="master-toggle">
            <input type="checkbox" data-role="master-input" />
            <span class="plugins-toggle-ui" aria-hidden="true"></span>
          </label>
        </div>
        <div class="keyboard-controls-block hidden" data-role="controls-block">
          <h3 class="ui-subsection-title" data-role="controls-heading"></h3>
          <ul class="keyboard-controls-list" data-role="controls"></ul>
        </div>
        <details class="ui-advanced">
          <summary data-role="advanced-summary"></summary>
          <div class="ui-advanced__body" data-role="advanced-id"></div>
        </details>
      </div>
    `;
    const masterLabel = read("master-label");
    if (masterLabel) masterLabel.textContent = t("keyboard.masterLabel");
    const heading = read("controls-heading");
    if (heading) heading.textContent = t("keyboard.controlsHeading");
    const advancedSummary = read("advanced-summary");
    if (advancedSummary) advancedSummary.textContent = t("ui.showAdvanced");
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
