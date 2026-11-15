import { KEYBOARD_DEVICE_ID } from "./catalog.js";

/** Connections panel pane: enable/disable keyboard media/volume capture. */
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
    const masterOn = Boolean(status.enabled) && status.supported !== false;
    for (const control of controls) {
      const item = document.createElement("li");
      item.className = "keyboard-control-item";

      const label = document.createElement("label");
      label.className = "keyboard-control-label";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "keyboard-control-checkbox";
      checkbox.checked = control.enabled !== false;
      checkbox.disabled = !masterOn || busy;
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
    const dot = read("dot");
    const statusEl = read("status");
    const toggle = read("toggle");
    const help = read("help");
    if (dot) {
      dot.classList.toggle("connected", enabled && supported);
      dot.classList.toggle("connecting", busy);
    }
    if (statusEl) {
      statusEl.textContent = !supported
        ? t("keyboard.unsupported")
        : busy
          ? t("keyboard.updating")
          : enabled
            ? t("keyboard.enabledStatus")
            : t("keyboard.disabledStatus");
    }
    if (toggle) {
      toggle.disabled = !supported || busy;
      toggle.textContent = enabled ? t("keyboard.disable") : t("keyboard.enable");
      toggle.classList.toggle("danger", enabled && supported && !busy);
      toggle.classList.toggle("disabled", !supported || busy);
    }
    if (help) {
      help.textContent = t("keyboard.help");
    }
    renderControls();
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
      <div class="connection-item-header">
        <div class="connection-info">
          <span class="connection-name" data-role="title"></span>
        </div>
        <div class="connection-status">
          <span class="connection-status-dot" data-role="dot"></span>
          <span data-role="status"></span>
        </div>
      </div>
      <div class="connection-content-wrapper">
        <div class="connection-description">
          <p data-role="help"></p>
          <p data-role="controls-heading"></p>
          <ul class="keyboard-controls-list" data-role="controls"></ul>
        </div>
      </div>
      <div class="connection-footer">
        <button type="button" class="connection-button" data-role="toggle"></button>
      </div>
    `;
    const title = read("title");
    if (title) title.textContent = t("keyboard.title");
    const heading = read("controls-heading");
    if (heading) heading.textContent = t("keyboard.controlsHeading");
    read("toggle").onclick = () => setEnabled(!status.enabled);
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
