import { faSvg } from "../../shared/fa_icons.js";

export function muteIconSvg(muted) {
  return muted ? faSvg("volume-xmark") : faSvg("volume");
}

const ACTION_ICON_NAMES = Object.freeze({
  solo: "headphones",
  remove: "xmark",
  assign: "circle-dot",
  edit: "pen",
  delete: "trash",
});

export function bindingActionIconSvg(name) {
  const faName = ACTION_ICON_NAMES[name];
  return faName ? faSvg(faName) : "";
}
