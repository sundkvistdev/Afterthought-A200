/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Frame, Message } from '../system/types';
import { FrameBuilder } from '../system/FrameBuilder';
import { LAYOUT, FONTS, COLORS } from '../system/Theme';

export const MessagesApp: Record<string, Frame> = {
  MSG_MENU: FrameBuilder.createList('MSG_MENU', 'MESSAGES', ['1 Write New', '2 Inbox', '3 Outbox'], (idx, os) => {
    if (idx === 0) os.pushFrame('WRITE_MSG');
    if (idx === 1) os.pushFrame('INBOX_VIEW');
    if (idx === 2) os.pushFrame('OUTBOX_VIEW');
  }),

  INBOX_VIEW: {
    id: 'INBOX_VIEW',
    displayName: 'INBOX',
    softKeys: { left: 'Read', right: 'Back' },
    onKey: (key, os) => {
      const state = os.getFrameState('INBOX_VIEW');
      const inbox = os.getInbox();
      if (key === 'UP') {
        state.selectedIndex = (state.selectedIndex - 1 + inbox.length) % Math.max(1, inbox.length);
        os.sound.beep();
        return true;
      }
      if (key === 'DOWN') {
        state.selectedIndex = (state.selectedIndex + 1) % Math.max(1, inbox.length);
        os.sound.beep();
        return true;
      }
      if (key === 'SOFT_L' && inbox.length > 0) {
        const msg = inbox[state.selectedIndex];
        if (!msg.read) {
          msg.read = true;
          os.decrementUnread();
        }
        os.pushFrame('MSG_DETAIL', { message: msg });
        return true;
      }
      return false;
    },
    render: (renderer, state, os) => {
      const inbox = os.getInbox();
      if (inbox.length === 0) {
        const layout = renderer.computeTextLayout("Empty", 100, FONTS.SIZE_NORMAL, FONTS.SANS, 14, false);
        renderer.drawTextLayout(layout, 50, 80);
      } else {
        os.renderList(renderer, inbox.map((m: Message) => `${m.read ? '' : '* '}${m.from}`), state.selectedIndex);
      }
    }
  },

  WRITE_MSG: {
    id: 'WRITE_MSG',
    displayName: 'NEW SMS',
    softKeys: { left: 'Send', right: 'Clear' },
    onKey: (key, os) => {
      if (key === 'SOFT_R') {
        os.currentComposerText = os.currentComposerText.slice(0, -1);
        return true;
      }
      if (key === 'SOFT_L' && os.currentComposerText) {
        os.addSentMessage({ to: "Sent", text: os.currentComposerText, time: "Now", read: true });
        os.popFrame();
        os.currentComposerText = "";
        return true;
      }
      if (!isNaN(Number(key)) || key === '0' || key === '*' || key === '#') {
        os.currentComposerText += key;
        os.sound.beep();
        return true;
      }
      return false;
    },
    render: (renderer, state, os) => {
      renderer.drawRect(LAYOUT.PADDING_X, 20, LAYOUT.SCREEN_WIDTH - LAYOUT.PADDING_X * 2, 120, COLORS.white);
      const layout = renderer.computeTextLayout(os.currentComposerText + "_", LAYOUT.SCREEN_WIDTH - LAYOUT.PADDING_X * 2 - 8);
      renderer.drawTextLayout(layout, LAYOUT.PADDING_X + 4, 35);
    }
  },

  MSG_DETAIL: {
    id: 'MSG_DETAIL',
    displayName: 'VIEW',
    softKeys: { left: 'Delete', right: 'Back' },
    render: (renderer, state, os) => {
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
    onKey: (key, os) => {
      const state = os.getFrameState('MSG_DETAIL');
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
  }
};
