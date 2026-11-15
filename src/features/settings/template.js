// Declarative markup: kept intact to preserve DOM hierarchy and CSS selectors.
export const settingsTemplate = `<section id="settings-panel" class="app-page hidden" data-page-panel="settings">
          <div class="settings-panel-body">
            <div class="settings-shell">
              <aside class="settings-sidebar" aria-label="Settings sections" data-i18n-aria-label="settings.sections">
                <h1 class="settings-page-title" data-i18n="settings.title">Settings</h1>
                <div class="settings-nav-indicator" aria-hidden="true"></div>
                <nav class="settings-nav">
                  <button class="settings-nav-item active" type="button" data-settings-section="startup" aria-current="page">
                    <span class="settings-nav-icon" data-fa="sliders" aria-hidden="true"></span>
                    <span class="settings-nav-label" data-i18n="settings.general">General</span>
                  </button>
                  <button class="settings-nav-item" type="button" data-settings-section="osd">
                    <span class="settings-nav-icon" data-fa="display" aria-hidden="true"></span>
                    <span class="settings-nav-label" data-i18n="settings.osd">On-Screen Display</span>
                  </button>
                  <button class="settings-nav-item" type="button" data-settings-section="appearance">
                    <span class="settings-nav-icon" data-fa="palette" aria-hidden="true"></span>
                    <span class="settings-nav-label" data-i18n="settings.appearance">Appearance</span>
                  </button>
                  <button class="settings-nav-item" type="button" data-settings-section="maintenance">
                    <span class="settings-nav-icon" data-fa="screwdriver-wrench" aria-hidden="true"></span>
                    <span class="settings-nav-label" data-i18n="settings.maintenance">Maintenance</span>
                  </button>
                </nav>
              </aside>

              <div class="settings-content">
                <section class="settings-section settings-section-panel settings-general-section active" data-settings-panel="startup">
                  <div class="settings-card settings-startup-card">
                    <div class="settings-card-section-heading">
                      <span class="settings-card-section-icon" data-fa="clock" aria-hidden="true"></span>
                      <span data-i18n="settings.behavior">Behavior</span>
                    </div>
                    <div class="settings-startup-row settings-language-row">
                      <div class="settings-startup-row-main">
                        <span class="settings-startup-icon" data-fa="language" aria-hidden="true"></span>
                        <div class="settings-field-label" data-i18n="settings.language">Language</div>
                      </div>
                      <select id="language-select" title="Language" data-i18n-title="settings.language"></select>
                    </div>
                    <div class="settings-startup-row">
                      <div class="settings-startup-row-main">
                        <span class="settings-startup-icon" data-fa="power-off" aria-hidden="true"></span>
                        <div class="settings-field-label" data-i18n="settings.startWithWindows">Start with Windows</div>
                      </div>
                      <label class="settings-toggle" title="Start with Windows" data-i18n-title="settings.startWithWindows">
                        <input id="start-with-windows" type="checkbox" />
                        <span class="plugins-toggle-ui" aria-hidden="true"></span>
                      </label>
                    </div>
                    <div class="settings-startup-row">
                      <div class="settings-startup-row-main">
                        <span class="settings-startup-icon" data-fa="arrow-down-to-bracket" aria-hidden="true"></span>
                        <div class="settings-field-label" data-i18n="settings.startInTray">Start in tray</div>
                      </div>
                      <label class="settings-toggle" title="Start in tray" data-i18n-title="settings.startInTray">
                        <input id="start-in-tray" type="checkbox" />
                        <span class="plugins-toggle-ui" aria-hidden="true"></span>
                      </label>
                    </div>
                    <div class="settings-startup-row">
                      <div class="settings-startup-row-main">
                        <span class="settings-startup-icon" data-fa="arrow-down" aria-hidden="true"></span>
                        <div class="settings-field-label" data-i18n="settings.minimizeToTray">Minimize to tray</div>
                      </div>
                      <label class="settings-toggle" title="Minimize to tray" data-i18n-title="settings.minimizeToTray">
                        <input id="minimize-to-tray" type="checkbox" />
                        <span class="plugins-toggle-ui" aria-hidden="true"></span>
                      </label>
                    </div>
                    <div class="settings-startup-row">
                      <div class="settings-startup-row-main">
                        <span class="settings-startup-icon" data-fa="arrow-right-from-bracket" aria-hidden="true"></span>
                        <div class="settings-field-label" data-i18n="settings.exitToTray">Exit to tray</div>
                      </div>
                      <label class="settings-toggle" title="Exit to tray" data-i18n-title="settings.exitToTray">
                        <input id="exit-to-tray" type="checkbox" />
                        <span class="plugins-toggle-ui" aria-hidden="true"></span>
                      </label>
                    </div>
                  </div>

                  <div class="settings-card settings-update-card">
                    <div class="settings-card-section-heading">
                      <span class="settings-card-section-icon" data-fa="arrows-rotate" aria-hidden="true"></span>
                      <span data-i18n="settings.updates">Updates</span>
                    </div>
                    <div class="settings-startup-row settings-update-toggle-row">
                      <div class="settings-startup-row-main">
                        <span class="settings-startup-icon" data-fa="arrows-rotate" aria-hidden="true"></span>
                        <div class="settings-field-label" data-i18n="settings.autoCheckUpdates">Automatically check for updates</div>
                      </div>
                      <label class="settings-toggle" title="Automatically check for updates" data-i18n-title="settings.autoCheckUpdates">
                        <input id="auto-check-updates-button" type="checkbox" />
                        <span class="plugins-toggle-ui" aria-hidden="true"></span>
                      </label>
                    </div>
                    <div class="settings-update-summary">
                      <div id="settings-update-status" class="settings-inline-status">
                        <span class="settings-status-icon" data-fa="circle-check" aria-hidden="true"></span>
                        <span class="settings-status-text" data-i18n="settings.noUpdateCheckYet">No update check yet.</span>
                      </div>
                      <div class="settings-update-versions">
                        <span><span data-i18n="common.current">Current</span> <strong id="update-current-version">-</strong></span>
                        <span><span data-i18n="common.latest">Latest</span> <strong id="update-latest-version">-</strong></span>
                      </div>
                    </div>
                    <button id="check-for-updates" type="button" class="settings-action">
                      <span class="settings-button-icon" data-fa="arrows-rotate" aria-hidden="true"></span>
                      <span class="settings-button-label" data-i18n="settings.checkForUpdates">Check for updates</span>
                    </button>
                  </div>
                </section>

                <section class="settings-section settings-section-panel settings-osd-section" data-settings-panel="osd">
                  <div class="settings-card">
                    <div class="settings-field-row settings-field-row--monitor">
                      <div class="settings-field-label" data-i18n="settings.general">General</div>
                      <div class="settings-monitor-control">
                        <div class="settings-osd-enabled-control">
                          <span class="settings-inline-label" data-i18n="settings.enabled">Enabled</span>
                          <label class="settings-toggle" title="Toggle on-screen display" data-i18n-title="settings.toggleOsd">
                            <input id="osd-enabled" type="checkbox" checked />
                            <span class="plugins-toggle-ui" aria-hidden="true"></span>
                          </label>
                        </div>
                        <div class="settings-osd-monitor-select-control">
                          <span class="settings-inline-label" data-i18n="settings.monitor">Monitor</span>
                          <select id="osd-monitor"></select>
                        </div>
                        <div class="settings-osd-label-control">
                          <span class="settings-inline-label" data-i18n="settings.osdLabel">Displayed name</span>
                          <select id="osd-label-mode" title="Displayed name" data-i18n-title="settings.osdLabel">
                            <option value="target" data-i18n="settings.osdLabelTarget">Target name</option>
                            <option value="binding" data-i18n="settings.osdLabelBinding">Binding name</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    <div class="settings-field-row settings-field-row--appearance">
                      <div class="settings-field-label" data-i18n="settings.appearance">Appearance</div>
                      <div class="settings-appearance-grid">
                        <div class="settings-appearance-control">
                          <span data-i18n="settings.style">Style</span>
                          <select id="osd-style">
                            <option value="midnight" data-i18n="settings.styleDark">Dark</option>
                            <option value="glass" data-i18n="settings.styleGlass">Glass</option>
                            <option value="neon" data-i18n="settings.styleNeon">Neon</option>
                            <option value="studio" data-i18n="settings.styleStudio">Studio</option>
                          </select>
                          <div class="osd-style-segments" aria-label="OSD style" data-i18n-aria-label="settings.osdStyle">
                            <button type="button" class="osd-style-segment" data-osd-style-option="midnight" data-i18n="settings.styleDark">Dark</button>
                            <button type="button" class="osd-style-segment" data-osd-style-option="glass" data-i18n="settings.styleGlass">Glass</button>
                            <button type="button" class="osd-style-segment" data-osd-style-option="neon" data-i18n="settings.styleNeon">Neon</button>
                            <button type="button" class="osd-style-segment" data-osd-style-option="studio" data-i18n="settings.styleStudio">Studio</button>
                          </div>
                        </div>
                        <div class="settings-appearance-control">
                          <span data-i18n="settings.transparency">Transparency</span>
                          <div class="settings-range-control">
                            <input id="osd-transparency" class="binding-volume-slider" type="range" min="35" max="100" step="1" value="96" />
                            <span id="osd-transparency-value" class="settings-range-value">96%</span>
                          </div>
                        </div>
                        <div class="settings-appearance-control">
                          <span data-i18n="settings.size">Size</span>
                          <div class="settings-range-control">
                            <input id="osd-scale" class="binding-volume-slider" type="range" min="75" max="150" step="5" value="100" />
                            <span id="osd-scale-value" class="settings-range-value">100%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="settings-field-row settings-field-row--position">
                      <div class="settings-field-label" data-i18n="settings.position">Position</div>
                      <div class="settings-position-layout" id="osd-position-picker" data-anchor="top-right">
                        <div class="settings-osd-preview">
                          <div class="settings-osd-preview-screen">
                            <button type="button" class="osd-position-dot" data-anchor="top-left" aria-label="Top left" data-i18n-aria-label="settings.positionTopLeft"></button>
                            <button type="button" class="osd-position-dot" data-anchor="top-center" aria-label="Top center" data-i18n-aria-label="settings.positionTopCenter"></button>
                            <button type="button" class="osd-position-dot selected" data-anchor="top-right" aria-label="Top right" data-i18n-aria-label="settings.positionTopRight"></button>
                            <button type="button" class="osd-position-dot" data-anchor="center-left" aria-label="Center left" data-i18n-aria-label="settings.positionCenterLeft"></button>
                            <button type="button" class="osd-position-dot" data-anchor="center" aria-label="Center" data-i18n-aria-label="settings.positionCenter"></button>
                            <button type="button" class="osd-position-dot" data-anchor="center-right" aria-label="Center right" data-i18n-aria-label="settings.positionCenterRight"></button>
                            <button type="button" class="osd-position-dot" data-anchor="bottom-left" aria-label="Bottom left" data-i18n-aria-label="settings.positionBottomLeft"></button>
                            <button type="button" class="osd-position-dot" data-anchor="bottom-center" aria-label="Bottom center" data-i18n-aria-label="settings.positionBottomCenter"></button>
                            <button type="button" class="osd-position-dot" data-anchor="bottom-right" aria-label="Bottom right" data-i18n-aria-label="settings.positionBottomRight"></button>
                            <div class="settings-osd-preview-card">
                              <div class="settings-osd-preview-header">
                                <div class="settings-osd-preview-icon"></div>
                                <div class="settings-osd-preview-label">InputMaster</div>
                                <div class="settings-osd-preview-value">100%</div>
                              </div>
                              <div class="settings-osd-preview-bar">
                                <div class="settings-osd-preview-fill"></div>
                              </div>
                            </div>
                          </div>
                          <div class="settings-osd-preview-stand"></div>
                        </div>
                        <div class="settings-field-help" data-i18n="settings.osdPositionHelp">The on-screen display will appear in the selected area of your screen.</div>
                      </div>
                    </div>
                  </div>
                </section>

                <section class="settings-section settings-section-panel settings-appearance-section" data-settings-panel="appearance">
                  <div class="settings-appearance-card">
                    <div class="appearance-preset-preview-row">
                      <div class="appearance-preset-column">
                        <div class="settings-card-section-heading settings-card-section-heading--inline">
                          <span data-i18n="settings.appearance.themePresets">Theme Presets</span>
                        </div>
                        <div id="appearance-presets" class="appearance-presets" aria-label="Theme presets" data-i18n-aria-label="settings.appearance.themePresets"></div>
                      </div>
                    </div>

                    <div class="appearance-settings-grid">
                      <div class="settings-card-section-heading settings-card-section-heading--inline">
                        <span data-i18n="settings.appearance.themeCustomization">Theme Customization</span>
                      </div>
                      <div class="appearance-subcard">
                        <div class="appearance-control-group appearance-control-group--theme-colors">
                          <label class="appearance-control-label" data-i18n="settings.appearance.themeColors">Theme Colors</label>
                          <div id="appearance-theme-colors" class="appearance-theme-colors"></div>
                        </div>
                        <div class="appearance-range-stack">
                          <div class="appearance-control-group appearance-control-group--temperature">
                            <label class="appearance-control-label" for="appearance-temperature" data-i18n="settings.appearance.colorTemperature">Color Temperature</label>
                            <div class="settings-range-control">
                              <input id="appearance-temperature" class="binding-volume-slider" type="range" min="0" max="100" step="1" value="50" />
                              <span id="appearance-temperature-value" class="settings-range-value">50%</span>
                            </div>
                          </div>
                          <div class="appearance-inline-control appearance-inline-control--background-glow">
                            <label class="appearance-control-label" for="appearance-background-glow" data-i18n="settings.appearance.backgroundGlow">Background Glow</label>
                            <div class="settings-range-control">
                              <input id="appearance-background-glow" class="binding-volume-slider" type="range" min="0" max="100" step="1" value="30" />
                              <span id="appearance-background-glow-value" class="settings-range-value">30%</span>
                            </div>
                          </div>
                          <div class="appearance-inline-control appearance-inline-control--font-size">
                            <label class="appearance-control-label" for="appearance-font-size" data-i18n="settings.appearance.fontSize">Font Size</label>
                            <div class="settings-range-control">
                              <input id="appearance-font-size" class="binding-volume-slider" type="range" min="11" max="18" step="1" value="15" />
                              <span id="appearance-font-size-value" class="settings-range-value">15px</span>
                            </div>
                          </div>
                          <div class="appearance-inline-control appearance-inline-control--surface-contrast">
                            <label class="appearance-control-label" for="appearance-surface-contrast" data-i18n="settings.appearance.surfaceContrast">Surface Contrast</label>
                            <div class="settings-range-control">
                              <input id="appearance-surface-contrast" class="binding-volume-slider" type="range" min="0" max="100" step="1" value="50" />
                              <span id="appearance-surface-contrast-value" class="settings-range-value">50%</span>
                            </div>
                          </div>
                          <div class="appearance-inline-control appearance-inline-control--icon-glow">
                            <label class="appearance-control-label" for="appearance-icon-glow" data-i18n="settings.appearance.iconGlow">Icon Glow</label>
                            <div class="settings-range-control">
                              <input id="appearance-icon-glow" class="binding-volume-slider" type="range" min="0" max="100" step="1" value="50" />
                              <span id="appearance-icon-glow-value" class="settings-range-value">50%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div id="appearance-color-popover" class="appearance-color-popover hidden" role="dialog" aria-label="Custom color" data-i18n-aria-label="settings.appearance.customColor">
                      <div class="appearance-color-popover-header">
                        <span id="appearance-color-popover-title" data-i18n="settings.appearance.customColor">Custom Color</span>
                        <button type="button" class="appearance-color-close" data-appearance-color-close aria-label="Close" data-i18n-aria-label="common.close">
                          <span data-fa="xmark" aria-hidden="true"></span>
                        </button>
                      </div>
                      <div id="appearance-color-field" class="appearance-color-field" tabindex="0" aria-label="Custom color" data-i18n-aria-label="settings.appearance.customColor">
                        <span class="appearance-color-field-handle" aria-hidden="true"></span>
                      </div>
                      <input id="appearance-color-hue" class="appearance-color-hue" type="range" min="0" max="359" step="1" value="210" aria-label="Hue" data-i18n-aria-label="settings.appearance.hue" />
                      <div id="appearance-color-suggestions" class="appearance-color-suggestions" aria-label="Suggested colors" data-i18n-aria-label="settings.appearance.suggestedColors"></div>
                      <div class="appearance-color-footer">
                        <span class="appearance-color-preview" aria-hidden="true"></span>
                        <input id="appearance-color-hex" class="appearance-color-hex" type="text" value="#5aa7ff" maxlength="7" spellcheck="false" aria-label="Hex color" data-i18n-aria-label="settings.appearance.hexColor" />
                      </div>
                    </div>

                  </div>
                </section>

                <section class="settings-section settings-section-panel settings-maintenance-section settings-reset-section" data-settings-panel="maintenance">
                  <div class="settings-maintenance-layout">
                    <div class="settings-card settings-maintenance-card settings-maintenance-card--diagnostics">
                      <div class="settings-maintenance-card-top">
                        <div class="settings-maintenance-card-main">
                          <span class="settings-maintenance-icon" data-fa="broom" aria-hidden="true"></span>
                          <span class="settings-maintenance-copy">
                            <span class="settings-maintenance-title" data-i18n="settings.diagnostics">Diagnostics</span>
                            <span class="settings-maintenance-description" data-i18n="settings.diagnosticsDescription">View application logs and diagnostics.</span>
                          </span>
                        </div>
                        <button id="open-logs-folder" type="button" class="settings-action settings-maintenance-button">
                          <span class="settings-button-icon" data-fa="screwdriver-wrench" aria-hidden="true"></span>
                          <span class="settings-button-label" data-i18n="settings.openLogsFolder">Open Logs Folder</span>
                        </button>
                      </div>
                      <div class="settings-maintenance-inset">
                        <span class="settings-maintenance-inset-title" data-i18n="settings.logFiles">Log files</span>
                        <span class="settings-maintenance-inset-text" data-i18n="settings.logFilesDescription">Logs can help troubleshoot issues with devices, updates, plugins, and app startup.</span>
                      </div>
                    </div>

                    <div class="settings-card settings-maintenance-card settings-maintenance-card--privacy">
                      <div class="settings-maintenance-card-top">
                        <div class="settings-maintenance-card-main">
                          <span class="settings-maintenance-icon" data-fa="screwdriver-wrench" aria-hidden="true"></span>
                          <span class="settings-maintenance-copy">
                            <span class="settings-maintenance-title" data-i18n="settings.midiDeviceInventory">MIDI Device Inventory</span>
                            <span class="settings-maintenance-description" data-i18n="settings.midiDeviceInventoryDescription">When enabled, shares app version, privacy notice version, MIDI input/output names, local MIDI port IDs, selected routes, and counts.</span>
                          </span>
                        </div>
                        <label class="settings-maintenance-toggle-control" title="Share MIDI device inventory" data-i18n-title="settings.midiDeviceInventoryToggle">
                          <span class="settings-maintenance-toggle-copy">
                            <span class="settings-maintenance-toggle-label" data-i18n="settings.midiDeviceInventoryToggle">Share inventory</span>
                          </span>
                          <span class="settings-toggle">
                            <input id="midi-device-inventory-consent-toggle" type="checkbox" />
                            <span class="plugins-toggle-ui" aria-hidden="true"></span>
                          </span>
                        </label>
                      </div>
                    </div>

                    <div class="settings-card settings-maintenance-card settings-maintenance-card--danger">
                      <div class="settings-maintenance-card-top">
                        <div class="settings-maintenance-card-main">
                          <span class="settings-maintenance-icon" data-fa="screwdriver-wrench" aria-hidden="true"></span>
                          <span class="settings-maintenance-copy">
                            <span class="settings-maintenance-title" data-i18n="settings.appData">App Data</span>
                            <span class="settings-maintenance-description" data-i18n="settings.appDataDescription">Resetting app data will restore all settings to their default values.</span>
                          </span>
                        </div>
                        <button id="reset-app-data" type="button" class="settings-reset settings-maintenance-button settings-maintenance-button--danger">
                          <span class="settings-button-icon" data-fa="broom" aria-hidden="true"></span>
                          <span class="settings-button-label" data-i18n="settings.resetAppData">Reset App Data</span>
                        </button>
                      </div>
                      <div class="settings-maintenance-inset settings-maintenance-inset--danger">
                        <span class="settings-maintenance-warning" data-i18n="settings.cannotUndo">This action cannot be undone.</span>
                        <span class="settings-maintenance-inset-text" data-i18n="settings.resetAppDataDescription">Profiles, bindings, device selections, and saved app settings will be restored to defaults.</span>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
          <button id="settings-panel-close" type="button" class="visually-hidden" aria-hidden="true" data-i18n="common.close">Close</button>
        </section>`;
