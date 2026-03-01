/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputManager } from './InputManager';
import { Renderer } from './Renderer';
import { OS } from './OS';

export class Hardware {
  private input: InputManager;
  private renderer: Renderer;
  private os: OS;
  private lastTime: number = 0;
  private frameInterval: number = 1000 / 30; // 30 FPS
  private isRunning: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Could not get canvas context");

    this.input = new InputManager();
    this.renderer = new Renderer(ctx, 128, 160);
    this.os = new OS(this.input, this.renderer);
  }

  private timerId: any = null;

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    
    this.timerId = setInterval(() => {
      if (!this.isRunning) return;
      const now = performance.now();
      const dt = now - this.lastTime;
      // console.log("Hardware: Loop Tick", dt);
      this.os.update(dt);
      this.os.render();
      this.lastTime = now;
    }, 33); // ~30fps
    
    console.log("Hardware: Started loop via setInterval");
  }

  public stop() {
    this.isRunning = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    console.log("Hardware: Stopped loop");
  }

  private loop = (timestamp: number) => {
    // No longer used, but kept for compatibility if needed
  }

  public getInputManager() {
    return this.input;
  }

  public getPowerState() {
    return this.os.getPowerState();
  }

  public getOS() {
    return this.os;
  }
}
