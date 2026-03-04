/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Frame } from '../system/types';
import { FrameBuilder } from '../system/FrameBuilder';
import { TONES } from '../system/SoundEngine';

export const SettingsApp: Record<string, Frame> = {
  SET_MENU: FrameBuilder.createList('SET_MENU', 'SETTINGS', ['Ringtone', 'SMS Tone', 'Vibrate', 'Keypad Beep'], (idx, os) => {
    if (idx === 0) os.pushFrame('TONE_SET');
    if (idx === 1) os.pushFrame('SMS_TONE_SET');
    if (idx === 2) os.pushFrame('VIBE_SET');
    if (idx === 3) os.pushFrame('BEEP_SET');
  }),

  BEEP_SET: FrameBuilder.createRadio('BEEP_SET', 'KEYPAD BEEP', ['Off', 'On'], (os) => (os.settings.get('keypad_beep') as boolean) ? 1 : 0, (idx, os) => {
    os.settings.set('keypad_beep', idx === 1);
    os.popFrame();
  }),

  TONE_SET: FrameBuilder.createRadio('TONE_SET', 'RINGTONE', ['Tone 1', 'Tone 2', 'Tone 3', 'Tone 4', 'Tone 5'], (os) => os.settings.get('ringtone_idx') as number, (idx, os) => {
    os.settings.set('ringtone_idx', idx);
    os.popFrame();
  }, (idx, os) => {
    os.sound.playSequence(TONES.RINGTONES[idx]);
  }),

  SMS_TONE_SET: FrameBuilder.createRadio('SMS_TONE_SET', 'SMS TONE', ['Tone 1', 'Tone 2', 'Tone 3', 'Tone 4', 'Tone 5'], (os) => os.settings.get('sms_tone_idx') as number, (idx, os) => {
    os.settings.set('sms_tone_idx', idx);
    os.popFrame();
  }, (idx, os) => {
    os.sound.playSequence(TONES.SMS_TONES[idx]);
  }),

  VIBE_SET: FrameBuilder.createCheck('VIBE_SET', 'VIBRATE', ['Incoming Call', 'New SMS', 'Keypad'], (os) => {
    const set = new Set<number>();
    if (os.settings.get('vibrate_call')) set.add(0);
    if (os.settings.get('vibrate_sms')) set.add(1);
    if (os.settings.get('vibrate_keypad')) set.add(2);
    return set;
  }, (indices, os) => {
    os.settings.set('vibrate_call', indices.has(0));
    os.settings.set('vibrate_sms', indices.has(1));
    os.settings.set('vibrate_keypad', indices.has(2));
    os.popFrame();
  })
};
