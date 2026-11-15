const BINDING_TYPE_FILTERS = new Set(["all", "faders", "buttons", "midi", "keyboard"]);

function deviceKind(deviceId) {
  const id = String(deviceId || "");
  if (id.startsWith("keyboard:")) return "keyboard";
  if (id.startsWith("controller:")) return "controller";
  if (id.startsWith("wheel:")) return "wheel";
  if (id.startsWith("midi:") || id) return "midi";
  return "midi";
}

export function createBindingRenderModel({
  fallbackNameFor,
  labelForControl,
  displayModeName,
  getTargets,
  isButtonBinding,
}) {
  function normalizeTypeFilter(value) {
    const normalized = String(value || "all").toLowerCase();
    return BINDING_TYPE_FILTERS.has(normalized) ? normalized : "all";
  }

  function matchesTypeFilter(binding, filterValue) {
    const normalized = normalizeTypeFilter(filterValue);
    if (normalized === "all") return true;
    if (normalized === "midi" || normalized === "keyboard") {
      return deviceKind(binding?.device_id) === normalized;
    }
    const isButton = isButtonBinding(binding);
    return normalized === "buttons" ? isButton : !isButton;
  }

  function searchText(binding, index) {
    return [
      binding?.name || "",
      fallbackNameFor(binding, index),
      labelForControl(binding?.control || {}, binding?.device_id),
      displayModeName(binding),
      JSON.stringify(getTargets(binding)),
      binding?.action || "",
      binding?.soundboard?.display || "",
      binding?.soundboard?.path || "",
    ].join(" ").toLowerCase();
  }

  return { normalizeTypeFilter, matchesTypeFilter, searchText };
}
