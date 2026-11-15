const CONTROLS = [
  { controller: 1, msgType: "Note", nameKey: "controller.controls.a", fallback: "A" },
  { controller: 2, msgType: "Note", nameKey: "controller.controls.b", fallback: "B" },
  { controller: 3, msgType: "Note", nameKey: "controller.controls.x", fallback: "X" },
  { controller: 4, msgType: "Note", nameKey: "controller.controls.y", fallback: "Y" },
  { controller: 5, msgType: "Note", nameKey: "controller.controls.leftShoulder", fallback: "Left Bumper" },
  { controller: 6, msgType: "Note", nameKey: "controller.controls.rightShoulder", fallback: "Right Bumper" },
  { controller: 7, msgType: "Note", nameKey: "controller.controls.back", fallback: "Back / View" },
  { controller: 8, msgType: "Note", nameKey: "controller.controls.start", fallback: "Start / Menu" },
  { controller: 9, msgType: "Note", nameKey: "controller.controls.leftThumb", fallback: "Left Stick Click" },
  { controller: 10, msgType: "Note", nameKey: "controller.controls.rightThumb", fallback: "Right Stick Click" },
  { controller: 11, msgType: "Note", nameKey: "controller.controls.dpadUp", fallback: "D-Pad Up" },
  { controller: 12, msgType: "Note", nameKey: "controller.controls.dpadDown", fallback: "D-Pad Down" },
  { controller: 13, msgType: "Note", nameKey: "controller.controls.dpadLeft", fallback: "D-Pad Left" },
  { controller: 14, msgType: "Note", nameKey: "controller.controls.dpadRight", fallback: "D-Pad Right" },
  { controller: 20, msgType: "ControlChange", nameKey: "controller.controls.leftStickX", fallback: "Left Stick X", continuous: true },
  { controller: 21, msgType: "ControlChange", nameKey: "controller.controls.leftStickY", fallback: "Left Stick Y", continuous: true },
  { controller: 22, msgType: "ControlChange", nameKey: "controller.controls.rightStickX", fallback: "Right Stick X", continuous: true },
  { controller: 23, msgType: "ControlChange", nameKey: "controller.controls.rightStickY", fallback: "Right Stick Y", continuous: true },
  { controller: 24, msgType: "ControlChange", nameKey: "controller.controls.leftTrigger", fallback: "Left Trigger", continuous: true },
  { controller: 25, msgType: "ControlChange", nameKey: "controller.controls.rightTrigger", fallback: "Right Trigger", continuous: true },
];

export function isControllerDeviceId(deviceId) {
  return /^controller:xinput:[0-3]$/.test(String(deviceId || "").trim());
}

export function controllerDeviceLabel(deviceId, t = null) {
  const match = String(deviceId || "").trim().match(/^controller:xinput:([0-3])$/);
  if (!match) return null;
  const number = Number(match[1]) + 1;
  if (typeof t === "function") {
    const translated = t("controller.deviceName", { number });
    if (translated && translated !== "controller.deviceName") return translated;
  }
  return `Controller ${number}`;
}

export function controllerControlLabel(control, t = null) {
  const controller = Number(control?.controller);
  const msgType = String(control?.msg_type || control?.msgType || "ControlChange");
  const match = CONTROLS.find(
    (entry) => entry.controller === controller && entry.msgType === msgType,
  );
  if (!match) return null;
  if (typeof t === "function") {
    const translated = t(match.nameKey);
    if (translated && translated !== match.nameKey) return translated;
  }
  return match.fallback;
}
