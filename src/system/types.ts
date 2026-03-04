/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { KeyCode } from './InputManager';
import { Renderer } from './Renderer';
import { SVG_ICONS } from './IconManager';

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

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface Notification {
  id: string;
  icon?: keyof typeof SVG_ICONS;
  header: string;
  body: string;
  softKeys: SoftKeys;
  onAction: (action: 'left' | 'right') => void;
  type: 'info' | 'error' | 'call' | 'message';
  priority: NotificationPriority;
  timeout?: number;
}

export interface FrameState {
  selectedIndex: number;
  scrollY: number;
  scrollX: number;
  data?: any;
  checkedIndices?: Set<number>;
}

export interface Frame {
  id: string;
  displayName: string;
  softKeys: SoftKeys;
  onKey?: (key: KeyCode, os: any) => boolean;
  render: (renderer: Renderer, state: FrameState, os: any) => void;
  onEnter?: (state: FrameState, os: any) => void;
  onLeave?: (state: FrameState, os: any) => void;
}
