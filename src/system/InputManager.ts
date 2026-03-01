/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type KeyCode = 
  | 'SOFT_L' | 'SOFT_R' | 'UP' | 'DOWN' | 'CALL' | 'END'
  | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '*' | '0' | '#';

export class InputManager {
  private keyStates: Map<KeyCode, boolean> = new Map();
  private keyQueue: KeyCode[] = [];

  public pressKey(key: KeyCode) {
    console.log(`Input: Key Down - ${key}`);
    this.keyStates.set(key, true);
    this.keyQueue.push(key);
  }

  public releaseKey(key: KeyCode) {
    console.log(`Input: Key Up - ${key}`);
    this.keyStates.set(key, false);
  }

  public isKeyDown(key: KeyCode): boolean {
    return this.keyStates.get(key) || false;
  }

  public pollNextKey(): KeyCode | undefined {
    return this.keyQueue.shift();
  }

  public clearQueue() {
    this.keyQueue = [];
  }
}
