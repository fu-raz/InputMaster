import { KEYBOARD_DEVICE_ID } from "./catalog.js";

/** Inputs → Keyboard pane: Settings-style master toggle + per-key capture list. */
export function createKeyboardConnectionTab({ invoke, t }) {
  let root = null;
  let status = {
    enabled: false,
    supported: true,
    deviceId: KEYBOARD_DEVICE_ID,
    deviceName: "Keyboard / media keys",
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
      checkbox.dataset.controlId = control.id;
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
      <div class="keyboard-settings">
        <p class="keyboard-unsupported hidden" data-role="unsupported"></p>
        <div class="settings-startup-row keyboard-master-row" data-role="master-row">
          <div class="settings-startup-row-main">
            <span class="settings-startup-copy">
              <strong data-role="master-label"></strong>
              <span class="settings-startup-help" data-role="master-help"></span>
            </span>
          </div>
          <label class="settings-toggle" data-role="master-toggle">
            <input type="checkbox" data-role="master-input" />
            <span class="plugins-toggle-ui" aria-hidden="true"></span>
          </label>
        </div>
        <div class="keyboard-controls-block hidden" data-role="controls-block">
          <p class="keyboard-controls-heading" data-role="controls-heading"></p>
          <ul class="keyboard-controls-list" data-role="controls"></ul>
        </div>
      </div>
    `;
    const masterLabel = read("master-label");
    if (masterLabel) masterLabel.textContent = t("keyboard.masterLabel");
    const masterHelp = read("master-help");
    if (masterHelp) masterHelp.textContent = t("keyboard.masterHelp");
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
