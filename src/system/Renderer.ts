/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { COLORS, LAYOUT, FONTS } from './Theme';
import { IconManager, SVG_ICONS } from './IconManager';
import { TextEngine, TextLayout } from './TextEngine';

export { COLORS };

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private iconManager: IconManager;
  private textEngine: TextEngine;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.ctx.imageSmoothingEnabled = false;
    this.iconManager = new IconManager();
    this.textEngine = new TextEngine(ctx);
  }

  public clear() {
    this.ctx.fillStyle = COLORS.bg;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  public drawHeader(title: string, hasUnread: boolean) {
    this.ctx.fillStyle = COLORS.headerBg;
    this.ctx.fillRect(0, 0, this.width, LAYOUT.HEADER_HEIGHT);
    
    // Icons cluster on the right
    const iconSize = 10;
    const iconSpacing = 4;
    let currentX = this.width - LAYOUT.PADDING_X;
    
    // Battery
    currentX -= iconSize;
    this.drawIcon('BATTERY', currentX, 3, COLORS.battery, iconSize);
    
    // Signal
    currentX -= (iconSize + iconSpacing);
    this.drawIcon('SIGNAL', currentX, 3, COLORS.signal, iconSize);
    
    // Unread envelope
    if (hasUnread) {
      currentX -= (iconSize + iconSpacing);
      this.drawIcon('ENVELOPE', currentX, 3, COLORS.envelope, iconSize);
    }
    
    // Truncate title if it overlaps with icons
    const availableWidth = currentX - LAYOUT.PADDING_X - 10;
    const layout = this.computeTextLayout(title, availableWidth, FONTS.SIZE_SMALL, FONTS.SANS, 12, true, false, true); // aggressive=true for ellipsis
    this.drawTextLayout(layout, LAYOUT.PADDING_X, (LAYOUT.HEADER_HEIGHT - 12) / 2, COLORS.headerText, FONTS.SIZE_SMALL, FONTS.SANS, true);
  }

  public drawSoftKeys(left: string, right: string) {
    this.ctx.fillStyle = COLORS.footerBg;
    this.ctx.fillRect(0, this.height - LAYOUT.FOOTER_HEIGHT, this.width, LAYOUT.FOOTER_HEIGHT);
    
    const leftLayout = this.computeTextLayout(left, this.width / 2, FONTS.SIZE_TINY, FONTS.SANS, 10, true);
    this.drawTextLayout(leftLayout, LAYOUT.PADDING_X, this.height - (LAYOUT.FOOTER_HEIGHT + 10) / 2, COLORS.footerText, FONTS.SIZE_TINY, FONTS.SANS, true);
    
    const rightLayout = this.computeTextLayout(right, this.width / 2, FONTS.SIZE_TINY, FONTS.SANS, 10, true);
    // For right alignment in TextEngine, we'd need to adjust X. 
    // Since TextEngine doesn't support alignment yet, I'll calculate X.
    const rightX = this.width - LAYOUT.PADDING_X - rightLayout.maxWidth;
    this.drawTextLayout(rightLayout, rightX, this.height - (LAYOUT.FOOTER_HEIGHT + 10) / 2, COLORS.footerText, FONTS.SIZE_TINY, FONTS.SANS, true);
  }

  public text(text: string, x: number, y: number, color = COLORS.text, size = FONTS.SIZE_NORMAL, bold = false, family = FONTS.SANS, align: CanvasTextAlign = 'left') {
    this.ctx.fillStyle = color;
    this.ctx.font = `${bold ? 'bold' : ''} ${size} ${family}`;
    this.ctx.textBaseline = "alphabetic";
    this.ctx.textAlign = align;
    this.ctx.fillText(text, x, y);
  }

  public drawRect(x: number, y: number, w: number, h: number, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  public drawImage(img: HTMLImageElement, x: number, y: number, w: number, h: number) {
    this.ctx.drawImage(img, x, y, w, h);
  }

  public async drawIcon(name: keyof typeof SVG_ICONS, x: number, y: number, color?: string, size?: number) {
    try {
      const img = await this.iconManager.getIcon(name, color, size);
      this.ctx.drawImage(img, x, y);
    } catch (e) {
      this.drawRect(x, y, size || 10, size || 10, color || COLORS.accent);
    }
  }

  public async cacheIcons(color: string, size: number) {
    const promises = Object.keys(SVG_ICONS).map(name => 
      this.iconManager.getIcon(name as keyof typeof SVG_ICONS, color, size)
    );
    await Promise.all(promises);
  }

  public computeTextLayout(text: string, maxWidth: number, fontSize = FONTS.SIZE_NORMAL, fontFamily = FONTS.SANS, lineHeight = LAYOUT.LINE_HEIGHT, bold = false, aggressive = false, truncate = false): TextLayout {
    return this.textEngine.computeLayout(text, maxWidth, fontSize, fontFamily, lineHeight, bold, aggressive, truncate);
  }

  public drawTextLayout(layout: TextLayout, x: number, y: number, color = COLORS.text, fontSize = FONTS.SIZE_NORMAL, fontFamily = FONTS.SANS, bold = false) {
    this.textEngine.drawLayout(layout, x, y, color, fontSize, fontFamily, bold);
  }

  public setClip(x: number, y: number, w: number, h: number) {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.ctx.clip();
  }

  public clearClip() {
    this.ctx.restore();
  }

  public drawScrollbar(x: number, y: number, w: number, h: number, totalHeight: number, viewportHeight: number, scrollY: number) {
    if (totalHeight <= viewportHeight) return;
    
    const barHeight = Math.max(4, (viewportHeight / totalHeight) * h);
    const barY = y + (scrollY / (totalHeight - viewportHeight)) * (h - barHeight);
    
    this.drawRect(x, y, w, h, 'rgba(0,0,0,0.1)');
    this.drawRect(x, barY, w, barHeight, 'rgba(0,0,0,0.4)');
  }
}
