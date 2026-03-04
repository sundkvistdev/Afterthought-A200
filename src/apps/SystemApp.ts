/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Frame, Notification } from '../system/types';
import { FrameBuilder } from '../system/FrameBuilder';
import { LAYOUT, FONTS, COLORS } from '../system/Theme';
import { TONES } from '../system/SoundEngine';

export const SystemApp: Record<string, Frame> = {
  IDLE: {
    id: 'IDLE',
    displayName: 'SAMSOFT',
    softKeys: { left: 'Menu', right: 'Names' },
    onEnter: (state, os) => {
      os.checkNotifications();
    },
    onKey: (key, os) => {
      if (key === 'SOFT_L') {
        os.pushFrame('MAIN_MENU');
        return true;
      }
      if (key === '1') {
        os.triggerSMS();
        return true;
      }
      if (!isNaN(Number(key))) {
        os.dialedNumber += key;
        return true;
      }
      if (key === 'SOFT_R') {
        if (os.dialedNumber) {
          os.dialedNumber = os.dialedNumber.slice(0, -1);
        } else {
          // Names menu would go here
        }
        return true;
      }
      return false;
    },
    render: (renderer, state, os) => {
      renderer.drawRect(0, LAYOUT.HEADER_HEIGHT, LAYOUT.SCREEN_WIDTH, LAYOUT.SCREEN_HEIGHT - LAYOUT.HEADER_HEIGHT - LAYOUT.FOOTER_HEIGHT, "#87ceeb");
      
      if (os.smsCountdown > 0) {
        const smsText = `SMS IN: ${os.smsCountdown}s`;
        const layout = renderer.computeTextLayout(smsText, LAYOUT.SCREEN_WIDTH - 40, FONTS.SIZE_SMALL, FONTS.SANS, 12, true);
        renderer.drawTextLayout(layout, 35, 120, COLORS.white, FONTS.SIZE_SMALL, FONTS.SANS, true);
      }
      
      if (os.dialedNumber) {
        renderer.drawRect(LAYOUT.PADDING_X, 30, LAYOUT.SCREEN_WIDTH - LAYOUT.PADDING_X * 2, 60, COLORS.white);
        const layout = renderer.computeTextLayout(os.dialedNumber, LAYOUT.SCREEN_WIDTH - LAYOUT.PADDING_X * 2 - 8, FONTS.SIZE_XLARGE, FONTS.SANS, 24, true);
        renderer.drawTextLayout(layout, LAYOUT.PADDING_X + 4, 50, COLORS.black, FONTS.SIZE_XLARGE, FONTS.SANS, true);
        os.frames.IDLE.softKeys = { left: 'Options', right: 'Clear' };
      } else {
        const brandLayout = renderer.computeTextLayout("Samsoft", 100, FONTS.SIZE_SMALL, FONTS.SANS, 12, true);
        renderer.drawTextLayout(brandLayout, 40, 40, "rgba(0,0,0,0.5)", FONTS.SIZE_SMALL, FONTS.SANS, true);
        
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const timeLayout = renderer.computeTextLayout(time, LAYOUT.SCREEN_WIDTH - 20, FONTS.SIZE_XXLARGE, FONTS.SANS, 32, true);
        renderer.drawTextLayout(timeLayout, 26, 75, COLORS.black, FONTS.SIZE_XXLARGE, FONTS.SANS, true);
        os.frames.IDLE.softKeys = { left: 'Menu', right: 'Names' };
      }
    }
  },

  NOTIFICATION: {
    id: 'NOTIFICATION',
    displayName: 'ALERT',
    softKeys: { left: '', right: '' },
    onEnter: (state, os) => {
      const note = state.data as Notification;
      os.currentNotification = note;
      os.frames.NOTIFICATION.softKeys = note.softKeys;
      if (note.type === 'call') {
        os.sound.playSequence(TONES.RINGTONES[os.settings.get('ringtone_idx') as number], true);
      } else if (note.type === 'error') {
        os.sound.error();
      } else {
        os.sound.playSequence(TONES.SMS_TONES[os.settings.get('sms_tone_idx') as number]);
      }

      if (note.timeout) {
        os.notificationTimeout = window.setTimeout(() => {
          os.popFrame();
        }, note.timeout);
      }
    },
    onLeave: (state, os) => {
      os.sound.stop();
      os.currentNotification = null;
      if (os.notificationTimeout) {
        clearTimeout(os.notificationTimeout);
        os.notificationTimeout = null;
      }
    },
    onKey: (key, os) => {
      if (!os.currentNotification) return false;
      if (key === 'SOFT_L') {
        os.currentNotification.onAction('left');
        os.popFrame();
        return true;
      }
      if (key === 'SOFT_R') {
        os.currentNotification.onAction('right');
        os.popFrame();
        return true;
      }
      return false;
    },
    render: (renderer, state, os) => {
      const note = state.data as Notification;
      if (!note) return;

      renderer.drawRect(LAYOUT.PADDING_X, 20, LAYOUT.SCREEN_WIDTH - LAYOUT.PADDING_X * 2, 120, COLORS.white);
      
      const icon = note.icon || (note.type === 'call' ? 'PHONE' : note.type === 'error' ? 'BUG' : note.type === 'message' ? 'ENVELOPE' : 'SETTINGS');
      renderer.drawIcon(icon, LAYOUT.PADDING_X + 4, 24, COLORS.active, 16);
      
      const headerLayout = renderer.computeTextLayout(note.header, LAYOUT.SCREEN_WIDTH - LAYOUT.PADDING_X * 2 - 28, FONTS.SIZE_NORMAL, FONTS.SANS, 14, true);
      renderer.drawTextLayout(headerLayout, LAYOUT.PADDING_X + 24, 24, COLORS.black, FONTS.SIZE_NORMAL, FONTS.SANS, true);
      
      const bodyLayout = renderer.computeTextLayout(note.body, LAYOUT.SCREEN_WIDTH - LAYOUT.PADDING_X * 2 - 8, FONTS.SIZE_SMALL, FONTS.SANS, 12, false);
      renderer.drawTextLayout(bodyLayout, LAYOUT.PADDING_X + 4, 45, COLORS.text, FONTS.SIZE_SMALL, FONTS.SANS, false);
    }
  },

  MAIN_MENU: FrameBuilder.createList('MAIN_MENU', 'MENU', ['Messages', 'Settings', 'Debug'], (idx, os) => {
    if (idx === 0) os.pushFrame('MSG_MENU');
    if (idx === 1) os.pushFrame('SET_MENU');
    if (idx === 2) os.pushFrame('DEBUG_MENU');
  }),

  SAVE_CONFIRM: {
    id: 'SAVE_CONFIRM',
    displayName: 'SAVE?',
    softKeys: { left: 'Select', right: 'Back' },
    onKey: (key, os) => {
      const state = os.getFrameState('SAVE_CONFIRM');
      const { onSave, onDiscard, onCancel } = state.data;
      if (key === 'UP') {
        state.selectedIndex = (state.selectedIndex - 1 + 3) % 3;
        return true;
      }
      if (key === 'DOWN') {
        state.selectedIndex = (state.selectedIndex + 1) % 3;
        return true;
      }
      if (key === 'SOFT_L') {
        os.popFrame(); // Pop SAVE_CONFIRM first
        if (state.selectedIndex === 0) {
          onSave();
        } else if (state.selectedIndex === 1) {
          onDiscard();
        } else {
          onCancel();
        }
        return true;
      }
      if (key === 'SOFT_R') {
        os.popFrame();
        return true;
      }
      return false;
    },
    render: (renderer, state, os) => {
      os.renderList(renderer, ['Save', 'Don\'t Save', 'Cancel'], state.selectedIndex);
    }
  },

  DEBUG_MENU: FrameBuilder.createList('DEBUG_MENU', 'DEBUG MODE', [
    '1 Urgent Alert', 
    '2 Trigger SMS', 
    '3 Reset Settings', 
    '4 Toggle Vibrate', 
    '5 Toggle Beep', 
    '6 Clear Inbox', 
    '7 Clear Outbox', 
    '8 Fill Inbox (5)', 
    '9 Fill Outbox (5)', 
    '10 System Info', 
    '11 Battery Low', 
    '12 Signal Lost', 
    '13 New Voicemail', 
    '14 Network Busy', 
    '15 SIM Error', 
    '16 Memory Full', 
    '17 Software Update', 
    '18 Factory Reset', 
    '19 Test Ring 1', 
    '20 Test Ring 2', 
    '21 Test SMS 1', 
    '22 Test SMS 2'
  ], (idx, os) => {
    const debugActions: (() => void)[] = [
      () => os.showNotification({
        id: 'urgent_' + Date.now(),
        header: 'SYSTEM ERROR',
        body: 'A critical system error has occurred. Please restart the device immediately.',
        softKeys: { left: 'Restart', right: 'Ignore' },
        type: 'error',
        priority: 'URGENT',
        timeout: 5000,
        onAction: (action: string) => {
          if (action === 'left') os.debugSystemReset();
        }
      }),
      () => os.triggerSMS(),
      () => { os.settings.reset(); os.popFrame(); },
      () => { os.settings.set('vibrate_call', !os.settings.get('vibrate_call')); os.popFrame(); },
      () => { os.settings.set('keypad_beep', !os.settings.get('keypad_beep')); os.popFrame(); },
      () => { os.clearInbox(); os.popFrame(); },
      () => { os.clearOutbox(); os.popFrame(); },
      () => { for(let i=0; i<5; i++) os.receiveMessage(); os.popFrame(); },
      () => { for(let i=0; i<5; i++) os.addSentMessage({ to: "Sent", text: "Debug message " + i, time: "Now", read: true }); os.popFrame(); },
      () => os.showNotification({ id: 'info', header: 'SYSTEM INFO', body: 'Samsoft Afterthought A200\nVer: 1.0.4-DEBUG\nRAM: 128KB', softKeys: { left: 'OK', right: 'Back' }, type: 'info', priority: 'NORMAL', timeout: 5000, onAction: () => {} }),
      () => os.showNotification({ id: 'batt', header: 'BATTERY LOW', body: 'Connect charger now.', softKeys: { left: 'OK', right: 'Dismiss' }, type: 'error', priority: 'HIGH', timeout: 5000, onAction: () => {} }),
      () => os.showNotification({ id: 'sig', header: 'NO SIGNAL', body: 'Searching for network...', softKeys: { left: 'OK', right: 'Retry' }, type: 'error', priority: 'HIGH', timeout: 5000, onAction: () => {} }),
      () => os.showNotification({ id: 'vm', header: 'VOICEMAIL', body: 'You have 1 new voicemail.', softKeys: { left: 'Listen', right: 'Later' }, type: 'info', priority: 'NORMAL', timeout: 5000, onAction: () => {} }),
      () => os.showNotification({ id: 'busy', header: 'NETWORK BUSY', body: 'Please try again later.', softKeys: { left: 'OK', right: 'Retry' }, type: 'error', priority: 'HIGH', timeout: 5000, onAction: () => {} }),
      () => os.showNotification({ id: 'sim', header: 'SIM ERROR', body: 'Invalid SIM card detected.', softKeys: { left: 'OK', right: 'Restart' }, type: 'error', priority: 'URGENT', timeout: 5000, onAction: () => {} }),
      () => os.showNotification({ id: 'mem', header: 'MEMORY FULL', body: 'Delete some messages.', softKeys: { left: 'OK', right: 'Manage' }, type: 'error', priority: 'NORMAL', timeout: 5000, onAction: () => {} }),
      () => os.showNotification({ id: 'upd', header: 'UPDATE', body: 'Software update available.', softKeys: { left: 'Install', right: 'Later' }, type: 'info', priority: 'NORMAL', timeout: 5000, onAction: () => {} }),
      () => os.showNotification({ id: 'fac', header: 'RESET', body: 'Delete all data?', softKeys: { left: 'Yes', right: 'No' }, type: 'error', priority: 'URGENT', timeout: 5000, onAction: (a: string) => { if(a==='left') os.debugSystemReset(); } }),
      () => os.sound.playSequence(TONES.RINGTONES[0]),
      () => os.sound.playSequence(TONES.RINGTONES[1]),
      () => os.sound.playSequence(TONES.SMS_TONES[0]),
      () => os.sound.playSequence(TONES.SMS_TONES[1]),
    ];
    if (debugActions[idx]) debugActions[idx]();
  })
};
