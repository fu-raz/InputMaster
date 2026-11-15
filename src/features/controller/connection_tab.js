/** Inputs → Controller: observe-only panel, short master toggle, device table. */
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
    const tbody = read("devices-body");
    if (!tbody) return;
    tbody.innerHTML = "";
    const devices = Array.isArray(status.devices) ? status.devices : [];
    if (!devices.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.className = "ui-empty";
      cell.textContent = t("controller.noDevices");
      row.appendChild(cell);
      tbody.appendChild(row);
      return;
    }
    for (const device of devices) {
      const row = document.createElement("tr");
      const nameCell = document.createElement("td");
      nameCell.textContent =
        device.deviceName || t("controller.deviceName", { number: Number(device.slot) + 1 });

      const buttons = document.createElement("td");
      buttons.className = "ui-col-count";
      buttons.textContent = String(device.buttonCount ?? status.buttonCount ?? 14);

      const faders = document.createElement("td");
      faders.className = "ui-col-count";
      faders.textContent = String(device.faderCount ?? status.faderCount ?? 6);

      const knobs = document.createElement("td");
      knobs.className = "ui-col-count";
      knobs.textContent = String(device.knobCount ?? status.knobCount ?? 0);

      const toggleCell = document.createElement("td");
      toggleCell.className = "ui-col-toggle";
      const toggleLabel = document.createElement("label");
      toggleLabel.className = "settings-toggle";
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
      toggleLabel.appendChild(input);
      toggleLabel.appendChild(ui);
      toggleCell.appendChild(toggleLabel);

      row.appendChild(nameCell);
      row.appendChild(buttons);
      row.appendChild(faders);
      row.appendChild(knobs);
      row.appendChild(toggleCell);
      tbody.appendChild(row);
    }

    const advanced = read("advanced-body");
    if (advanced) {
      advanced.innerHTML = "";
      for (const device of devices) {
        const line = document.createElement("div");
        line.className = "ui-advanced__body";
        line.textContent = `${device.deviceName || device.slot}: ${device.deviceId || ""}`;
        advanced.appendChild(line);
      }
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
        <p class="ui-help controller-unsupported hidden" data-role="unsupported"></p>
        <div class="ui-toggle-row" data-role="master-row">
          <div class="ui-toggle-row__main">
            <span class="ui-toggle-row__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M6 10h12v6H6z"></path>
                <path d="M9 13h.01"></path>
                <path d="M15 12v2"></path>
                <path d="M14 13h2"></path>
                <path d="M4 13h2"></path>
                <path d="M18 13h2"></path>
              </svg>
            </span>
            <span class="ui-toggle-row__label" data-role="master-label"></span>
          </div>
          <label class="settings-toggle" data-role="master-toggle">
            <input type="checkbox" data-role="master-input" />
            <span class="plugins-toggle-ui" aria-hidden="true"></span>
          </label>
        </div>
        <p class="ui-help controller-observe-note hidden" data-role="observe-note"></p>
        <div class="controller-devices-block hidden" data-role="devices-block">
          <h3 class="ui-subsection-title" data-role="devices-heading"></h3>
          <table class="ui-device-table" data-role="devices-table">
            <thead>
              <tr>
                <th data-role="col-name"></th>
                <th class="ui-col-count" data-role="col-buttons"></th>
                <th class="ui-col-count" data-role="col-faders"></th>
                <th class="ui-col-count" data-role="col-knobs"></th>
                <th class="ui-col-toggle" data-role="col-enabled"></th>
              </tr>
            </thead>
            <tbody data-role="devices-body"></tbody>
          </table>
          <details class="ui-advanced">
            <summary data-role="advanced-summary"></summary>
            <div data-role="advanced-body"></div>
          </details>
        </div>
      </div>
    `;
    const masterLabel = read("master-label");
    if (masterLabel) masterLabel.textContent = t("controller.masterLabel");
    const observeNote = read("observe-note");
    if (observeNote) observeNote.textContent = t("controller.observeOnly");
    const heading = read("devices-heading");
    if (heading) heading.textContent = t("controller.devicesHeading");
    const colName = read("col-name");
    if (colName) colName.textContent = t("common.name");
    const colButtons = read("col-buttons");
    if (colButtons) colButtons.textContent = t("ui.count.buttons");
    const colFaders = read("col-faders");
    if (colFaders) colFaders.textContent = t("ui.count.faders");
    const colKnobs = read("col-knobs");
    if (colKnobs) colKnobs.textContent = t("ui.count.knobs");
    const colEnabled = read("col-enabled");
    if (colEnabled) colEnabled.textContent = t("ui.enabled");
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
