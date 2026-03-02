/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputManager, KeyCode } from './InputManager';
import { Renderer, COLORS } from './Renderer';
import { LAYOUT, FONTS } from './Theme';
import { TextLayout } from './TextEngine';
import { SoundEngine, TONES } from './SoundEngine';
import { SVG_ICONS } from './IconManager';
import { SettingsEngine } from './SettingsEngine';

export type PowerState = 'OFF' | 'BOOTING' | 'ON';

export interface Message {
  from?: string;
  to?: string;
  text: string;
  time: string;
  read: boolean;
}

export interface SoftKeys {
  left: string;
  right: string;
}

export interface Notification {
  id: string;
  icon: keyof typeof SVG_ICONS;
  header: string;
  body: string;
  softKeys: SoftKeys;
  onAction: (action: 'left' | 'right') => void;
  type: 'info' | 'error' | 'call';
  timeout?: number;
}

export interface Frame {
  id: string;
  displayName: string;
  softKeys: SoftKeys;
  onKey?: (key: KeyCode) => boolean; // Return true if handled
  render: (renderer: Renderer, state: FrameState) => void;
  onEnter?: (state: FrameState) => void;
  onLeave?: (state: FrameState) => void;
}

export interface FrameState {
  selectedIndex: number;
  scrollY: number;
  scrollX: number;
  data?: any;
  checkedIndices?: Set<number>;
}

export class OS {
  private powerState: PowerState = 'OFF';
  private bootProgress = 0;
  private endKeyStartTime: number | null = null;
  private bootLogo: HTMLImageElement | null = null;
  
  private navigationStack: string[] = ['IDLE'];
  private frameStates: Record<string, FrameState> = {};
  private frames: Record<string, Frame> = {};

  private unreadMessages = 0;
  private inbox: Message[] = [
    { from: 'SAMSOFT', text: 'Thank you for purchasing our Afterthought A200 mobile device.', time: '10:45 AM', read: true }
  ];
  private outbox: Message[] = [];
  private dialedNumber = "";
  private currentComposerText = "";
  private smsCountdown = 0;
  private lastSmsTick = 0;

  private sound: SoundEngine;
  private settings: SettingsEngine;

  private notificationQueue: Notification[] = [];
  private currentNotification: Notification | null = null;
  private notificationTimeout: number | null = null;

  constructor(private input: InputManager, private renderer: Renderer) {
    this.sound = new SoundEngine();
    this.settings = new SettingsEngine();
    this.loadLogo();
    this.initFrames();
  }

  private initFrames() {
    this.frames = {
      IDLE: {
        id: 'IDLE',
        displayName: 'SAMSOFT',
        softKeys: { left: 'Menu', right: 'Names' },
        onEnter: () => {
          this.checkNotifications();
        },
        onKey: (key) => {
          if (key === 'SOFT_L') {
            this.pushFrame('MAIN_MENU');
            return true;
          }
          if (key === '1') {
            this.triggerSMS();
            return true;
          }
          if (!isNaN(Number(key))) {
            this.dialedNumber += key;
            return true;
          }
          if (key === 'SOFT_R') {
            if (this.dialedNumber) {
              this.dialedNumber = this.dialedNumber.slice(0, -1);
            } else {
              // Names menu would go here
            }
            return true;
          }
          return false;
        },
        render: (renderer) => {
          renderer.drawRect(0, LAYOUT.HEADER_HEIGHT, LAYOUT.SCREEN_WIDTH, LAYOUT.SCREEN_HEIGHT - LAYOUT.HEADER_HEIGHT - LAYOUT.FOOTER_HEIGHT, "#87ceeb");
          
          if (this.smsCountdown > 0) {
            const smsText = `SMS IN: ${this.smsCountdown}s`;
            const layout = renderer.computeTextLayout(smsText, LAYOUT.SCREEN_WIDTH - 40, FONTS.SIZE_SMALL, FONTS.SANS, 12, true);
            renderer.drawTextLayout(layout, 35, 120, COLORS.white, FONTS.SIZE_SMALL, FONTS.SANS, true);
          }
          
          if (this.dialedNumber) {
            renderer.drawRect(LAYOUT.PADDING_X, 30, LAYOUT.SCREEN_WIDTH - LAYOUT.PADDING_X * 2, 60, COLORS.white);
            const layout = renderer.computeTextLayout(this.dialedNumber, LAYOUT.SCREEN_WIDTH - LAYOUT.PADDING_X * 2 - 8, FONTS.SIZE_XLARGE, FONTS.SANS, 24, true);
            renderer.drawTextLayout(layout, LAYOUT.PADDING_X + 4, 50, COLORS.black, FONTS.SIZE_XLARGE, FONTS.SANS, true);
            this.frames.IDLE.softKeys = { left: 'Options', right: 'Clear' };
          } else {
            const brandLayout = renderer.computeTextLayout("Samsoft", 100, FONTS.SIZE_SMALL, FONTS.SANS, 12, true);
            renderer.drawTextLayout(brandLayout, 40, 40, "rgba(0,0,0,0.5)", FONTS.SIZE_SMALL, FONTS.SANS, true);
            
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const timeLayout = renderer.computeTextLayout(time, LAYOUT.SCREEN_WIDTH - 20, FONTS.SIZE_XXLARGE, FONTS.SANS, 32, true);
            renderer.drawTextLayout(timeLayout, 26, 75, COLORS.black, FONTS.SIZE_XXLARGE, FONTS.SANS, true);
            this.frames.IDLE.softKeys = { left: 'Menu', right: 'Names' };
          }
        }
      },
      NOTIFICATION: {
        id: 'NOTIFICATION',
        displayName: 'ALERT',
        softKeys: { left: '', right: '' },
        onEnter: (state) => {
          const note = state.data as Notification;
          this.currentNotification = note;
          this.frames.NOTIFICATION.softKeys = note.softKeys;
          if (note.type === 'call') {
            this.sound.playSequence(TONES.RINGTONES[this.settings.get('ringtone_idx') as number], true);
          } else if (note.type === 'error') {
            this.sound.error();
          } else {
            this.sound.playSequence(TONES.SMS_TONES[this.settings.get('sms_tone_idx') as number]);
          }

          if (note.timeout) {
            this.notificationTimeout = window.setTimeout(() => {
              this.popFrame();
            }, note.timeout);
          }
        },
        onLeave: () => {
          this.sound.stop();
          this.currentNotification = null;
          if (this.notificationTimeout) {
            clearTimeout(this.notificationTimeout);
            this.notificationTimeout = null;
          }
        },
        onKey: (key) => {
          if (!this.currentNotification) return false;
          if (key === 'SOFT_L') {
            this.currentNotification.onAction('left');
            this.popFrame();
            return true;
          }
          if (key === 'SOFT_R') {
            this.currentNotification.onAction('right');
            this.popFrame();
            return true;
          }
          return false;
        },
        render: (renderer, state) => {
          const note = state.data as Notification;
          if (!note) return;

          renderer.drawRect(LAYOUT.PADDING_X, 20, LAYOUT.SCREEN_WIDTH - LAYOUT.PADDING_X * 2, 120, COLORS.white);
          renderer.drawIcon(note.icon, LAYOUT.PADDING_X + 4, 24, COLORS.active, 16);
          
          const headerLayout = renderer.computeTextLayout(note.header, LAYOUT.SCREEN_WIDTH - LAYOUT.PADDING_X * 2 - 28, FONTS.SIZE_NORMAL, FONTS.SANS, 14, true);
          renderer.drawTextLayout(headerLayout, LAYOUT.PADDING_X + 24, 24, COLORS.black, FONTS.SIZE_NORMAL, FONTS.SANS, true);
          
          const bodyLayout = renderer.computeTextLayout(note.body, LAYOUT.SCREEN_WIDTH - LAYOUT.PADDING_X * 2 - 8, FONTS.SIZE_SMALL, FONTS.SANS, 12, false);
          renderer.drawTextLayout(bodyLayout, LAYOUT.PADDING_X + 4, 45, COLORS.text, FONTS.SIZE_SMALL, FONTS.SANS, false);
        }
      },
      MAIN_MENU: this.createListFrame('MAIN_MENU', 'MENU', ['Messages', 'Settings', 'Debug'], (idx) => {
        if (idx === 0) this.pushFrame('MSG_MENU');
        if (idx === 1) this.pushFrame('SET_MENU');
        if (idx === 2) this.pushFrame('DEBUG_MENU');
      }),
      MSG_MENU: this.createListFrame('MSG_MENU', 'MESSAGES', ['1 Write New', '2 Inbox', '3 Outbox'], (idx) => {
        if (idx === 0) this.pushFrame('WRITE_MSG');
        if (idx === 1) this.pushFrame('INBOX_VIEW');
        if (idx === 2) this.pushFrame('OUTBOX_VIEW');
      }),
      INBOX_VIEW: {
        id: 'INBOX_VIEW',
        displayName: 'INBOX',
        softKeys: { left: 'Read', right: 'Back' },
        onKey: (key) => {
          const state = this.getFrameState('INBOX_VIEW');
          if (key === 'UP') {
            state.selectedIndex = (state.selectedIndex - 1 + this.inbox.length) % Math.max(1, this.inbox.length);
            this.sound.beep();
            return true;
          }
          if (key === 'DOWN') {
            state.selectedIndex = (state.selectedIndex + 1) % Math.max(1, this.inbox.length);
            this.sound.beep();
            return true;
          }
          if (key === 'SOFT_L' && this.inbox.length > 0) {
            const msg = this.inbox[state.selectedIndex];
            if (!msg.read) {
              msg.read = true;
              this.unreadMessages--;
            }
            this.pushFrame('MSG_DETAIL', { message: msg });
            return true;
          }
          return false;
        },
        render: (renderer, state) => {
          if (this.inbox.length === 0) {
            const layout = renderer.computeTextLayout("Empty", 100, FONTS.SIZE_NORMAL, FONTS.SANS, 14, false);
            renderer.drawTextLayout(layout, 50, 80);
          } else {
            this.renderList(renderer, this.inbox.map(m => `${m.read ? '' : '* '}${m.from}`), state.selectedIndex);
          }
        }
      },
      WRITE_MSG: {
        id: 'WRITE_MSG',
        displayName: 'NEW SMS',
        softKeys: { left: 'Send', right: 'Clear' },
        onKey: (key) => {
          if (key === 'SOFT_R') {
            this.currentComposerText = this.currentComposerText.slice(0, -1);
            return true;
          }
          if (key === 'SOFT_L' && this.currentComposerText) {
            this.outbox.unshift({ to: "Sent", text: this.currentComposerText, time: "Now", read: true });
            this.popFrame();
            this.currentComposerText = "";
            return true;
          }
          if (!isNaN(Number(key)) || key === '0' || key === '*' || key === '#') {
            this.currentComposerText += key;
            this.sound.beep();
            return true;
          }
          return false;
        },
        render: (renderer) => {
          renderer.drawRect(LAYOUT.PADDING_X, 20, LAYOUT.SCREEN_WIDTH - LAYOUT.PADDING_X * 2, 120, COLORS.white);
          const layout = renderer.computeTextLayout(this.currentComposerText + "_", LAYOUT.SCREEN_WIDTH - LAYOUT.PADDING_X * 2 - 8);
          renderer.drawTextLayout(layout, LAYOUT.PADDING_X + 4, 35);
        }
      },
      MSG_DETAIL: {
        id: 'MSG_DETAIL',
        displayName: 'VIEW',
        softKeys: { left: 'Delete', right: 'Back' },
        render: (renderer, state) => {
          const msg = state.data?.message as Message;
          if (!msg) return;
          const fromText = `From: ${msg.from || msg.to}`;
          const fromLayout = renderer.computeTextLayout(fromText, LAYOUT.SCREEN_WIDTH - LAYOUT.PADDING_X * 2, FONTS.SIZE_SMALL, FONTS.SANS, 12, true);
          renderer.drawTextLayout(fromLayout, LAYOUT.PADDING_X, 20, COLORS.active, FONTS.SIZE_SMALL, FONTS.SANS, true);
          
          renderer.drawRect(LAYOUT.PADDING_X, 35, LAYOUT.SCREEN_WIDTH - LAYOUT.PADDING_X * 2, 105, COLORS.white);
          
          const layout = renderer.computeTextLayout(msg.text, LAYOUT.SCREEN_WIDTH - LAYOUT.PADDING_X * 2 - 8);
          
          renderer.setClip(LAYOUT.PADDING_X, 35, LAYOUT.SCREEN_WIDTH - LAYOUT.PADDING_X * 2, 105);
          renderer.drawTextLayout(layout, LAYOUT.PADDING_X + 4, 45 - state.scrollY);
          renderer.clearClip();
          
          renderer.drawScrollbar(LAYOUT.SCREEN_WIDTH - LAYOUT.PADDING_X - 2, 35, 2, 105, layout.totalHeight, 105, state.scrollY);
        },
        onKey: (key) => {
          const state = this.getFrameState('MSG_DETAIL');
          if (key === 'UP') {
            state.scrollY = Math.max(0, state.scrollY - 10);
            return true;
          }
          if (key === 'DOWN') {
            state.scrollY += 10;
            return true;
          }
          return false;
        }
      },
      SET_MENU: this.createListFrame('SET_MENU', 'SETTINGS', ['Ringtone', 'SMS Tone', 'Vibrate', 'Keypad Beep'], (idx) => {
        if (idx === 0) this.pushFrame('TONE_SET');
        if (idx === 1) this.pushFrame('SMS_TONE_SET');
        if (idx === 2) this.pushFrame('VIBE_SET');
        if (idx === 3) this.pushFrame('BEEP_SET');
      }),
      BEEP_SET: this.createRadioFrame('BEEP_SET', 'KEYPAD BEEP', ['Off', 'On'], () => (this.settings.get('keypad_beep') as boolean) ? 1 : 0, (idx) => {
        this.settings.set('keypad_beep', idx === 1);
        this.popFrame();
      }),
      TONE_SET: this.createRadioFrame('TONE_SET', 'RINGTONE', ['Tone 1', 'Tone 2', 'Tone 3', 'Tone 4', 'Tone 5'], () => this.settings.get('ringtone_idx') as number, (idx) => {
        this.settings.set('ringtone_idx', idx);
        this.popFrame();
      }, (idx) => {
        this.sound.playSequence(TONES.RINGTONES[idx]);
      }),
      SMS_TONE_SET: this.createRadioFrame('SMS_TONE_SET', 'SMS TONE', ['Tone 1', 'Tone 2', 'Tone 3', 'Tone 4', 'Tone 5'], () => this.settings.get('sms_tone_idx') as number, (idx) => {
        this.settings.set('sms_tone_idx', idx);
        this.popFrame();
      }, (idx) => {
        this.sound.playSequence(TONES.SMS_TONES[idx]);
      }),
      VIBE_SET: this.createCheckFrame('VIBE_SET', 'VIBRATE', ['Incoming Call', 'New SMS', 'Keypad'], () => {
        const set = new Set<number>();
        if (this.settings.get('vibrate_call')) set.add(0);
        if (this.settings.get('vibrate_sms')) set.add(1);
        if (this.settings.get('vibrate_keypad')) set.add(2);
        return set;
      }, (indices) => {
        this.settings.set('vibrate_call', indices.has(0));
        this.settings.set('vibrate_sms', indices.has(1));
        this.settings.set('vibrate_keypad', indices.has(2));
        this.popFrame();
      }),
      SAVE_CONFIRM: {
        id: 'SAVE_CONFIRM',
        displayName: 'SAVE?',
        softKeys: { left: 'Select', right: 'Back' },
        onKey: (key) => {
          const state = this.getFrameState('SAVE_CONFIRM');
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
            this.popFrame(); // Pop SAVE_CONFIRM first
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
            this.popFrame();
            return true;
          }
          return false;
        },
        render: (renderer, state) => {
          this.renderList(renderer, ['Save', 'Don\'t Save', 'Cancel'], state.selectedIndex);
        }
      },
      DEBUG_MENU: this.createListFrame('DEBUG_MENU', 'DEBUG MODE', [
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
      ], (idx) => {
        const debugActions: (() => void)[] = [
          () => this.showNotification({
            id: 'urgent_' + Date.now(),
            icon: 'SIGNAL',
            header: 'SYSTEM ERROR',
            body: 'A critical system error has occurred. Please restart the device immediately.',
            softKeys: { left: 'Restart', right: 'Ignore' },
            type: 'error',
            timeout: 5000,
            onAction: (action) => {
              if (action === 'left') this.debugSystemReset();
            }
          }),
          () => this.triggerSMS(),
          () => { this.settings.reset(); this.popFrame(); },
          () => { this.settings.set('vibrate_call', !this.settings.get('vibrate_call')); this.popFrame(); },
          () => { this.settings.set('keypad_beep', !this.settings.get('keypad_beep')); this.popFrame(); },
          () => { this.inbox = []; this.unreadMessages = 0; this.popFrame(); },
          () => { this.outbox = []; this.popFrame(); },
          () => { for(let i=0; i<5; i++) this.receiveMessage(); this.popFrame(); },
          () => { for(let i=0; i<5; i++) this.outbox.unshift({ to: "Sent", text: "Debug message " + i, time: "Now", read: true }); this.popFrame(); },
          () => this.showNotification({ id: 'info', icon: 'SETTINGS', header: 'SYSTEM INFO', body: 'Samsoft Afterthought A200\nVer: 1.0.4-DEBUG\nRAM: 128KB', softKeys: { left: 'OK', right: 'Back' }, type: 'info', timeout: 5000, onAction: () => {} }),
          () => this.showNotification({ id: 'batt', icon: 'BATTERY', header: 'BATTERY LOW', body: 'Connect charger now.', softKeys: { left: 'OK', right: 'Dismiss' }, type: 'error', timeout: 5000, onAction: () => {} }),
          () => this.showNotification({ id: 'sig', icon: 'SIGNAL', header: 'NO SIGNAL', body: 'Searching for network...', softKeys: { left: 'OK', right: 'Retry' }, type: 'error', timeout: 5000, onAction: () => {} }),
          () => this.showNotification({ id: 'vm', icon: 'PHONE', header: 'VOICEMAIL', body: 'You have 1 new voicemail.', softKeys: { left: 'Listen', right: 'Later' }, type: 'info', timeout: 5000, onAction: () => {} }),
          () => this.showNotification({ id: 'busy', icon: 'SIGNAL', header: 'NETWORK BUSY', body: 'Please try again later.', softKeys: { left: 'OK', right: 'Retry' }, type: 'error', timeout: 5000, onAction: () => {} }),
          () => this.showNotification({ id: 'sim', icon: 'LOCK', header: 'SIM ERROR', body: 'Invalid SIM card detected.', softKeys: { left: 'OK', right: 'Restart' }, type: 'error', timeout: 5000, onAction: () => {} }),
          () => this.showNotification({ id: 'mem', icon: 'SETTINGS', header: 'MEMORY FULL', body: 'Delete some messages.', softKeys: { left: 'OK', right: 'Manage' }, type: 'error', timeout: 5000, onAction: () => {} }),
          () => this.showNotification({ id: 'upd', icon: 'SETTINGS', header: 'UPDATE', body: 'Software update available.', softKeys: { left: 'Install', right: 'Later' }, type: 'info', timeout: 5000, onAction: () => {} }),
          () => this.showNotification({ id: 'fac', icon: 'TRASH', header: 'RESET', body: 'Delete all data?', softKeys: { left: 'Yes', right: 'No' }, type: 'error', timeout: 5000, onAction: (a) => { if(a==='left') this.debugSystemReset(); } }),
          () => this.sound.playSequence(TONES.RINGTONES[0]),
          () => this.sound.playSequence(TONES.RINGTONES[1]),
          () => this.sound.playSequence(TONES.SMS_TONES[0]),
          () => this.sound.playSequence(TONES.SMS_TONES[1]),
        ];
        if (debugActions[idx]) debugActions[idx]();
      })
    };
  }

  private createListFrame(id: string, displayName: string, items: string[], onSelect: (idx: number) => void): Frame {
    return {
      id,
      displayName,
      softKeys: { left: 'Select', right: 'Back' },
      onKey: (key) => {
        const state = this.getFrameState(id);
        if (key === 'UP') {
          state.selectedIndex = (state.selectedIndex - 1 + items.length) % items.length;
          this.updateScroll(id, items.length);
          this.sound.beep();
          return true;
        }
        if (key === 'DOWN') {
          state.selectedIndex = (state.selectedIndex + 1) % items.length;
          this.updateScroll(id, items.length);
          this.sound.beep();
          return true;
        }
        if (key === 'SOFT_L') {
          onSelect(state.selectedIndex);
          return true;
        }
        return false;
      },
      render: (renderer, state) => {
        this.renderList(renderer, items, state.selectedIndex, state.scrollY);
      }
    };
  }

  private createRadioFrame(id: string, displayName: string, items: string[], getSelected: () => number, onSelect: (idx: number) => void, onPreview?: (idx: number) => void): Frame {
    return {
      id,
      displayName,
      softKeys: { left: 'Select', right: 'Back' },
      onKey: (key) => {
        const state = this.getFrameState(id);
        if (key === 'UP') {
          state.selectedIndex = (state.selectedIndex - 1 + items.length) % items.length;
          this.updateScroll(id, items.length);
          if (onPreview) onPreview(state.selectedIndex);
          return true;
        }
        if (key === 'DOWN') {
          state.selectedIndex = (state.selectedIndex + 1) % items.length;
          this.updateScroll(id, items.length);
          if (onPreview) onPreview(state.selectedIndex);
          return true;
        }
        if (key === 'SOFT_L') {
          onSelect(state.selectedIndex);
          return true;
        }
        if (key === 'SOFT_R') {
          this.popFrame();
          return true;
        }
        return false;
      },
      render: (renderer, state) => {
        this.renderList(renderer, items, state.selectedIndex, state.scrollY, 'radio', getSelected());
      },
      onLeave: () => {
        this.sound.stop();
      }
    };
  }

  private createCheckFrame(id: string, displayName: string, items: string[], getInitial: () => Set<number>, onSave: (indices: Set<number>) => void): Frame {
    return {
      id,
      displayName,
      softKeys: { left: 'Toggle', right: 'Exit' },
      onEnter: (state) => {
        if (!state.checkedIndices) {
          state.checkedIndices = new Set(getInitial());
          state.data = { original: new Set(getInitial()) };
        }
      },
      onKey: (key) => {
        const state = this.getFrameState(id);
        if (!state.checkedIndices) state.checkedIndices = new Set();
        
        if (key === 'UP') {
          state.selectedIndex = (state.selectedIndex - 1 + items.length) % items.length;
          this.updateScroll(id, items.length);
          return true;
        }
        if (key === 'DOWN') {
          state.selectedIndex = (state.selectedIndex + 1) % items.length;
          this.updateScroll(id, items.length);
          return true;
        }
        if (key === 'SOFT_L') {
          if (state.checkedIndices.has(state.selectedIndex)) {
            state.checkedIndices.delete(state.selectedIndex);
          } else {
            state.checkedIndices.add(state.selectedIndex);
          }
          return true;
        }
        if (key === 'SOFT_R') {
          const original = state.data?.original as Set<number>;
          const current = state.checkedIndices;
          let changed = original.size !== current.size;
          if (!changed) {
            for (const item of current) {
              if (!original.has(item)) {
                changed = true;
                break;
              }
            }
          }

          if (!changed) {
            this.popFrame();
          } else {
            this.pushFrame('SAVE_CONFIRM', { 
              onSave: () => onSave(current),
              onDiscard: () => this.popFrame(),
              onCancel: () => {} 
            });
          }
          return true;
        }
        return false;
      },
      render: (renderer, state) => {
        this.renderList(renderer, items, state.selectedIndex, state.scrollY, 'check', -1, state.checkedIndices);
      }
    };
  }

  private renderList(renderer: Renderer, items: string[], selectedIndex: number, scrollY: number = 0, type: 'normal' | 'radio' | 'check' = 'normal', radioSelected: number = -1, checkedIndices?: Set<number>) {
    const viewportHeight = LAYOUT.SCREEN_HEIGHT - LAYOUT.HEADER_HEIGHT - LAYOUT.FOOTER_HEIGHT;
    const totalHeight = items.length * LAYOUT.MENU_ITEM_HEIGHT;
    
    renderer.setClip(0, LAYOUT.HEADER_HEIGHT, LAYOUT.SCREEN_WIDTH, viewportHeight);
    
    items.forEach((item, i) => {
      const y = LAYOUT.HEADER_HEIGHT + (i * LAYOUT.MENU_ITEM_HEIGHT) - scrollY;
      const textY = y + (LAYOUT.MENU_ITEM_HEIGHT - parseInt(FONTS.SIZE_NORMAL)) / 2;
      
      if (i === selectedIndex) {
        renderer.drawRect(0, y, LAYOUT.SCREEN_WIDTH, LAYOUT.MENU_ITEM_HEIGHT, COLORS.active);
        const layout = renderer.computeTextLayout(item, LAYOUT.SCREEN_WIDTH - LAYOUT.MENU_ITEM_PADDING * 2 - 20, FONTS.SIZE_NORMAL, FONTS.SANS, 14, true);
        renderer.drawTextLayout(layout, LAYOUT.MENU_ITEM_PADDING, textY, COLORS.white, FONTS.SIZE_NORMAL, FONTS.SANS, true);
      } else {
        const layout = renderer.computeTextLayout(item, LAYOUT.SCREEN_WIDTH - LAYOUT.MENU_ITEM_PADDING * 2 - 20, FONTS.SIZE_NORMAL, FONTS.SANS, 14, false);
        renderer.drawTextLayout(layout, LAYOUT.MENU_ITEM_PADDING, textY, COLORS.text, FONTS.SIZE_NORMAL, FONTS.SANS, false);
      }

      if (type === 'radio') {
        const isSelected = i === radioSelected;
        renderer.drawRect(LAYOUT.SCREEN_WIDTH - 15, y + 5, 10, 10, isSelected ? COLORS.white : 'rgba(0,0,0,0.2)');
        if (isSelected) renderer.drawRect(LAYOUT.SCREEN_WIDTH - 13, y + 7, 6, 6, COLORS.active);
      } else if (type === 'check') {
        const isChecked = checkedIndices?.has(i);
        renderer.drawRect(LAYOUT.SCREEN_WIDTH - 15, y + 5, 10, 10, isChecked ? COLORS.active : 'rgba(0,0,0,0.2)');
        if (isChecked) {
          renderer.drawRect(LAYOUT.SCREEN_WIDTH - 13, y + 7, 6, 6, COLORS.white);
        }
      }
    });
    
    renderer.clearClip();
    renderer.drawScrollbar(LAYOUT.SCREEN_WIDTH - 2, LAYOUT.HEADER_HEIGHT, 2, viewportHeight, totalHeight, viewportHeight, scrollY);
  }

  private updateScroll(id: string, itemsCount: number) {
    const state = this.getFrameState(id);
    const viewportHeight = LAYOUT.SCREEN_HEIGHT - LAYOUT.HEADER_HEIGHT - LAYOUT.FOOTER_HEIGHT;
    const itemY = state.selectedIndex * LAYOUT.MENU_ITEM_HEIGHT;
    
    if (itemY < state.scrollY) {
      state.scrollY = itemY;
    } else if (itemY + LAYOUT.MENU_ITEM_HEIGHT > state.scrollY + viewportHeight) {
      state.scrollY = itemY + LAYOUT.MENU_ITEM_HEIGHT - viewportHeight;
    }
  }

  private getFrameState(id: string): FrameState {
    if (!this.frameStates[id]) {
      this.frameStates[id] = { selectedIndex: 0, scrollY: 0, scrollX: 0 };
    }
    return this.frameStates[id];
  }

  private pushFrame(id: string, data?: any) {
    const currentFrameId = this.navigationStack[this.navigationStack.length - 1];
    const currentFrame = this.frames[currentFrameId];
    if (currentFrame && currentFrame.onLeave) currentFrame.onLeave(this.getFrameState(currentFrameId));

    this.navigationStack.push(id);
    const newState = this.getFrameState(id);
    if (data) newState.data = data;
    
    const newFrame = this.frames[id];
    if (newFrame && newFrame.onEnter) newFrame.onEnter(newState);
  }

  private popFrame() {
    if (this.navigationStack.length > 1) {
      const currentFrameId = this.navigationStack[this.navigationStack.length - 1];
      const currentFrame = this.frames[currentFrameId];
      if (currentFrame && currentFrame.onLeave) currentFrame.onLeave(this.getFrameState(currentFrameId));

      this.navigationStack.pop();
      
      const newFrameId = this.navigationStack[this.navigationStack.length - 1];
      const newFrame = this.frames[newFrameId];
      if (newFrame && newFrame.onEnter) newFrame.onEnter(this.getFrameState(newFrameId));
    }
  }

  private loadLogo() {
    const img = new Image();
    img.src = '/LOGO2.png';
    img.onload = () => {
      if (img.width > 0) this.bootLogo = img;
    };
    img.onerror = () => {
      const fallback = new Image();
      fallback.src = '/LOGO.png';
      fallback.onload = () => {
        if (fallback.width > 0) this.bootLogo = fallback;
      };
    };
  }

  public update(deltaTime: number) {
    const isEndDown = this.input.isKeyDown('END');
    
    if (isEndDown) {
      if (this.endKeyStartTime === null) {
        this.endKeyStartTime = Date.now();
      }
      
      const holdDuration = Date.now() - this.endKeyStartTime;
      
      if (this.powerState === 'OFF' && holdDuration >= 1000) { 
        this.powerState = 'BOOTING';
        this.bootProgress = 0;
        this.endKeyStartTime = null; 
      } else if (this.powerState === 'ON' && holdDuration >= 1500) {
        this.powerState = 'OFF';
        this.endKeyStartTime = null; 
      }
    } else {
      this.endKeyStartTime = null;
    }

    if (this.powerState === 'BOOTING') {
      this.bootProgress += deltaTime;
      if (this.bootProgress >= 2000) {
        this.powerState = 'ON';
        this.bootProgress = 0;
        this.sound.startup();
        this.renderer.cacheIcons(COLORS.white, 10);
      }
      return;
    }

    if (this.powerState === 'OFF') {
      this.input.clearQueue();
      return;
    }

    const key = this.input.pollNextKey();
    if (key) {
      this.handleKey(key);
    }

    this.processSmsCountdown(deltaTime);
  }

  private processSmsCountdown(deltaTime: number) {
    if (this.smsCountdown > 0) {
      this.lastSmsTick += deltaTime;
      if (this.lastSmsTick >= 1000) {
        this.smsCountdown--;
        this.lastSmsTick = 0;
        if (this.smsCountdown <= 0) {
          this.receiveMessage();
        }
      }
    }
  }

  private receiveMessage() {
    const texts = [
      "Hey, check out how this text wraps now!",
      "This is a longer message intended to test the automatic text wrapping capability of the Samsoft Afterthought A200 system.",
      "Did you see the new debug menu?",
      "Meet me at the station in 20 minutes.",
      "Samsoft: Service update successful."
    ];
    const from = "Samsoft";
    const text = texts[Math.floor(Math.random() * texts.length)];
    const newMsg: Message = {
      from,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false
    };
    this.inbox.unshift(newMsg);
    this.unreadMessages = 0;
    this.inbox.forEach(m => { if(!m.read) this.unreadMessages++; });
    
    this.showNotification({
      id: 'msg_' + Date.now(),
      icon: 'ENVELOPE',
      header: 'New Message',
      body: `From: ${from}\n${text.substring(0, 30)}...`,
      softKeys: { left: 'View', right: 'Dismiss' },
      type: 'info',
      onAction: (action) => {
        if (action === 'left') {
          newMsg.read = true;
          this.unreadMessages = Math.max(0, this.unreadMessages - 1);
          this.pushFrame('MSG_DETAIL', { message: newMsg });
        }
      }
    });
    // Sound is handled by Notification frame onEnter if it pops up immediately,
    // but if it's queued, we might want to play it now?
    // The user said "notifications play the text tone once".
    // If it's queued, it will play when it shows up.
  }

  public showNotification(note: Notification) {
    if (note.type === 'call' || note.type === 'error') {
      // Urgent ones jump to front and interrupt
      this.notificationQueue.unshift(note);
      this.checkNotifications();
    } else {
      // Regular ones queue up
      this.notificationQueue.push(note);
      if (this.navigationStack[this.navigationStack.length - 1] === 'IDLE') {
        this.checkNotifications();
      }
    }
  }

  private checkNotifications() {
    if (this.notificationQueue.length > 0 && this.navigationStack[this.navigationStack.length - 1] !== 'NOTIFICATION') {
      const next = this.notificationQueue.shift()!;
      this.pushFrame('NOTIFICATION', next);
    }
  }

  private handleKey(key: KeyCode) {
    const currentFrameId = this.navigationStack[this.navigationStack.length - 1];
    const frame = this.frames[currentFrameId];

    if (key === 'END') {
      this.sound.stop();
      this.navigationStack = ['IDLE'];
      this.dialedNumber = "";
      this.currentComposerText = "";
      this.checkNotifications();
      return;
    }

    if (this.settings.get('keypad_beep') && !['END'].includes(key)) {
      this.sound.beep();
    }

    if (frame && frame.onKey && frame.onKey(key)) {
      return;
    }

    if (key === 'SOFT_R') {
      this.popFrame();
    }
  }

  private triggerSMS() {
    if (this.smsCountdown > 0) return;
    this.smsCountdown = 5;
  }

  public getPowerState(): PowerState {
    return this.powerState;
  }

  public debugForcePowerOn() {
    this.powerState = 'ON';
    this.navigationStack = ['IDLE'];
    this.bootProgress = 0;
    this.endKeyStartTime = null;
    this.input.clearQueue();
  }

  public debugTriggerSMS() {
    if (this.powerState === 'ON') {
      this.triggerSMS();
    }
  }

  public debugJumpToMenu(view: string) {
    if (this.powerState === 'ON') {
      this.pushFrame(view);
    }
  }

  public debugSystemReset() {
    this.powerState = 'OFF';
    this.navigationStack = ['IDLE'];
    this.bootProgress = 0;
    this.endKeyStartTime = null;
    this.dialedNumber = "";
    this.currentComposerText = "";
    this.input.clearQueue();
    this.sound.stop();
  }

  public debugForceRender() {
    this.render();
  }

  public render() {
    if (this.powerState === 'OFF') {
      this.renderer.drawRect(0, 0, LAYOUT.SCREEN_WIDTH, LAYOUT.SCREEN_HEIGHT, COLORS.black);
      this.renderer.drawRect(0, 0, 1, 1, Date.now() % 1000 < 500 ? COLORS.heartbeatOff : COLORS.black);
      
      if (this.endKeyStartTime !== null) {
        const holdDuration = Date.now() - this.endKeyStartTime;
        if (holdDuration > 300) {
          const alpha = Math.min(0.5, (holdDuration - 300) / 1000);
          const layout = this.renderer.computeTextLayout("POWERING ON...", 100, FONTS.SIZE_SMALL, FONTS.SANS, 12, true);
          this.renderer.drawTextLayout(layout, 30, 85, `rgba(255,255,255,${alpha})`, FONTS.SIZE_SMALL, FONTS.SANS, true);
        }
      }
      return;
    }

    if (this.powerState === 'BOOTING') {
      this.renderBoot();
      return;
    }

    this.renderer.clear();
    this.renderer.drawRect(1, 1, LAYOUT.SCREEN_WIDTH - 2, LAYOUT.SCREEN_HEIGHT - 2, COLORS.bg);
    
    this.renderer.drawRect(LAYOUT.SCREEN_WIDTH - 8, 2, 4, 4, Date.now() % 1000 < 500 ? COLORS.heartbeatOn : COLORS.heartbeatOff);
    
    const currentFrameId = this.navigationStack[this.navigationStack.length - 1];
    const frame = this.frames[currentFrameId];
    const state = this.getFrameState(currentFrameId);

    if (frame) {
      frame.render(this.renderer, state);
    }
    
    this.renderer.drawHeader(frame?.displayName || "ERROR", this.unreadMessages > 0);
    this.renderer.drawSoftKeys(frame?.softKeys.left || "", frame?.softKeys.right || "");
  }

  private renderBoot() {
    this.renderer.drawRect(0, 0, LAYOUT.SCREEN_WIDTH, LAYOUT.SCREEN_HEIGHT, COLORS.white);
    if (this.bootLogo) {
      this.renderer.drawImage(this.bootLogo, 0, 0, LAYOUT.SCREEN_WIDTH, LAYOUT.SCREEN_HEIGHT);
    } else {
      const layout = this.renderer.computeTextLayout("SAMSOFT", 100, FONTS.SIZE_LARGE, FONTS.SANS, 20, true);
      this.renderer.drawTextLayout(layout, 40, 85, COLORS.black, FONTS.SIZE_LARGE, FONTS.SANS, true);
    }
    
    const progress = Math.min(1, this.bootProgress / 2000);
    this.renderer.drawRect(14, 140, 100, 4, "#eee");
    this.renderer.drawRect(14, 140, 100 * progress, 4, COLORS.active);
  }
}
