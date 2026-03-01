/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SettingValue = string | number | boolean;

export class SettingsEngine {
  private settings: Record<string, SettingValue> = {};

  constructor() {
    this.loadDefaults();
  }

  private loadDefaults() {
    this.settings = {
      'keypad_beep': true,
      'ringtone_idx': 0,
      'sms_tone_idx': 0,
      'vibrate_call': true,
      'vibrate_sms': true,
      'vibrate_keypad': false,
    };
  }

  public get(id: string): SettingValue {
    return this.settings[id];
  }

  public set(id: string, value: SettingValue) {
    this.settings[id] = value;
  }

  public reset() {
    this.loadDefaults();
  }
}
