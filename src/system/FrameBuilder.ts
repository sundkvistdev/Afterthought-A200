/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Frame, FrameState, SoftKeys } from './types';
import { KeyCode } from './InputManager';
import { Renderer } from './Renderer';
import { LAYOUT, FONTS, COLORS } from './Theme';

export class FrameBuilder {
  public static createList(
    id: string,
    displayName: string,
    items: string[] | ((os: any) => string[]),
    onSelect: (idx: number, os: any) => void,
    softKeys: SoftKeys = { left: 'Select', right: 'Back' }
  ): Frame {
    return {
      id,
      displayName,
      softKeys,
      onKey: (key, os) => {
        const state = os.getFrameState(id);
        const actualItems = typeof items === 'function' ? items(os) : items;
        
        if (key === 'UP') {
          state.selectedIndex = (state.selectedIndex - 1 + actualItems.length) % actualItems.length;
          os.updateScroll(id, actualItems.length);
          os.sound.beep();
          return true;
        }
        if (key === 'DOWN') {
          state.selectedIndex = (state.selectedIndex + 1) % actualItems.length;
          os.updateScroll(id, actualItems.length);
          os.sound.beep();
          return true;
        }
        if (key === 'SOFT_L') {
          onSelect(state.selectedIndex, os);
          return true;
        }
        return false;
      },
      render: (renderer, state, os) => {
        const actualItems = typeof items === 'function' ? items(os) : items;
        os.renderList(renderer, actualItems, state.selectedIndex, state.scrollY);
      }
    };
  }

  public static createRadio(
    id: string,
    displayName: string,
    items: string[],
    getSelected: (os: any) => number,
    onSelect: (idx: number, os: any) => void,
    onPreview?: (idx: number, os: any) => void
  ): Frame {
    return {
      id,
      displayName,
      softKeys: { left: 'Select', right: 'Back' },
      onKey: (key, os) => {
        const state = os.getFrameState(id);
        if (key === 'UP') {
          state.selectedIndex = (state.selectedIndex - 1 + items.length) % items.length;
          os.updateScroll(id, items.length);
          if (onPreview) onPreview(state.selectedIndex, os);
          return true;
        }
        if (key === 'DOWN') {
          state.selectedIndex = (state.selectedIndex + 1) % items.length;
          os.updateScroll(id, items.length);
          if (onPreview) onPreview(state.selectedIndex, os);
          return true;
        }
        if (key === 'SOFT_L') {
          onSelect(state.selectedIndex, os);
          return true;
        }
        if (key === 'SOFT_R') {
          os.popFrame();
          return true;
        }
        return false;
      },
      render: (renderer, state, os) => {
        os.renderList(renderer, items, state.selectedIndex, state.scrollY, 'radio', getSelected(os));
      },
      onLeave: (state, os) => {
        os.sound.stop();
      }
    };
  }

  public static createCheck(
    id: string,
    displayName: string,
    items: string[],
    getInitial: (os: any) => Set<number>,
    onSave: (indices: Set<number>, os: any) => void
  ): Frame {
    return {
      id,
      displayName,
      softKeys: { left: 'Toggle', right: 'Exit' },
      onEnter: (state, os) => {
        if (!state.checkedIndices) {
          const initial = getInitial(os);
          state.checkedIndices = new Set(initial);
          state.data = { original: new Set(initial) };
        }
      },
      onKey: (key, os) => {
        const state = os.getFrameState(id);
        if (!state.checkedIndices) state.checkedIndices = new Set();
        
        if (key === 'UP') {
          state.selectedIndex = (state.selectedIndex - 1 + items.length) % items.length;
          os.updateScroll(id, items.length);
          return true;
        }
        if (key === 'DOWN') {
          state.selectedIndex = (state.selectedIndex + 1) % items.length;
          os.updateScroll(id, items.length);
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
            os.popFrame();
          } else {
            os.pushFrame('SAVE_CONFIRM', { 
              onSave: () => onSave(current, os),
              onDiscard: () => os.popFrame(),
              onCancel: () => {} 
            });
          }
          return true;
        }
        return false;
      },
      render: (renderer, state, os) => {
        os.renderList(renderer, items, state.selectedIndex, state.scrollY, 'check', -1, state.checkedIndices);
      }
    };
  }
}
