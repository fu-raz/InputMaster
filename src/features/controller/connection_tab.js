import { faBrandSvg, faSvg } from "../../shared/fa_icons.js";

function detectVendor(device) {
  const raw = String(device?.vendor || device?.deviceName || "").toLowerCase();
  if (raw.includes("playstation") || raw.includes("dualshock") || raw.includes("dualsense") || raw.includes("sony")) {
    return "playstation";
  }
  if (raw.includes("nintendo") || raw.includes("switch") || raw.includes("joy-con") || raw.includes("pro controller")) {
    return "nintendo";
  }
  if (raw.includes("xbox") || raw.includes("xinput") || device?.vendor === "xbox") {
    return "xbox";
  }
  // XInput path is Xbox-compatible; default when no stronger signal.
  return "xbox";
}

function vendorIcon(vendor) {
  // FA Pro brands has xbox + playstation; no Nintendo brand glyph — use light joystick.
  if (vendor === "playstation") return faBrandSvg("playstation");
  if (vendor === "nintendo") return faSvg("joystick");
  return faBrandSvg("xbox");
}

function vendorLabel(t, vendor) {
  if (vendor === "playstation") return t("controller.vendor.playstation");
  if (vendor === "nintendo") return t("controller.vendor.nintendo");
  return t("controller.vendor.xbox");
}

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
    const table = read("devices");
    if (!table) return;
    table.innerHTML = "";

    const header = document.createElement("div");
    header.className = "ui-device-table__header";
    header.setAttribute("aria-hidden", "true");
    header.innerHTML = `
      <span>${t("controller.col.number")}</span>
      <span>${t("controller.col.name")}</span>
      <span>${t("controller.col.buttons")}</span>
      <span>${t("controller.col.faders")}</span>
      <span>${t("controller.col.knobs")}</span>
      <span>${t("controller.col.enable")}</span>
    `;
    table.appendChild(header);

    const devices = Array.isArray(status.devices) ? status.devices : [];
    if (!devices.length) {
      const empty = document.createElement("div");
      empty.className = "ui-device-table__empty";
      empty.textContent = t("controller.noDevices");
      table.appendChild(empty);
      return;
    }

    for (const device of devices) {
      const row = document.createElement("div");
      row.className = "ui-device-table__row";
      if (device.enabled === false) row.classList.add("is-disabled");

      const number = Number(device.slot) + 1;
      const vendor = detectVendor(device);
      const nameText =
        device.deviceName && !/^controller\s+\d+$/i.test(String(device.deviceName).trim())
          ? device.deviceName
          : t("controller.xboxName");

      const num = document.createElement("span");
      num.className = "ui-device-table__num";
      num.textContent = String(number);

      const name = document.createElement("div");
      name.className = "ui-device-table__name";
      name.innerHTML = `
        <span class="ui-device-table__vendor" title="${vendorLabel(t, vendor)}">${vendorIcon(vendor)}</span>
        <span class="ui-device-table__name-text"></span>
      `;
      name.querySelector(".ui-device-table__name-text").textContent = nameText;

      const buttons = document.createElement("span");
      buttons.className = "ui-device-table__stat";
      buttons.textContent = String(Number(device.buttonCount ?? status.buttonCount ?? 14));

      const faders = document.createElement("span");
      faders.className = "ui-device-table__stat";
      faders.textContent = String(Number(device.faderCount ?? status.faderCount ?? 6));

      const knobs = document.createElement("span");
      knobs.className = "ui-device-table__stat";
      knobs.textContent = String(Number(device.knobCount ?? status.knobCount ?? 0));

      const toggleCell = document.createElement("label");
      toggleCell.className = "settings-toggle ui-device-table__enable";
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

      row.appendChild(num);
      row.appendChild(name);
      row.appendChild(buttons);
      row.appendChild(faders);
      row.appendChild(knobs);
      row.appendChild(toggleCell);
      table.appendChild(row);
    }
  }

  function syncMasterPanelOpacity() {
    const panel = read("content-panel");
    if (!panel) return;
    const enabled = Boolean(status.enabled) && status.supported !== false;
    panel.classList.toggle("is-master-off", !enabled);
  }

  function update() {
    if (!root) return;
    const supported = status.supported !== false;
    const enabled = Boolean(status.enabled);
    const masterInput = read("master-input");
    const devicesBlock = read("devices-block");
    const unsupported = read("unsupported");

    if (masterInput) {
      masterInput.checked = enabled;
      masterInput.disabled = !supported || busy;
    }
    if (unsupported) {
      unsupported.classList.toggle("hidden", supported);
      unsupported.textContent = t("controller.unsupported");
    }
    if (devicesBlock) {
      devicesBlock.classList.toggle("hidden", !enabled || !supported);
    }
    syncMasterPanelOpacity();
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
      <div class="ui-page-header" data-role="master-row">
        <div class="ui-page-header__main">
          <span class="ui-page-header__icon" aria-hidden="true">${faSvg("gamepad-modern")}</span>
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
      <div class="ui-panel controller-settings" data-role="content-panel">
        <p class="ui-help controller-unsupported hidden" data-role="unsupported"></p>
        <div class="controller-devices-block hidden" data-role="devices-block">
          <h3 class="ui-subsection-title" data-role="devices-heading"></h3>
          <div class="ui-device-table" data-role="devices"></div>
        </div>
      </div>
    `;
    const masterLabel = read("master-label");
    if (masterLabel) masterLabel.textContent = t("controller.masterLabel");
    const masterHelp = read("master-help");
    if (masterHelp) masterHelp.textContent = t("inputs.controller.help");
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
