export const KEYBOARD_DEVICE_ID = "keyboard:local";
export const KEYBOARD_DEVICE_NAME = "Keyboard / media keys";

const CONTROLS = [
  { controller: 1, msgType: "Note", nameKey: "keyboard.controls.volumeMute", fallback: "Volume Mute" },
  { controller: 2, msgType: "Note", nameKey: "keyboard.controls.volumeUp", fallback: "Volume Up" },
  { controller: 3, msgType: "Note", nameKey: "keyboard.controls.volumeDown", fallback: "Volume Down" },
  { controller: 7, msgType: "ControlChange", nameKey: "keyboard.controls.volumeWheel", fallback: "Volume Wheel", continuous: true },
  { controller: 10, msgType: "Note", nameKey: "keyboard.controls.playPause", fallback: "Play / Pause" },
  { controller: 11, msgType: "Note", nameKey: "keyboard.controls.next", fallback: "Next Track" },
  { controller: 12, msgType: "Note", nameKey: "keyboard.controls.prev", fallback: "Previous Track" },
  { controller: 13, msgType: "Note", nameKey: "keyboard.controls.stop", fallback: "Stop" },
];

export function isKeyboardDeviceId(deviceId) {
  return String(deviceId || "").trim() === KEYBOARD_DEVICE_ID;
}

export function keyboardControlLabel(control, t = null) {
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

export function isKeyboardVolumeWheel(control) {
  return (
    Number(control?.controller) === 7 &&
    String(control?.msg_type || control?.msgType || "") === "ControlChange"
  );
}
