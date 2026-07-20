/* ============================================================
 * Resource Guard — extension.js
 * ============================================================
 * GNOME 45+ ESM extension that periodically reads /proc/meminfo
 * and /proc/stat, calculates CPU and Memory usage, and pops a blocking
 * ModalDialog when the combined memory usage exceeds the configured threshold.
 *
 * Key design points:
 *  • Calculates CPU usage percentages dynamically via tick delta.
 *  • Displays CPU and Memory indicators side-by-side on the panel.
 *  • The warning dialog is triggered exclusively by Memory thresholds.
 *  • Clean resource disposal on disable().
 * ============================================================ */

import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Gio from "gi://Gio";
import St from "gi://St";
import Clutter from "gi://Clutter";

// GNOME Shell internal modules
import * as ModalDialog from "resource:///org/gnome/shell/ui/modalDialog.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

// Promisify Gio.File.prototype.load_contents_async for async file reads
Gio._promisify(
  Gio.File.prototype,
  "load_contents_async",
  "load_contents_finish",
);

/* ──────────────────────────────────────────────────────────────
 * ResourceWarningDialog
 * ──────────────────────────────────────────────────────────────
 * A modal warning dialog that presents RAM/Swap usage details.
 * ────────────────────────────────────────────────────────────── */
const ResourceWarningDialog = GObject.registerClass(
  class ResourceWarningDialog extends ModalDialog.ModalDialog {
    /**
     * @param {object}   params
     * @param {number}   params.ramPercent      - Current RAM usage (0-100)
     * @param {number}   params.swapPercent     - Current Swap usage (0-100)
     * @param {number}   params.combinedPercent - Combined (RAM+Swap) usage (0-100)
     * @param {number}   params.memoryThreshold - Configured memory threshold
     * @param {function} params.onClose         - Callback invoked when user
     *                                            dismisses the dialog
     */
    constructor({
      ramPercent,
      swapPercent,
      combinedPercent,
      memoryThreshold,
      onClose,
    }) {
      super({
        styleClass: "resource-guard-dialog",
        destroyOnClose: true,
      });

      this._onClose = onClose;

      // Build content layout (vertical box)
      const contentBox = new St.BoxLayout({
        vertical: true,
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
        style_class: "resource-guard-content",
      });

      // Warning icon
      const icon = new St.Icon({
        icon_name: "dialog-warning-symbolic",
        icon_size: 64,
        style_class: "resource-guard-icon",
      });
      contentBox.add_child(icon);

      // Title
      const title = new St.Label({
        text: "⚠ System Memory Warning",
        style_class: "resource-guard-title",
      });
      contentBox.add_child(title);

      const body = new St.Label({
        text:
          "Memory consumption has exceeded the configured threshold.\n" +
          "Consider closing unused applications to free resources.",
        style_class: "resource-guard-body",
      });
      contentBox.add_child(body);

      const lines = [
        `RAM usage:      ${ramPercent.toFixed(1)}%`,
        `Swap usage:     ${swapPercent.toFixed(1)}%`,
        `Combined usage: ${combinedPercent.toFixed(1)}%  (threshold: ${memoryThreshold}%)`,
      ];

      const percentLabel = new St.Label({
        text: lines.join("\n"),
        style_class: "resource-guard-percent",
      });
      contentBox.add_child(percentLabel);

      this.contentLayout.add_child(contentBox);

      // OK button to dismiss
      this.addButton({
        label: "OK",
        action: () => this._dismiss(),
        default: true,
      });
    }

    _dismiss() {
      this.close();
      this._onClose?.();
    }
  },
);

/* ──────────────────────────────────────────────────────────────
 * ResourceGuardIndicator
 * ──────────────────────────────────────────────────────────────
 * A panel button displaying CPU and Memory indicators side-by-side.
 * ────────────────────────────────────────────────────────────── */
const ResourceGuardIndicator = GObject.registerClass(
  class ResourceGuardIndicator extends PanelMenu.Button {
    /**
     * @param {Extension} extensionObject - Parent extension instance
     */
    _init(extensionObject) {
      super._init(0.0, "Resource Guard");
      this._extensionObject = extensionObject;

      // Outer layout container
      const box = new St.BoxLayout({
        style_class: "panel-status-indicators-box",
      });

      // --- CPU Sub-box ---
      this._cpuBox = new St.BoxLayout({
        style_class: "resource-guard-cpu-box",
      });
      this._cpuIcon = new St.Icon({
        icon_name: "system-run-symbolic",
        icon_size: 16,
        style_class: "system-status-icon resource-guard-indicator-icon",
      });
      this._cpuLabel = new St.Label({
        text: "—%",
        y_align: Clutter.ActorAlign.CENTER,
        style_class: "resource-guard-indicator-label",
      });
      this._cpuBox.add_child(this._cpuIcon);
      this._cpuBox.add_child(this._cpuLabel);
      box.add_child(this._cpuBox);

      // --- Memory Sub-box ---
      this._memBox = new St.BoxLayout({
        style_class: "resource-guard-mem-box",
      });
      this._memIcon = new St.Icon({
        icon_name: "dialog-warning-symbolic",
        icon_size: 16,
        style_class: "system-status-icon resource-guard-indicator-icon",
      });
      this._memLabel = new St.Label({
        text: "—%",
        y_align: Clutter.ActorAlign.CENTER,
        style_class: "resource-guard-indicator-label",
      });
      this._memBox.add_child(this._memIcon);
      this._memBox.add_child(this._memLabel);
      box.add_child(this._memBox);

      this.add_child(box);

      // --- Dropdown Menu Items ---
      this._cpuItem = new PopupMenu.PopupMenuItem("CPU: —%", {
        reactive: false,
      });
      this.menu.addMenuItem(this._cpuItem);

      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      this._ramItem = new PopupMenu.PopupMenuItem("RAM: —%", {
        reactive: false,
      });
      this._swapItem = new PopupMenu.PopupMenuItem("Swap: —%", {
        reactive: false,
      });
      this._combinedItem = new PopupMenu.PopupMenuItem("Combined: —%", {
        reactive: false,
      });

      this.menu.addMenuItem(this._ramItem);
      this.menu.addMenuItem(this._swapItem);
      this.menu.addMenuItem(this._combinedItem);

      // Separator
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      // Preferences button
      const prefsItem = new PopupMenu.PopupMenuItem("⚙ Preferences");
      prefsItem.connect("activate", () => {
        this._extensionObject.openPreferences();
      });
      this.menu.addMenuItem(prefsItem);

      // Apply initial GSettings visibility
      this.updateVisibility();
    }

    /**
     * updateVisibility — shows/hides CPU/Memory indicators dynamically based on GSettings.
     */
    updateVisibility() {
      const showCpu = this._extensionObject._settings.get_boolean("show-cpu");
      const showMem = this._extensionObject._settings.get_boolean("show-memory");

      this._cpuBox.visible = showCpu;
      this._memBox.visible = showMem;
      this.visible = showCpu || showMem;
    }

    /**
     * updateDisplay — refreshes UI content and colors based on usage statistics.
     */
    updateDisplay(cpuPercent, ramPercent, swapPercent, combinedPercent, threshold) {
      // 1. Update CPU Indicator
      this._cpuLabel.text = `${Math.round(cpuPercent)}%`;
      this._cpuItem.label.text = `CPU:      ${cpuPercent.toFixed(1)}%`;

      this._cpuIcon.remove_style_class_name("resource-guard-warning");
      this._cpuIcon.remove_style_class_name("resource-guard-critical");
      this._cpuLabel.remove_style_class_name("resource-guard-warning");
      this._cpuLabel.remove_style_class_name("resource-guard-critical");

      const CRITICAL_LOAD_THRESHOLD = 90;
      const WARNING_LOAD_THRESHOLD = 70;

      if (cpuPercent >= CRITICAL_LOAD_THRESHOLD) {
        this._cpuIcon.add_style_class_name("resource-guard-critical");
        this._cpuLabel.add_style_class_name("resource-guard-critical");
      } else if (cpuPercent >= WARNING_LOAD_THRESHOLD) {
        this._cpuIcon.add_style_class_name("resource-guard-warning");
        this._cpuLabel.add_style_class_name("resource-guard-warning");
      }

      // 2. Update Memory Indicator
      this._memLabel.text = `${Math.round(combinedPercent)}%`;
      this._ramItem.label.text = `RAM:      ${ramPercent.toFixed(1)}%`;
      this._swapItem.label.text = `Swap:     ${swapPercent.toFixed(1)}%`;
      this._combinedItem.label.text = `Combined: ${combinedPercent.toFixed(1)}%`;

      this._memIcon.remove_style_class_name("resource-guard-warning");
      this._memIcon.remove_style_class_name("resource-guard-critical");
      this._memLabel.remove_style_class_name("resource-guard-warning");
      this._memLabel.remove_style_class_name("resource-guard-critical");

      if (combinedPercent >= threshold) {
        this._memIcon.add_style_class_name("resource-guard-critical");
        this._memLabel.add_style_class_name("resource-guard-critical");
      } else if (combinedPercent >= WARNING_LOAD_THRESHOLD) {
        this._memIcon.add_style_class_name("resource-guard-warning");
        this._memLabel.add_style_class_name("resource-guard-warning");
      }
    }
  },
);

/* ──────────────────────────────────────────────────────────────
 * ResourceGuardExtension
 * ──────────────────────────────────────────────────────────────
 * Main extension controller.
 * ────────────────────────────────────────────────────────────── */
export default class ResourceGuardExtension extends Extension {
  enable() {
    this._settings = this.getSettings();

    // Track execution states & source IDs
    this._dialogOpen = false;
    this._coolingDown = false;
    this._checking = false;
    this._cooldownSourceId = 0;
    this._loopSourceId = 0;

    // CPU tick history
    this._lastCpuSample = null;

    // Create panel indicator if at least one display setting is active
    this._indicator = null;
    if (this._settings.get_boolean("show-cpu") || this._settings.get_boolean("show-memory")) {
      this._createIndicator();
    }

    // Connect visibility changes
    this._showCpuChangedId = this._settings.connect(
      "changed::show-cpu",
      () => this._onSettingsChanged()
    );
    this._showMemoryChangedId = this._settings.connect(
      "changed::show-memory",
      () => this._onSettingsChanged()
    );

    // Start checking loop
    this._startLoop();
  }

  disable() {
    this._stopLoop();
    this._clearCooldown();

    // Settings signals cleanup
    if (this._showCpuChangedId) {
      this._settings.disconnect(this._showCpuChangedId);
      this._showCpuChangedId = 0;
    }
    if (this._showMemoryChangedId) {
      this._settings.disconnect(this._showMemoryChangedId);
      this._showMemoryChangedId = 0;
    }

    this._destroyIndicator();

    if (this._dialog) {
      this._dialog.close();
      this._dialog = null;
    }

    this._settings = null;
    this._lastCpuSample = null;
  }

  _onSettingsChanged() {
    const showCpu = this._settings.get_boolean("show-cpu");
    const showMem = this._settings.get_boolean("show-memory");

    if (showCpu || showMem) {
      if (!this._indicator) {
        this._createIndicator();
      } else {
        this._indicator.updateVisibility();
      }
    } else {
      this._destroyIndicator();
    }
  }

  _startLoop() {
    const interval = this._settings.get_int("check-interval");
    this._checkResources();

    this._loopSourceId = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      interval,
      () => {
        this._checkResources();
        return GLib.SOURCE_CONTINUE;
      },
    );
  }

  _stopLoop() {
    if (this._loopSourceId) {
      GLib.source_remove(this._loopSourceId);
      this._loopSourceId = 0;
    }
  }

  _createIndicator() {
    if (this._indicator) return;
    this._indicator = new ResourceGuardIndicator(this);
    Main.panel.addToStatusArea("resource-guard", this._indicator);
  }

  _destroyIndicator() {
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }
  }

  _startCooldown() {
    this._coolingDown = true;
    const cooldown = this._settings?.get_int("cooldown-time") ?? 60;

    this._cooldownSourceId = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      cooldown,
      () => {
        this._coolingDown = false;
        this._cooldownSourceId = 0;
        return GLib.SOURCE_REMOVE;
      },
    );
  }

  _clearCooldown() {
    if (this._cooldownSourceId) {
      GLib.source_remove(this._cooldownSourceId);
      this._cooldownSourceId = 0;
    }
    this._coolingDown = false;
  }

  /**
   * _readCpuTicks — asynchronously reads /proc/stat and returns aggregated CPU ticks.
   *
   * @returns {Promise<{ idle: number, total: number } | null>}
   */
  async _readCpuTicks() {
    try {
      const file = Gio.File.new_for_path("/proc/stat");
      const [contents] = await file.load_contents_async(null);
      if (!contents) return null;

      const text = new TextDecoder().decode(contents);
      const lines = text.split("\n");
      const entry = lines[0]?.trim().split(/\s+/) || [];
      if (entry.length < 5 || entry[0] !== "cpu") {
        return null;
      }

      // Aggregate Idle + IOWait ticks
      const idle = Number.parseInt(entry[4], 10) + (Number.parseInt(entry[5], 10) || 0);

      let total = 0;
      for (let i = 1; i < entry.length; i++) {
        const val = Number.parseInt(entry[i], 10);
        if (!Number.isNaN(val)) {
          total += val;
        }
      }

      return { idle, total };
    } catch (e) {
      logError(e, "ResourceGuard: failed to read /proc/stat");
      return null;
    }
  }

  /**
   * _readMeminfo — asynchronously reads /proc/meminfo and returns active metrics in kB.
   *
   * @returns {Promise<{ memTotal: number, memAvailable: number,
   *             swapTotal: number, swapFree: number } | null>}
   */
  async _readMeminfo() {
    try {
      const file = Gio.File.new_for_path("/proc/meminfo");
      const [contents] = await file.load_contents_async(null);
      if (!contents) return null;

      const text = new TextDecoder().decode(contents);
      const data = {};
      const needed = new Set([
        "MemTotal",
        "MemAvailable",
        "SwapTotal",
        "SwapFree",
      ]);

      for (const line of text.split("\n")) {
        const match = /^(\w+):\s+(\d+)/.exec(line);
        if (match && needed.has(match[1])) {
          data[match[1]] = Number.parseInt(match[2], 10);
        }
        if (Object.keys(data).length === needed.size) break;
      }

      return {
        memTotal: data.MemTotal ?? 0,
        memAvailable: data.MemAvailable ?? 0,
        swapTotal: data.SwapTotal ?? 0,
        swapFree: data.SwapFree ?? 0,
      };
    } catch (e) {
      logError(e, "ResourceGuard: failed to read /proc/meminfo");
      return null;
    }
  }

  /**
   * _checkResources — samples stats, triggers displays and checks warnings.
   */
  async _checkResources() {
    if (this._checking) return;
    this._checking = true;

    try {
      const [info, cpuTicks] = await Promise.all([
        this._readMeminfo(),
        this._readCpuTicks(),
      ]);

      if (!info) return;

      // 1. Calculate Memory Usages
      const ramUsed = info.memTotal - info.memAvailable;
      const ramPercent = info.memTotal > 0 ? (ramUsed / info.memTotal) * 100 : 0;

      const swapUsed = info.swapTotal - info.swapFree;
      const swapPercent = info.swapTotal > 0 ? (swapUsed / info.swapTotal) * 100 : 0;

      const totalMemory = info.memTotal + info.swapTotal;
      const totalUsed = ramUsed + swapUsed;
      const combinedPercent = totalMemory > 0 ? (totalUsed / totalMemory) * 100 : 0;

      // 2. Calculate CPU Usages
      let cpuPercent = 0;
      if (cpuTicks) {
        if (this._lastCpuSample) {
          const deltaTotal = cpuTicks.total - this._lastCpuSample.total;
          const deltaIdle = cpuTicks.idle - this._lastCpuSample.idle;
          if (deltaTotal > 0) {
            cpuPercent = (100 * Math.max(0, deltaTotal - Math.max(0, deltaIdle))) / deltaTotal;
          }
        }
        this._lastCpuSample = cpuTicks;
      }

      const memoryThreshold = this._settings.get_int("memory-threshold");

      // Update Panel
      this._indicator?.updateDisplay(
        cpuPercent,
        ramPercent,
        swapPercent,
        combinedPercent,
        memoryThreshold,
      );

      // Warning check
      if (this._dialogOpen || this._coolingDown) return;

      if (combinedPercent >= memoryThreshold) {
        this._showWarningDialog(
          ramPercent,
          swapPercent,
          combinedPercent,
          memoryThreshold,
        );
      }
    } finally {
      this._checking = false;
    }
  }

  _showWarningDialog(
    ramPercent,
    swapPercent,
    combinedPercent,
    memoryThreshold,
  ) {
    this._dialogOpen = true;

    this._dialog = new ResourceWarningDialog({
      ramPercent,
      swapPercent,
      combinedPercent,
      memoryThreshold,
      onClose: () => {
        this._dialogOpen = false;
        this._dialog = null;
        this._startCooldown();
      },
    });

    this._dialog.open();
  }
}
