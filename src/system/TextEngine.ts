/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FONTS } from './Theme';

export interface TextLine {
  text: string;
  y: number;
  width: number;
}

export interface TextLayout {
  lines: TextLine[];
  totalHeight: number;
  maxWidth: number;
}

export class TextEngine {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  public computeLayout(
    text: string,
    maxWidth: number,
    fontSize: string = FONTS.SIZE_NORMAL,
    fontFamily: string = FONTS.SANS,
    lineHeight: number = 12,
    bold: boolean = false,
    aggressive: boolean = false,
    truncate: boolean = false
  ): TextLayout {
    this.ctx.font = `${bold ? 'bold' : ''} ${fontSize} ${fontFamily}`;
    
    if (truncate) {
      const metrics = this.ctx.measureText(text);
      if (metrics.width > maxWidth) {
        let truncated = text;
        while (truncated.length > 0 && this.ctx.measureText(truncated + "...").width > maxWidth) {
          truncated = truncated.substring(0, truncated.length - 1);
        }
        const finalMetrics = this.ctx.measureText(truncated + "...");
        return {
          lines: [{ text: truncated + "...", y: 0, width: finalMetrics.width }],
          totalHeight: lineHeight,
          maxWidth: finalMetrics.width
        };
      }
    }

    const lines: TextLine[] = [];
    const paragraphs = text.split('\n');
    let currentY = 0;
    let actualMaxWidth = 0;

    for (const paragraph of paragraphs) {
      if (paragraph.trim() === '') {
        currentY += lineHeight;
        continue;
      }

      const words = paragraph.split(' ');
      let currentLine = '';

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = this.ctx.measureText(testLine);

        if (metrics.width > maxWidth && currentLine !== '') {
          // Push current line
          const lineMetrics = this.ctx.measureText(currentLine);
          lines.push({ text: currentLine, y: currentY, width: lineMetrics.width });
          actualMaxWidth = Math.max(actualMaxWidth, lineMetrics.width);
          
          currentY += lineHeight;
          currentLine = word;

          // Aggressive wrapping for single long words
          if (aggressive) {
            while (this.ctx.measureText(currentLine).width > maxWidth) {
              let charIdx = 1;
              while (this.ctx.measureText(currentLine.substring(0, charIdx + 1)).width <= maxWidth) {
                charIdx++;
              }
              const part = currentLine.substring(0, charIdx);
              const partMetrics = this.ctx.measureText(part);
              lines.push({ text: part, y: currentY, width: partMetrics.width });
              actualMaxWidth = Math.max(actualMaxWidth, partMetrics.width);
              
              currentY += lineHeight;
              currentLine = currentLine.substring(charIdx);
            }
          }
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine !== '') {
        const lineMetrics = this.ctx.measureText(currentLine);
        lines.push({ text: currentLine, y: currentY, width: lineMetrics.width });
        actualMaxWidth = Math.max(actualMaxWidth, lineMetrics.width);
        currentY += lineHeight;
      }
    }

    return {
      lines,
      totalHeight: currentY,
      maxWidth: actualMaxWidth
    };
  }

  public drawLayout(
    layout: TextLayout,
    x: number,
    y: number,
    color: string,
    fontSize: string = FONTS.SIZE_NORMAL,
    fontFamily: string = FONTS.SANS,
    bold: boolean = false
  ) {
    this.ctx.fillStyle = color;
    this.ctx.font = `${bold ? 'bold' : ''} ${fontSize} ${fontFamily}`;
    this.ctx.textBaseline = 'top';
    this.ctx.textAlign = 'left';

    for (const line of layout.lines) {
      this.ctx.fillText(line.text, x, y + line.y);
    }
  }
}
