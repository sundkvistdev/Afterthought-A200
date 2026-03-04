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
import { 
  PowerState, 
  Message, 
  SoftKeys, 
  NotificationPriority, 
  Notification, 
  Frame, 
  FrameState 
} from './types';

import { SystemApp } from '../apps/SystemApp';
import { MessagesApp } from '../apps/MessagesApp';
import { SettingsApp } from '../apps/SettingsApp';

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
  public dialedNumber = "";
  public currentComposerText = "";
  public smsCountdown = 0;
  private lastSmsTick = 0;

  public sound: SoundEngine;
  public settings: SettingsEngine;

  private notificationQueue: Notification[] = [];
  public currentNotification: Notification | null = null;
  public notificationTimeout: number | null = null;

  constructor(private input: InputManager, private renderer: Renderer) {
    this.sound = new SoundEngine();
    this.settings = new SettingsEngine();
    this.loadLogo();
    this.initFrames();
  }

  private initFrames() {
    this.frames = {
      ...SystemApp,
      ...MessagesApp,
      ...SettingsApp
    };
  }

  public getInbox() { return this.inbox; }
  public getOutbox() { return this.outbox; }
  public decrementUnread() { this.unreadMessages = Math.max(0, this.unreadMessages - 1); }
  public addSentMessage(msg: Message) { this.outbox.unshift(msg); }
  public clearInbox() { this.inbox = []; this.unreadMessages = 0; }
  public clearOutbox() { this.outbox = []; }

  public renderList(renderer: Renderer, items: string[], selectedIndex: number, scrollY: number = 0, type: 'normal' | 'radio' | 'check' = 'normal', radioSelected: number = -1, checkedIndices?: Set<number>) {
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

  public updateScroll(id: string, itemsCount: number) {
    const state = this.getFrameState(id);
    const viewportHeight = LAYOUT.SCREEN_HEIGHT - LAYOUT.HEADER_HEIGHT - LAYOUT.FOOTER_HEIGHT;
    const itemY = state.selectedIndex * LAYOUT.MENU_ITEM_HEIGHT;
    
    if (itemY < state.scrollY) {
      state.scrollY = itemY;
    } else if (itemY + LAYOUT.MENU_ITEM_HEIGHT > state.scrollY + viewportHeight) {
      state.scrollY = itemY + LAYOUT.MENU_ITEM_HEIGHT - viewportHeight;
    }
  }

  public getFrameState(id: string): FrameState {
    if (!this.frameStates[id]) {
      this.frameStates[id] = { selectedIndex: 0, scrollY: 0, scrollX: 0 };
    }
    return this.frameStates[id];
  }

  public pushFrame(id: string, data?: any) {
    const currentFrameId = this.navigationStack[this.navigationStack.length - 1];
    const currentFrame = this.frames[currentFrameId];
    if (currentFrame && currentFrame.onLeave) currentFrame.onLeave(this.getFrameState(currentFrameId), this);

    this.navigationStack.push(id);
    const newState = this.getFrameState(id);
    if (data) newState.data = data;
    
    const newFrame = this.frames[id];
    if (newFrame && newFrame.onEnter) newFrame.onEnter(newState, this);
  }

  public popFrame() {
    if (this.navigationStack.length > 1) {
      const currentFrameId = this.navigationStack[this.navigationStack.length - 1];
      const currentFrame = this.frames[currentFrameId];
      if (currentFrame && currentFrame.onLeave) currentFrame.onLeave(this.getFrameState(currentFrameId), this);

      this.navigationStack.pop();
      
      const newFrameId = this.navigationStack[this.navigationStack.length - 1];
      const newFrame = this.frames[newFrameId];
      if (newFrame && newFrame.onEnter) newFrame.onEnter(this.getFrameState(newFrameId), this);
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
      header: 'New Message',
      body: `From: ${from}\n${text.substring(0, 30)}...`,
      softKeys: { left: 'View', right: 'Dismiss' },
      type: 'message',
      priority: 'NORMAL',
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
    this.notificationQueue.push(note);
    
    // Sort queue by priority: URGENT > HIGH > NORMAL > LOW
    const priorityMap: Record<NotificationPriority, number> = {
      'URGENT': 3,
      'HIGH': 2,
      'NORMAL': 1,
      'LOW': 0
    };
    
    this.notificationQueue.sort((a, b) => priorityMap[b.priority] - priorityMap[a.priority]);

    const currentFrameId = this.navigationStack[this.navigationStack.length - 1];
    
    if (note.priority === 'URGENT' || note.priority === 'HIGH') {
      // Urgent/High notifications interrupt immediately unless already in a notification
      if (currentFrameId !== 'NOTIFICATION') {
        this.checkNotifications();
      }
    } else if (currentFrameId === 'IDLE') {
      // Normal/Low notifications only pop up on IDLE screen
      this.checkNotifications();
    }
  }

  public checkNotifications() {
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

    if (frame && frame.onKey && frame.onKey(key, this)) {
      return;
    }

    if (key === 'SOFT_R') {
      this.popFrame();
    }
  }

  public triggerSMS() {
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
      frame.render(this.renderer, state, this);
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
