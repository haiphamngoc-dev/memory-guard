/* ============================================================
 * System Memory Guard — extension.js
 * ============================================================
 * GNOME 45+ ESM extension that periodically reads /proc/meminfo,
 * calculates combined (RAM + Swap) usage, and pops a blocking
 * ModalDialog when the combined usage exceeds the configured threshold.
 *
 * Key design points:
 *  • Uses GLib.file_get_contents to read /proc/meminfo (no
 *    external library needed).
 *  • Polling is driven by GLib.timeout_add_seconds and is
 *    deterministically removed on disable() to avoid leaks.
 *  • The ModalDialog grabs keyboard & pointer focus; the user
 *    MUST click "OK" to dismiss it.
 *  • A cool-down timer prevents dialog spam: once dismissed,
 *    no new dialog can appear for `cooldown-time` seconds even
 *    if memory is still above threshold.
 * ============================================================ */

import GLib from "gi://GLib";
import GObject from "gi://GObject";
import St from "gi://St";
import Clutter from "gi://Clutter";

// GNOME Shell internal modules (available only inside the shell process)
import * as ModalDialog from "resource:///org/gnome/shell/ui/modalDialog.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

/* ──────────────────────────────────────────────────────────────
 * MemoryWarningDialog
 * ──────────────────────────────────────────────────────────────
 * A modal dialog that shows RAM/Swap usage and forces the user
 * to acknowledge it before returning to the desktop.
 *
 * Inherits ModalDialog.ModalDialog which handles:
 *  - pushModal / popModal (focus grab)
 *  - fade-in / fade-out animations
 *  - light-box overlay behind the dialog
 * ────────────────────────────────────────────────────────────── */
const MemoryWarningDialog = GObject.registerClass(
  class MemoryWarningDialog extends ModalDialog.ModalDialog {
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
        styleClass: "memory-guard-dialog",
        destroyOnClose: true,
      });

      this._onClose = onClose;

      // --- Build the content layout (vertical box) ---
      const contentBox = new St.BoxLayout({
        vertical: true,
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
        style_class: "memory-guard-content",
      });

      // Warning icon
      const icon = new St.Icon({
        icon_name: "dialog-warning-symbolic",
        icon_size: 64,
        style_class: "memory-guard-icon",
      });
      contentBox.add_child(icon);

      // Title
      const title = new St.Label({
        text: "⚠ System Memory Warning",
        style_class: "memory-guard-title",
      });
      contentBox.add_child(title);

      // Build a human-readable detail message
      const lines = [
        `RAM usage:      ${ramPercent.toFixed(1)}%`,
        `Swap usage:     ${swapPercent.toFixed(1)}%`,
        `Combined usage: ${combinedPercent.toFixed(1)}%  (threshold: ${memoryThreshold}%)`,
      ];

      const body = new St.Label({
        text:
          "Memory consumption has exceeded the configured threshold.\n" +
          "Consider closing unused applications to free resources.",
        style_class: "memory-guard-body",
      });
      contentBox.add_child(body);

      const percentLabel = new St.Label({
        text: lines.join("\n"),
        style_class: "memory-guard-percent",
      });
      contentBox.add_child(percentLabel);

      this.contentLayout.add_child(contentBox);

      // --- "OK" button — the ONLY way to dismiss ---
      this.addButton({
        label: "OK",
        action: () => this._dismiss(),
        default: true,
      });
    }

    /**
     * _dismiss — close the dialog and notify the extension so it can
     * start the cool-down timer.
     */
    _dismiss() {
      this.close(); // popModal + fade-out
      this._onClose?.(); // trigger cool-down in the extension
    }
  },
);

/* ──────────────────────────────────────────────────────────────
 * MemoryGuardIndicator
 * ──────────────────────────────────────────────────────────────
 * A panel button that displays combined memory usage on the top
 * bar and provides a dropdown menu with detailed stats and a
 * quick-access "Preferences" entry.
 *
 * Color states:
 *  - default: combined < 70%
 *  - warning (yellow): combined >= 70%
 *  - critical (red): combined >= threshold
 * ────────────────────────────────────────────────────────────── */
const MemoryGuardIndicator = GObject.registerClass(
  class MemoryGuardIndicator extends PanelMenu.Button {
    /**
     * @param {Extension} extensionObject - the parent Extension instance,
     *   used to call openPreferences().
     */
    _init(extensionObject) {
      super._init(0.0, "Memory Guard");
      this._extensionObject = extensionObject;

      // --- Panel button layout: icon + label ---
      const box = new St.BoxLayout({
        style_class: "panel-status-indicators-box",
      });

      this._icon = new St.Icon({
        icon_name: "dialog-warning-symbolic",
        icon_size: 16,
        style_class: "system-status-icon memory-guard-indicator-icon",
      });

      this._label = new St.Label({
        text: "—%",
        y_align: Clutter.ActorAlign.CENTER,
        style_class: "memory-guard-indicator-label",
      });

      box.add_child(this._icon);
      box.add_child(this._label);
      this.add_child(box);

      // --- Dropdown menu: read-only stats ---
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

      // --- Separator ---
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      // --- Preferences button ---
      const prefsItem = new PopupMenu.PopupMenuItem("⚙ Preferences");
      prefsItem.connect("activate", () => {
        this._extensionObject.openPreferences();
      });
      this.menu.addMenuItem(prefsItem);
    }

    /**
     * updateDisplay — refreshes the panel label, menu items, and
     * icon/label color based on current memory usage.
     *
     * @param {number} ramPercent
     * @param {number} swapPercent
     * @param {number} combinedPercent
     * @param {number} threshold - the configured memory-threshold
     */
    updateDisplay(ramPercent, swapPercent, combinedPercent, threshold) {
      // Update panel label
      this._label.text = `${Math.round(combinedPercent)}%`;

      // Update menu items
      this._ramItem.label.text = `RAM:      ${ramPercent.toFixed(1)}%`;
      this._swapItem.label.text = `Swap:     ${swapPercent.toFixed(1)}%`;
      this._combinedItem.label.text = `Combined: ${combinedPercent.toFixed(1)}%`;

      // --- Color coding ---
      // Remove previous state classes
      this._icon.remove_style_class_name("memory-guard-warning");
      this._icon.remove_style_class_name("memory-guard-critical");
      this._label.remove_style_class_name("memory-guard-warning");
      this._label.remove_style_class_name("memory-guard-critical");

      if (combinedPercent >= threshold) {
        this._icon.add_style_class_name("memory-guard-critical");
        this._label.add_style_class_name("memory-guard-critical");
      } else if (combinedPercent >= 70) {
        this._icon.add_style_class_name("memory-guard-warning");
        this._label.add_style_class_name("memory-guard-warning");
      }
    }
  },
);

/* ──────────────────────────────────────────────────────────────
 * MemoryGuardExtension
 * ──────────────────────────────────────────────────────────────
 * Main extension class.  Lifecycle:
 *  enable()  → starts the polling loop + panel indicator
 *  disable() → stops the loop + cleans up all resources
 * ────────────────────────────────────────────────────────────── */
export default class MemoryGuardExtension extends Extension {
  /* ---------------------------------------------------------
   * enable() — called by GNOME Shell when the extension is
   * turned on (or at login if it was previously enabled).
   * --------------------------------------------------------- */
  enable() {
    // Load user preferences (GSettings)
    this._settings = this.getSettings();

    // State flags for dialog management
    this._dialogOpen = false; // true while the modal is on-screen
    this._coolingDown = false; // true during the post-dismiss cool-down
    this._cooldownSourceId = 0; // GLib source id for cool-down timer
    this._loopSourceId = 0; // GLib source id for the main poll loop

    // Panel indicator (created only if the setting is on)
    this._indicator = null;
    if (this._settings.get_boolean("show-indicator")) {
      this._createIndicator();
    }

    // React to runtime changes of the show-indicator setting
    this._showIndicatorChangedId = this._settings.connect(
      "changed::show-indicator",
      () => {
        if (this._settings.get_boolean("show-indicator")) {
          this._createIndicator();
        } else {
          this._destroyIndicator();
        }
      },
    );

    // Start the periodic memory check
    this._startLoop();
  }

  /* ---------------------------------------------------------
   * disable() — called when the extension is turned off, when
   * the screen locks (GNOME 42+), or when the shell restarts.
   *
   * We MUST remove every GLib source and drop every reference
   * to avoid memory leaks or orphaned timers.
   * --------------------------------------------------------- */
  disable() {
    this._stopLoop();
    this._clearCooldown();

    // Disconnect settings signal
    if (this._showIndicatorChangedId) {
      this._settings.disconnect(this._showIndicatorChangedId);
      this._showIndicatorChangedId = 0;
    }

    // Remove panel indicator
    this._destroyIndicator();

    // If a dialog is still open, close it gracefully
    if (this._dialog) {
      this._dialog.close();
      this._dialog = null;
    }

    this._settings = null;
  }

  /* =========================================================
   * POLLING LOOP
   * ========================================================= */

  /**
   * _startLoop — registers a repeating GLib timeout that fires
   * every `check-interval` seconds.
   */
  _startLoop() {
    // Read interval from settings (default 3 s)
    const interval = this._settings.get_int("check-interval");

    // Run one check immediately at startup
    this._checkMemory();

    // Then schedule subsequent checks
    this._loopSourceId = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      interval,
      () => {
        this._checkMemory();
        return GLib.SOURCE_CONTINUE; // keep the timer alive
      },
    );
  }

  /**
   * _stopLoop — removes the polling timer.  Safe to call even
   * if the timer was never started or was already removed.
   */
  _stopLoop() {
    if (this._loopSourceId) {
      GLib.source_remove(this._loopSourceId);
      this._loopSourceId = 0;
    }
  }

  /* =========================================================
   * PANEL INDICATOR
   * ========================================================= */

  /**
   * _createIndicator — adds the MemoryGuardIndicator to the
   * right side of the GNOME Shell top panel.
   */
  _createIndicator() {
    if (this._indicator) return;
    this._indicator = new MemoryGuardIndicator(this);
    Main.panel.addToStatusArea("memory-guard", this._indicator);
  }

  /**
   * _destroyIndicator — removes and destroys the panel indicator.
   * Safe to call even if the indicator was never created.
   */
  _destroyIndicator() {
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }
  }

  /* =========================================================
   * COOL-DOWN MANAGEMENT
   * ========================================================= */

  /**
   * _startCooldown — prevents a new dialog from appearing for
   * `cooldown-time` seconds after the user dismisses one.
   */
  _startCooldown() {
    this._coolingDown = true;
    const cooldown = this._settings?.get_int("cooldown-time") ?? 60;

    this._cooldownSourceId = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      cooldown,
      () => {
        this._coolingDown = false;
        this._cooldownSourceId = 0;
        return GLib.SOURCE_REMOVE; // one-shot
      },
    );
  }

  /**
   * _clearCooldown — cancels the cool-down timer (e.g. on disable).
   */
  _clearCooldown() {
    if (this._cooldownSourceId) {
      GLib.source_remove(this._cooldownSourceId);
      this._cooldownSourceId = 0;
    }
    this._coolingDown = false;
  }

  /* =========================================================
   * MEMORY READING
   * ========================================================= */

  /**
   * _readMeminfo — reads /proc/meminfo and returns an object
   * with numeric values (in kB) for the keys we care about.
   *
   * Relevant lines in /proc/meminfo:
   *   MemTotal:       16384000 kB
   *   MemAvailable:    4096000 kB
   *   SwapTotal:       8192000 kB
   *   SwapFree:        1024000 kB
   *
   * @returns {{ memTotal: number, memAvailable: number,
   *             swapTotal: number, swapFree: number } | null}
   */
  _readMeminfo() {
    try {
      const [ok, contents] = GLib.file_get_contents("/proc/meminfo");
      if (!ok) return null;

      // GLib.file_get_contents returns a Uint8Array in GJS;
      // decode it to a UTF-8 string.
      const text = new TextDecoder().decode(contents);

      // Parse only the fields we need into a map
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
        // Early exit once we have everything
        if (Object.keys(data).length === needed.size) break;
      }

      return {
        memTotal: data.MemTotal ?? 0,
        memAvailable: data.MemAvailable ?? 0,
        swapTotal: data.SwapTotal ?? 0,
        swapFree: data.SwapFree ?? 0,
      };
    } catch (e) {
      logError(e, "MemoryGuard: failed to read /proc/meminfo");
      return null;
    }
  }

  /* =========================================================
   * CHECK + TRIGGER
   * ========================================================= */

  /**
   * _checkMemory — core logic.
   *
   * 1. Reads /proc/meminfo.
   * 2. Computes RAM used% and Swap used%.
   * 3. Compares combined usage against threshold from GSettings.
   * 4. If exceeded AND no dialog is open AND cool-down has
   *    expired → show the modal warning.
   */
  _checkMemory() {
    const info = this._readMeminfo();
    if (!info) return;

    // --- Calculate usage percentages ---
    // RAM used = Total − Available (MemAvailable accounts for
    // buffers/cache, giving a realistic "used" figure).
    const ramUsed = info.memTotal - info.memAvailable;
    const ramPercent = info.memTotal > 0 ? (ramUsed / info.memTotal) * 100 : 0;

    // Swap used = Total − Free
    const swapUsed = info.swapTotal - info.swapFree;
    const swapPercent =
      info.swapTotal > 0 ? (swapUsed / info.swapTotal) * 100 : 0;

    // --- Combined (RAM + Swap) usage ---
    const totalMemory = info.memTotal + info.swapTotal;
    const totalUsed = ramUsed + swapUsed;
    const combinedPercent =
      totalMemory > 0 ? (totalUsed / totalMemory) * 100 : 0;

    // --- Compare against threshold ---
    const memoryThreshold = this._settings.get_int("memory-threshold");

    // Always update the panel indicator (even during cool-down
    // or while the dialog is open) so the user sees live stats.
    this._indicator?.updateDisplay(
      ramPercent,
      swapPercent,
      combinedPercent,
      memoryThreshold,
    );

    // Guard: don't show a new dialog if one is already visible
    // or if the cool-down window hasn't expired yet.
    if (this._dialogOpen || this._coolingDown) return;

    if (combinedPercent >= memoryThreshold) {
      this._showWarningDialog(
        ramPercent,
        swapPercent,
        combinedPercent,
        memoryThreshold,
      );
    }
  }

  /* =========================================================
   * MODAL DIALOG
   * ========================================================= */

  /**
   * _showWarningDialog — creates and opens the MemoryWarningDialog.
   *
   * The dialog is modal (pushModal): it grabs all input so the
   * user cannot interact with anything else until they press OK.
   *
   * @param {number} ramPercent      - current RAM usage %
   * @param {number} swapPercent     - current Swap usage %
   * @param {number} combinedPercent - current combined (RAM+Swap) usage %
   * @param {number} memoryThreshold - configured memory threshold
   */
  _showWarningDialog(
    ramPercent,
    swapPercent,
    combinedPercent,
    memoryThreshold,
  ) {
    this._dialogOpen = true;

    this._dialog = new MemoryWarningDialog({
      ramPercent,
      swapPercent,
      combinedPercent,
      memoryThreshold,
      onClose: () => {
        // Called when the user presses OK
        this._dialogOpen = false;
        this._dialog = null;
        this._startCooldown();
      },
    });

    // open() calls pushModal internally, which grabs focus
    this._dialog.open();
  }
}
