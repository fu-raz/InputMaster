const GAMEPAD_ICON = `
  <svg viewBox="0 0 24 24" focusable="false">
    <path d="M6 9h12a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3h-2l-1.5 2h-5L9 17H6a3 3 0 0 1-3-3v-2a3 3 0 0 1 3-3z"></path>
    <path d="M9 13h.01"></path>
    <path d="M15 12v2"></path>
    <path d="M14 13h2"></path>
  </svg>
`;

/** Inputs → Controller input panel (observe-only XInput). */
export function createControllerConnectionTab({ invoke, t }) {
  let root = null;
  let status = {
    enabled: false,
    supported: true,
    observeOnly: true,
    devices: [],
    buttonCount: 14,
    faderCount: 6,
    knobCount: 0,
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
      const empty = document.createElement("div");
      empty.className = "ui-list-row";
      empty.textContent = t("controller.noDevices");
      list.appendChild(empty);
      return;
    }
    for (const device of devices) {
      const row = document.createElement("div");
      row.className = "ui-list-row";
      row.style.gridTemplateColumns = "minmax(0, 1fr) auto";
      if (device.enabled === false) row.classList.add("is-disabled");

      const main = document.createElement("div");
      const name = document.createElement("div");
      name.className = "ui-list-row__name";
      name.textContent =
        device.deviceName || t("controller.deviceName", { number: Number(device.slot) + 1 });
      const meta = document.createElement("div");
      meta.className = "ui-list-row__meta";
      const buttons = Number(device.buttonCount ?? status.buttonCount ?? 14);
      const faders = Number(device.faderCount ?? status.faderCount ?? 6);
      const knobs = Number(device.knobCount ?? status.knobCount ?? 0);
      meta.innerHTML = `
        <span>${t("ui.count.buttons")}: ${buttons}</span>
        <span>${t("ui.count.faders")}: ${faders}</span>
        <span>${t("ui.count.knobs")}: ${knobs}</span>
      `;
      main.appendChild(name);
      main.appendChild(meta);

      const toggleCell = document.createElement("label");
      toggleCell.className = "settings-toggle";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = device.enabled !== false;
      input.disabled = busy || !status.enabled;
      input.addEventListener("change", () => {
        void setDeviceEnabled(device.slot, input.checked);
      });
      const ui = document.createElement("span");
      ui.className = "plugins-toggle-ui";
      ui.setAttribute("aria-hidden", "true");
      toggleCell.appendChild(input);
      toggleCell.appendChild(ui);

      row.appendChild(main);
      row.appendChild(toggleCell);
      list.appendChild(row);
    }
  }

  function update() {
    if (!root) return;
    const supported = status.supported !== false;
    const enabled = Boolean(status.enabled);
    const masterInput = read("master-input");
    const devicesBlock = read("devices-block");
    const unsupported = read("unsupported");
    const observeNote = read("observe-note");

    if (masterInput) {
      masterInput.checked = enabled;
      masterInput.disabled = !supported || busy;
    }
    if (unsupported) {
      unsupported.classList.toggle("hidden", supported);
      unsupported.textContent = t("controller.unsupported");
    }
    if (observeNote) {
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
        buttonCount: Number(next?.buttonCount) || 14,
        faderCount: Number(next?.faderCount) || 6,
        knobCount: Number(next?.knobCount) || 0,
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

  async function setDeviceEnabled(slot, enabled) {
    if (busy) return;
    busy = true;
    update();
    try {
      await invoke("set_controller_slot_enabled", {
        slot: Number(slot),
        enabled: Boolean(enabled),
      });
      await refresh();
    } catch (error) {
      console.error("Failed to update controller slot", error);
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
      <div class="ui-panel controller-settings">
        <div class="ui-page-header" data-role="master-row">
          <div class="ui-page-header__main">
            <span class="ui-page-header__icon" aria-hidden="true">${GAMEPAD_ICON}</span>
            <div>
              <h1 class="ui-content-title" data-role="master-label"></h1>
              <p class="ui-help" data-role="master-help"></p>
            </div>
          </div>
          <label class="settings-toggle" data-role="master-toggle">
            <input type="checkbox" data-role="master-input" />
            <span class="plugins-toggle-ui" aria-hidden="true"></span>
          </label>
        </div>
        <p class="ui-help controller-unsupported hidden" data-role="unsupported"></p>
        <p class="ui-help controller-observe-note hidden" data-role="observe-note"></p>
        <div class="controller-devices-block hidden" data-role="devices-block">
          <h3 class="ui-subsection-title" data-role="devices-heading"></h3>
          <div class="ui-list-stack" data-role="devices"></div>
        </div>
      </div>
    `;
    const masterLabel = read("master-label");
    if (masterLabel) masterLabel.textContent = t("controller.masterLabel");
    const masterHelp = read("master-help");
    if (masterHelp) masterHelp.textContent = t("inputs.controller.help");
    const observeNote = read("observe-note");
    if (observeNote) observeNote.textContent = t("controller.observeOnly");
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
