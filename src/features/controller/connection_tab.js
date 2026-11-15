/** Inputs → Controller pane: observe-only XInput master toggle + connected pads. */
export function createControllerConnectionTab({ invoke, t }) {
  let root = null;
  let status = {
    enabled: false,
    supported: true,
    observeOnly: true,
    devices: [],
  };
  let busy = false;
  let refreshTimer = 0;

  function read(role) {
    return root?.querySelector(`[data-role="${role}"]`);
  }

  function renderDevices() {
    const list = read("devices");
    if (!list) return;
    list.innerHTML = "";
    const devices = Array.isArray(status.devices) ? status.devices : [];
    if (!devices.length) {
      const empty = document.createElement("li");
      empty.className = "controller-empty";
      empty.textContent = t("controller.noDevices");
      list.appendChild(empty);
      return;
    }
    for (const device of devices) {
      const item = document.createElement("li");
      item.className = "controller-device-item";
      const name = document.createElement("strong");
      name.textContent = device.deviceName || device.deviceId || t("controller.title");
      const id = document.createElement("span");
      id.className = "controller-device-id";
      id.textContent = device.deviceId || "";
      item.appendChild(name);
      item.appendChild(id);
      list.appendChild(item);
    }
  }

  function update() {
    if (!root) return;
    const supported = status.supported !== false;
    const enabled = Boolean(status.enabled);
    const masterInput = read("master-input");
    const masterRow = read("master-row");
    const devicesBlock = read("devices-block");
    const unsupported = read("unsupported");
    const observeNote = read("observe-note");

    if (masterInput) {
      masterInput.checked = enabled;
      masterInput.disabled = !supported || busy;
    }
    if (masterRow) {
      masterRow.classList.toggle("is-disabled", !supported || busy);
    }
    if (unsupported) {
      unsupported.classList.toggle("hidden", supported);
      unsupported.textContent = t("controller.unsupported");
    }
    if (observeNote) {
      observeNote.textContent = t("controller.observeOnly");
      observeNote.classList.toggle("hidden", !enabled || !supported);
    }
    if (devicesBlock) {
      devicesBlock.classList.toggle("hidden", !enabled || !supported);
    }
    if (enabled && supported) {
      renderDevices();
    }
  }

  async function refresh() {
    try {
      const next = await invoke("get_controller_input_status");
      status = {
        enabled: Boolean(next?.enabled),
        supported: next?.supported !== false,
        observeOnly: next?.observeOnly !== false,
        devices: Array.isArray(next?.devices) ? next.devices : [],
      };
    } catch (error) {
      console.error("Failed to load controller input status", error);
      status.supported = false;
    }
    update();
  }

  async function setEnabled(enabled) {
    if (busy) return;
    busy = true;
    update();
    try {
      await invoke("set_controller_input_enabled", { enabled: Boolean(enabled) });
      await refresh();
    } catch (error) {
      console.error("Failed to update controller input", error);
      await refresh();
    } finally {
      busy = false;
      update();
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    refreshTimer = window.setInterval(() => {
      if (status.enabled && status.supported !== false) {
        void refresh();
      }
    }, 1000);
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      window.clearInterval(refreshTimer);
      refreshTimer = 0;
    }
  }

  function mount(container) {
    root = container;
    root.innerHTML = `
      <div class="controller-settings">
        <p class="controller-unsupported hidden" data-role="unsupported"></p>
        <div class="settings-startup-row controller-master-row" data-role="master-row">
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
        <p class="controller-observe-note hidden" data-role="observe-note"></p>
        <div class="controller-devices-block hidden" data-role="devices-block">
          <p class="controller-devices-heading" data-role="devices-heading"></p>
          <ul class="controller-devices-list" data-role="devices"></ul>
        </div>
      </div>
    `;
    const masterLabel = read("master-label");
    if (masterLabel) masterLabel.textContent = t("controller.masterLabel");
    const masterHelp = read("master-help");
    if (masterHelp) masterHelp.textContent = t("controller.masterHelp");
    const heading = read("devices-heading");
    if (heading) heading.textContent = t("controller.devicesHeading");
    const masterInput = read("master-input");
    if (masterInput) {
      masterInput.addEventListener("change", () => {
        void setEnabled(masterInput.checked);
      });
    }
    update();
    void refresh();
    startAutoRefresh();
  }

  function unmount() {
    stopAutoRefresh();
    root = null;
  }

  return {
    id: "controller",
    nameKey: "controller.title",
    get name() {
      return t("controller.title");
    },
    mount,
    unmount,
    refresh,
  };
}
