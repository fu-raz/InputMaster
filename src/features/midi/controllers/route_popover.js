import { closeOpenDropdowns, renderLabelWithBadges } from "../../ui/dropdown_badges.js";
import { routesFromResolvedPreferences } from "../route_policy.js";

/** Route editor host — inline on Inputs→MIDI (no popover button). */
export function createRoutePopover({
  lifetime,
  connection,
  currentRoutesForSave,
  elements,
  desiredRoutes,
  discovery,
  refreshMidiDevices,
  renderRoutesPopover,
  resolveDesiredRouteSet,
  resolveMidiDeviceStatusPresentation,
  routeEditor,
  routeView,
  t,
}) {
  function isInlineRoutes() {
    return Boolean(document.getElementById("inputs-midi-routes-host"));
  }

  function closeDeviceDropdowns() {
    closeOpenDropdowns({ except: null });
  }

  function discardRouteDrafts() {
    routeEditor.discard();
  }

  function closeRoutesPopover({ discard = true } = {}) {
    if (discard) discardRouteDrafts();
    if (isInlineRoutes()) {
      // Keep the panel visible; reset drafts to the live desired routes.
      routeEditor.begin(desiredRoutes());
      renderRoutesPopover();
      renderDeviceDropdowns();
      return;
    }
    if (routeView.routesPopoverEl) routeView.routesPopoverEl.classList.add("hidden");
    if (routeView.routesButtonEl) routeView.routesButtonEl.setAttribute("aria-expanded", "false");
    renderDeviceDropdowns();
  }

  function ensureRoutesPopover() {
    const host = document.getElementById("inputs-midi-routes-host");
    if (host) {
      if (!routeView.routesPopoverEl || routeView.routesPopoverEl.parentElement !== host) {
        if (routeView.routesPopoverEl?.isConnected) {
          routeView.routesPopoverEl.remove();
        }
        routeView.routesPopoverEl = document.createElement("div");
        routeView.routesPopoverEl.className = "midi-routes-popover midi-routes-inline";
        routeView.routesPopoverEl.setAttribute("role", "region");
        routeView.routesPopoverEl.setAttribute("aria-label", t("midi.routes"));
        host.replaceChildren(routeView.routesPopoverEl);
      } else {
        routeView.routesPopoverEl.classList.remove("hidden");
        routeView.routesPopoverEl.classList.add("midi-routes-inline");
      }
      // Never show the old popover trigger on Inputs.
      if (routeView.routesButtonEl) {
        routeView.routesButtonEl.classList.add("hidden");
        routeView.routesButtonEl.setAttribute("aria-hidden", "true");
      }
      return;
    }

    // Fallback (should not be needed once Inputs hosts the editor).
    if (!routeView.routesPopoverEl) {
      routeView.routesPopoverEl = document.createElement("div");
      routeView.routesPopoverEl.className = "midi-routes-popover";
      routeView.routesPopoverEl.setAttribute("role", "region");
      routeView.routesPopoverEl.setAttribute("aria-label", t("midi.routes"));
      document.body.appendChild(routeView.routesPopoverEl);
    }
  }

  function showInlineRoutesEditor() {
    ensureRoutesPopover();
    const cachedResolution = resolveDesiredRouteSet(
      discovery.lastDeviceSnapshot,
      { routes: desiredRoutes(), configured: true },
      "route_editor_inline_open",
    );
    routeEditor.begin(routesFromResolvedPreferences(cachedResolution));
    renderRoutesPopover();
    void refreshMidiDevices({ force: true, reason: "route_editor_inline_open" }).then((snapshot) => {
      if (routeEditor.isDirty()) return;
      const refreshedResolution = resolveDesiredRouteSet(
        snapshot,
        { routes: desiredRoutes(), configured: true },
        "route_editor_inline_refreshed",
      );
      routeEditor.begin(routesFromResolvedPreferences(refreshedResolution));
      renderRoutesPopover();
    });
  }

  function ensureOutputRouteShell() {
    // Routes button removed; keep status chips next to each other without a shell trigger.
    return;
  }

  function syncRoutesButtonLabel() {
    // No-op: popover trigger removed.
  }

  function createRouteIcon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");

    const icons = {
      sliders: [
        "M4 21v-7",
        "M4 10V3",
        "M12 21v-9",
        "M12 8V3",
        "M20 21v-5",
        "M20 12V3",
        "M2 14h4",
        "M10 8h4",
        "M18 16h4",
      ],
      close: ["M18 6 6 18", "M6 6l12 12"],
      trash: ["M3 6h18", "M8 6V4h8v2", "M6 6l1 15h10l1-15", "M10 11v6", "M14 11v6"],
    };

    (icons[name] || icons.sliders).forEach((dValue) => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", dValue);
      svg.appendChild(path);
    });

    return svg;
  }

  function setIconButton(button, name) {
    button.replaceChildren(createRouteIcon(name));
  }

  function syncRoutesPopoverPosition() {
    // Inline panel does not need fixed positioning.
  }

  function ensureDeviceDropdowns() {
    if (!elements.midiSelect && !elements.midiOutputSelect) return;
    const attachStatus = (selectEl, kind) => {
      if (!selectEl) return;

      let existingRoot = kind === "input" ? routeView.inputStatusEl : routeView.outputStatusEl;
      if (existingRoot && existingRoot.isConnected) return;

      selectEl.classList.add("hidden");
      const root = document.createElement("div");
      root.className = `midi-device-status midi-device-status-${kind}`;
      root.setAttribute("role", "status");
      root.setAttribute("aria-live", "polite");

      const display = document.createElement("span");
      display.className = "target-display";
      root.appendChild(display);

      // Inputs MIDI no longer shows a redundant active/none summary row; keep status nodes off-DOM.
      root.classList.add("visually-hidden");
      selectEl.insertAdjacentElement("afterend", root);

      if (kind === "input") {
        routeView.inputStatusEl = root;
        routeView.inputStatusDisplayEl = display;
      } else {
        routeView.outputStatusEl = root;
        routeView.outputStatusDisplayEl = display;
      }
    };

    attachStatus(elements.midiSelect, "input");
    attachStatus(elements.midiOutputSelect, "output");

    if (!routeView.deviceDocClickBound) {
      routeView.deviceDocClickBound = true;
      lifetime.listen(document, "click", (event) => {
        if (routeView.inputStatusEl && routeView.inputStatusEl.contains(event.target)) return;
        if (routeView.outputStatusEl && routeView.outputStatusEl.contains(event.target)) return;
        if (routeView.routesPopoverEl && routeView.routesPopoverEl.contains(event.target)) return;
        closeDeviceDropdowns();
      });
    }

    ensureRoutesPopover();
    if (isInlineRoutes() && !routeView.inlineEditorBooted) {
      routeView.inlineEditorBooted = true;
      showInlineRoutesEditor();
    }
  }

  function renderDeviceStatus(root, displayEl, kind) {
    if (!root || !displayEl) return;
    const presentation = resolveMidiDeviceStatusPresentation({
      routes: connection.connectedRoutes,
      kind,
      loading: discovery.initialDeviceLoadPending,
      translate: t,
    });
    const extraCount = Math.max(0, presentation.activeRoutes.length - 1);
    const additionalDevices = presentation.additionalDevices;
    const additionalDeviceList = additionalDevices.join(", ");
    const badges =
      extraCount > 0
        ? [
            {
              text: `+${extraCount}`,
              kind: "count",
              title: additionalDeviceList,
              ariaLabel: additionalDeviceList,
            },
          ]
        : [];
    renderLabelWithBadges(displayEl, {
      text: presentation.label,
      badges,
      truncate: true,
    });
    root.title = presentation.title;
    root.classList.toggle("device-loading", presentation.isLoading);
    root.classList.toggle("device-connected", presentation.activeRoutes.length > 0);
    root.classList.toggle(
      "device-unavailable",
      !presentation.isLoading && presentation.activeRoutes.length === 0,
    );
    root.classList.toggle("device-empty", !presentation.isLoading && presentation.activeRoutes.length === 0);
  }

  function renderDeviceDropdowns() {
    ensureDeviceDropdowns();
    renderDeviceStatus(routeView.inputStatusEl, routeView.inputStatusDisplayEl, "input");
    renderDeviceStatus(routeView.outputStatusEl, routeView.outputStatusDisplayEl, "output");
    if (isInlineRoutes()) {
      if (!routeEditor.isDirty()) {
        // Keep inline editor content current when not mid-edit.
        if (!routeView.routesPopoverEl || routeView.routesPopoverEl.childElementCount === 0) {
          showInlineRoutesEditor();
        }
      }
    }
  }

  return {
    discardRouteDrafts,
    closeRoutesPopover,
    setIconButton,
    syncRoutesPopoverPosition,
    ensureDeviceDropdowns,
    renderDeviceDropdowns,
    showInlineRoutesEditor,
  };
}
