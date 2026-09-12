import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  analyzeContrast,
  getContrastScore,
  isLowContrast,
} from '../src';

describe('contrast-score test suite', () => {
  let solidBlackBuffer: Buffer;
  let solidWhiteBuffer: Buffer;
  let solidGrayBuffer: Buffer;
  let checkerboardBuffer: Buffer;
  let highContrastTextBuffer: Buffer;
  let washedOutTextBuffer: Buffer;
  let moderateContrastBuffer: Buffer;
  let goodContrastBuffer: Buffer;
  let tempFilePath: string;

  beforeAll(async () => {
    // 1. Solid black (200x200 #000000)
    solidBlackBuffer = await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    // 2. Solid white (200x200 #ffffff)
    solidWhiteBuffer = await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .png()
      .toBuffer();

    // 3. Solid mid-gray (200x200 #808080)
    solidGrayBuffer = await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 3,
        background: { r: 128, g: 128, b: 128 },
      },
    })
      .png()
      .toBuffer();

    // 4. Pure black & white 50/50 split (half black, half white)
    const splitSvg = Buffer.from(`
      <svg width="200" height="200">
        <rect x="0" y="0" width="100" height="200" fill="black" />
        <rect x="100" y="0" width="100" height="200" fill="white" />
      </svg>
    `);
    checkerboardBuffer = await sharp(splitSvg).png().toBuffer();

    // 5. High-contrast document mockup: Crisp black text lines on clean white background
    const highContrastSvg = Buffer.from(`
      <svg width="400" height="300">
        <rect x="0" y="0" width="400" height="300" fill="#ffffff" />
        <!-- Simulated text lines -->
        <rect x="30" y="40" width="340" height="15" fill="#000000" />
        <rect x="30" y="70" width="310" height="15" fill="#000000" />
        <rect x="30" y="100" width="350" height="15" fill="#000000" />
        <rect x="30" y="130" width="280" height="15" fill="#000000" />
        <rect x="30" y="160" width="330" height="15" fill="#000000" />
        <rect x="30" y="190" width="290" height="15" fill="#000000" />
        <rect x="30" y="220" width="340" height="15" fill="#000000" />
        <rect x="30" y="250" width="200" height="15" fill="#000000" />
      </svg>
    `);
    highContrastTextBuffer = await sharp(highContrastSvg).png().toBuffer();

    // 6. Low-contrast / washed-out document: Faint text on washed-out background
    // Background: #c8c8c8 (200), Text: #ababab (171) -> delta only ~29
    const washedOutSvg = Buffer.from(`
      <svg width="400" height="300">
        <rect x="0" y="0" width="400" height="300" fill="#c8c8c8" />
        <rect x="30" y="40" width="340" height="15" fill="#ababab" />
        <rect x="30" y="70" width="310" height="15" fill="#ababab" />
        <rect x="30" y="100" width="350" height="15" fill="#ababab" />
        <rect x="30" y="130" width="280" height="15" fill="#ababab" />
        <rect x="30" y="160" width="330" height="15" fill="#ababab" />
        <rect x="30" y="190" width="290" height="15" fill="#ababab" />
        <rect x="30" y="220" width="340" height="15" fill="#ababab" />
      </svg>
    `);
    washedOutTextBuffer = await sharp(washedOutSvg).png().toBuffer();

    // 7. Moderate / fair contrast: background 220, text 115 (delta 105)
    const moderateSvg = Buffer.from(`
      <svg width="400" height="300">
        <rect x="0" y="0" width="400" height="300" fill="#dcdcdc" />
        <rect x="30" y="40" width="340" height="15" fill="#737373" />
        <rect x="30" y="70" width="310" height="15" fill="#737373" />
        <rect x="30" y="100" width="350" height="15" fill="#737373" />
        <rect x="30" y="130" width="280" height="15" fill="#737373" />
        <rect x="30" y="160" width="330" height="15" fill="#737373" />
      </svg>
    `);
    moderateContrastBuffer = await sharp(moderateSvg).png().toBuffer();

    // 8. Good contrast: background 240, text 60 (delta 180)
    const goodSvg = Buffer.from(`
      <svg width="400" height="300">
        <rect x="0" y="0" width="400" height="300" fill="#f0f0f0" />
        <rect x="30" y="40" width="340" height="15" fill="#3c3c3c" />
        <rect x="30" y="70" width="310" height="15" fill="#3c3c3c" />
        <rect x="30" y="100" width="350" height="15" fill="#3c3c3c" />
        <rect x="30" y="130" width="280" height="15" fill="#3c3c3c" />
        <rect x="30" y="160" width="330" height="15" fill="#3c3c3c" />
      </svg>
    `);
    goodContrastBuffer = await sharp(goodSvg).png().toBuffer();

    // 9. Temporary file on disk for file-path tests
    tempFilePath = path.join(os.tmpdir(), `contrast-test-${Date.now()}.png`);
    await fs.writeFile(tempFilePath, highContrastTextBuffer);
  });

  afterAll(async () => {
    try {
      await fs.unlink(tempFilePath);
    } catch {
      // Ignore cleanup error
    }
  });

  it('1. should evaluate solid black image as flat zero contrast', async () => {
    const result = await analyzeContrast(solidBlackBuffer);
    expect(result.score).toBe(0);
    expect(result.michelsonContrast).toBe(0);
    expect(result.rmsContrast).toBe(0);
    expect(result.histogramSpread).toBe(0);
    expect(result.isLowContrast).toBe(true);
    expect(result.quality).toBe('poor');
  });

  it('2. should evaluate solid white image as flat zero contrast', async () => {
    const result = await analyzeContrast(solidWhiteBuffer);
    expect(result.score).toBe(0);
    expect(result.michelsonContrast).toBe(0);
    expect(result.rmsContrast).toBe(0);
    expect(result.histogramSpread).toBe(0);
    expect(result.isLowContrast).toBe(true);
    expect(result.quality).toBe('poor');
  });

  it('3. should evaluate solid mid-gray image as flat zero contrast', async () => {
    const result = await analyzeContrast(solidGrayBuffer);
    expect(result.score).toBe(0);
    expect(result.michelsonContrast).toBe(0);
    expect(result.rmsContrast).toBe(0);
    expect(result.histogramSpread).toBe(0);
    expect(result.isLowContrast).toBe(true);
    expect(result.quality).toBe('poor');
  });

  it('4. should evaluate pure black & white split as maximum contrast', async () => {
    const result = await analyzeContrast(checkerboardBuffer);
    expect(result.score).toBe(1.0);
    expect(result.michelsonContrast).toBe(1.0);
    expect(result.rmsContrast).toBeCloseTo(0.5, 2);
    expect(result.histogramSpread).toBe(1.0);
    expect(result.isLowContrast).toBe(false);
    expect(result.quality).toBe('excellent');
  });

  it('5. should classify high-contrast text document as excellent quality', async () => {
    const result = await analyzeContrast(highContrastTextBuffer);
    expect(result.score).toBeGreaterThanOrEqual(0.7);
    expect(result.michelsonContrast).toBeGreaterThan(0.85);
    expect(result.histogramSpread).toBeGreaterThan(0.85);
    expect(result.isLowContrast).toBe(false);
    expect(result.quality).toBe('excellent');
  });

  it('6. should detect low-contrast washed-out document as poor and isLowContrast=true', async () => {
    const result = await analyzeContrast(washedOutTextBuffer);
    expect(result.score).toBeLessThan(0.3);
    expect(result.isLowContrast).toBe(true);
    expect(result.quality).toBe('poor');
    expect(result.histogramSpread).toBeLessThan(0.2);
  });

  it('7. should correctly classify moderate/fair contrast image', async () => {
    const result = await analyzeContrast(moderateContrastBuffer);
    expect(result.score).toBeGreaterThanOrEqual(0.3);
    expect(result.score).toBeLessThan(0.5);
    expect(result.quality).toBe('fair');
    expect(result.isLowContrast).toBe(false);
  });

  it('8. should correctly classify good contrast document', async () => {
    const result = await analyzeContrast(goodContrastBuffer);
    expect(result.score).toBeGreaterThanOrEqual(0.5);
    expect(result.quality).toMatch(/^(good|excellent)$/);
    expect(result.isLowContrast).toBe(false);
  });

  it('9. getContrastScore should return matching numeric score', async () => {
    const fullResult = await analyzeContrast(highContrastTextBuffer);
    const score = await getContrastScore(highContrastTextBuffer);
    expect(score).toBe(fullResult.score);
    expect(typeof score).toBe('number');
  });

  it('10. isLowContrast convenience method should return true for washed-out and false for sharp text', async () => {
    const isWashedOut = await isLowContrast(washedOutTextBuffer);
    expect(isWashedOut).toBe(true);

    const isHigh = await isLowContrast(highContrastTextBuffer);
    expect(isHigh).toBe(false);
  });

  it('11. isLowContrast should support custom numeric threshold', async () => {
    // With strict threshold 0.7, moderateContrast (score ~0.44) is flagged as low contrast
    const strictFail = await isLowContrast(moderateContrastBuffer, 0.7);
    expect(strictFail).toBe(true);

    // With lenient threshold 0.05, washed-out (score ~0.11) passes
    const lenientPass = await isLowContrast(washedOutTextBuffer, 0.05);
    expect(lenientPass).toBe(false);
  });

  it('12. isLowContrast should support options object', async () => {
    const passed = await isLowContrast(washedOutTextBuffer, { threshold: 0.05 });
    expect(passed).toBe(false);
  });

  it('13. should handle file path string input seamlessly', async () => {
    const fileResult = await analyzeContrast(tempFilePath);
    const bufResult = await analyzeContrast(highContrastTextBuffer);

    expect(fileResult.score).toBe(bufResult.score);
    expect(fileResult.quality).toBe(bufResult.quality);
  });

  it('14. should handle Uint8Array input identically to Buffer', async () => {
    const uint8 = new Uint8Array(highContrastTextBuffer);
    const result = await analyzeContrast(uint8);
    expect(result.score).toBeGreaterThanOrEqual(0.7);
    expect(result.quality).toBe('excellent');
  });

  it('15. should support downsampling with maxDimension', async () => {
    const smallResult = await analyzeContrast(highContrastTextBuffer, {
      maxDimension: 128,
    });
    expect(smallResult.details?.width).toBeLessThanOrEqual(128);
    expect(smallResult.details?.height).toBeLessThanOrEqual(128);
    expect(smallResult.quality).toBe('excellent');
  });

  it('16. should support disabling downsampling with maxDimension: null', async () => {
    const fullResResult = await analyzeContrast(highContrastTextBuffer, {
      maxDimension: null,
    });
    expect(fullResResult.details?.width).toBe(400);
    expect(fullResResult.details?.height).toBe(300);
  });

  it('17. should support downsampleWidth alias for backward compatibility', async () => {
    const aliasResult = await analyzeContrast(highContrastTextBuffer, {
      downsampleWidth: 100,
    });
    expect(aliasResult.details?.width).toBeLessThanOrEqual(100);
  });

  it('18. should support custom percentiles [0, 100]', async () => {
    const customResult = await analyzeContrast(highContrastTextBuffer, {
      percentiles: [0, 100],
    });
    expect(customResult.details?.minLuminance).toBe(customResult.details?.absoluteMinLuminance);
    expect(customResult.details?.maxLuminance).toBe(customResult.details?.absoluteMaxLuminance);
  });

  it('19. should reject invalid image input types with TypeError', async () => {
    // @ts-expect-error Testing invalid runtime input
    await expect(analyzeContrast(null)).rejects.toThrow(TypeError);
    // @ts-expect-error Testing invalid runtime input
    await expect(analyzeContrast(undefined)).rejects.toThrow(TypeError);
    // @ts-expect-error Testing invalid runtime input
    await expect(analyzeContrast(12345)).rejects.toThrow(TypeError);
    // @ts-expect-error Testing invalid runtime input
    await expect(analyzeContrast({})).rejects.toThrow(TypeError);
  });

  it('20. should reject empty string or empty buffer with Error', async () => {
    await expect(analyzeContrast('')).rejects.toThrow(/file path string cannot be empty/i);
    await expect(analyzeContrast('   ')).rejects.toThrow(/file path string cannot be empty/i);
    await expect(analyzeContrast(Buffer.alloc(0))).rejects.toThrow(/buffer cannot be empty/i);
    await expect(analyzeContrast(new Uint8Array(0))).rejects.toThrow(/buffer cannot be empty/i);
  });

  it('21. should reject invalid options with RangeError', async () => {
    await expect(analyzeContrast(highContrastTextBuffer, { threshold: -0.1 })).rejects.toThrow(RangeError);
    await expect(analyzeContrast(highContrastTextBuffer, { threshold: 1.5 })).rejects.toThrow(RangeError);
    await expect(analyzeContrast(highContrastTextBuffer, { maxDimension: 10 })).rejects.toThrow(RangeError);
    // @ts-expect-error Testing invalid percentiles
    await expect(analyzeContrast(highContrastTextBuffer, { percentiles: [90, 10] })).rejects.toThrow(RangeError);
    // @ts-expect-error Testing invalid percentiles
    await expect(analyzeContrast(highContrastTextBuffer, { percentiles: [-5, 105] })).rejects.toThrow(RangeError);
  });

  it('22. should execute sub-millisecond to low-millisecond downsampled performance benchmark', async () => {
    // Warm up
    await analyzeContrast(highContrastTextBuffer);

    const start = performance.now();
    const iterations = 20;
    for (let i = 0; i < iterations; i++) {
      await analyzeContrast(highContrastTextBuffer);
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / iterations;

    // Average execution time should be under 20ms in Node.js
    expect(avgMs).toBeLessThan(20);
  });
});
