/* ============================================================
 * System Memory Guard — prefs.js
 * ============================================================
 * Preferences window using libadwaita (Adw) widgets, the
 * standard for GNOME 42+ extension settings.
 *
 * This file is loaded in a SEPARATE process (gnome-extensions-app
 * or gnome-shell-extension-prefs), NOT inside the shell itself.
 * Therefore we import Adw/Gtk and use ExtensionPreferences
 * instead of Extension.
 * ============================================================ */

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class MemoryGuardPreferences extends ExtensionPreferences {
    /**
     * fillPreferencesWindow — called by GNOME to populate the
     * preferences window with our settings UI.
     *
     * We create a single Adw.PreferencesPage containing two groups:
     *  1. Thresholds — RAM & Swap warning levels
     *  2. Timing    — polling interval & cool-down duration
     *
     * @param {Adw.PreferencesWindow} window
     */
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // --- Page ---
        const page = new Adw.PreferencesPage({
            title: 'Memory Guard',
            icon_name: 'dialog-warning-symbolic',
        });
        window.add(page);

        // =====================================================
        // GROUP 1 — Threshold Settings
        // =====================================================
        const thresholdGroup = new Adw.PreferencesGroup({
            title: 'Warning Thresholds',
            description: 'Set the percentage at which a warning dialog appears.',
        });
        page.add(thresholdGroup);

        // --- RAM Threshold (SpinRow) ---
        const ramRow = new Adw.SpinRow({
            title: 'RAM Threshold',
            subtitle: 'Show warning when RAM usage exceeds this %',
            adjustment: new Gtk.Adjustment({
                lower: 50,
                upper: 100,
                step_increment: 1,
                page_increment: 5,
                value: settings.get_int('ram-threshold'),
            }),
        });
        settings.bind('ram-threshold', ramRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        thresholdGroup.add(ramRow);

        // --- Swap Threshold (SpinRow) ---
        const swapRow = new Adw.SpinRow({
            title: 'Swap Threshold',
            subtitle: 'Show warning when Swap usage exceeds this %',
            adjustment: new Gtk.Adjustment({
                lower: 50,
                upper: 100,
                step_increment: 1,
                page_increment: 5,
                value: settings.get_int('swap-threshold'),
            }),
        });
        settings.bind('swap-threshold', swapRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        thresholdGroup.add(swapRow);

        // =====================================================
        // GROUP 2 — Timing Settings
        // =====================================================
        const timingGroup = new Adw.PreferencesGroup({
            title: 'Timing',
            description: 'Control how frequently the extension checks memory and the\ncool-down period after dismissing a warning.',
        });
        page.add(timingGroup);

        // --- Check Interval ---
        const intervalRow = new Adw.SpinRow({
            title: 'Check Interval',
            subtitle: 'Seconds between each memory check (1–30)',
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 30,
                step_increment: 1,
                page_increment: 5,
                value: settings.get_int('check-interval'),
            }),
        });
        settings.bind('check-interval', intervalRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        timingGroup.add(intervalRow);

        // --- Cool-down Time ---
        const cooldownRow = new Adw.SpinRow({
            title: 'Cool-down Time',
            subtitle: 'Seconds to wait before showing another warning (10–600)',
            adjustment: new Gtk.Adjustment({
                lower: 10,
                upper: 600,
                step_increment: 5,
                page_increment: 30,
                value: settings.get_int('cooldown-time'),
            }),
        });
        settings.bind('cooldown-time', cooldownRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        timingGroup.add(cooldownRow);

        // Set a reasonable default window size
        window.set_default_size(450, 500);
    }
}
