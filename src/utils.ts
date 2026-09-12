import type { ContrastOptions } from './types';

export interface NormalizedContrastOptions {
  threshold: number;
  maxDimension: number | null;
  percentiles: [number, number];
}

/**
 * Validates the image input parameter.
 */
export function validateInput(input: unknown): void {
  if (input === null || input === undefined) {
    throw new TypeError('Invalid image input: input must be a file path string, Buffer, or Uint8Array.');
  }

  if (typeof input === 'string') {
    if (input.trim().length === 0) {
      throw new Error('Invalid image input: file path string cannot be empty.');
    }
    return;
  }

  if (Buffer.isBuffer(input) || input instanceof Uint8Array) {
    if (input.length === 0) {
      throw new Error('Invalid image input: buffer cannot be empty.');
    }
    return;
  }

  throw new TypeError('Invalid image input: expected a file path string, Buffer, or Uint8Array.');
}

/**
 * Validates and normalizes user-provided contrast options with safe defaults.
 */
export function normalizeOptions(options?: ContrastOptions): NormalizedContrastOptions {
  const threshold = options?.threshold ?? 0.3;
  let maxDimension: number | null = 256;

  if (options?.downsampleWidth !== undefined) {
    maxDimension = options.downsampleWidth;
  }
  if (options?.maxDimension !== undefined) {
    maxDimension = options.maxDimension;
  }

  const percentiles: [number, number] = options?.percentiles ?? [1, 99];

  if (typeof threshold !== 'number' || Number.isNaN(threshold) || threshold < 0 || threshold > 1) {
    throw new RangeError(`Invalid option 'threshold': expected a number between 0 and 1, got ${threshold}.`);
  }

  if (maxDimension !== null && maxDimension !== 0) {
    if (
      typeof maxDimension !== 'number' ||
      Number.isNaN(maxDimension) ||
      maxDimension < 16 ||
      !Number.isInteger(maxDimension)
    ) {
      throw new RangeError(
        `Invalid option 'maxDimension': expected null, 0, or an integer >= 16, got ${maxDimension}.`
      );
    }
  } else {
    maxDimension = null;
  }

  if (
    !Array.isArray(percentiles) ||
    percentiles.length !== 2 ||
    typeof percentiles[0] !== 'number' ||
    typeof percentiles[1] !== 'number' ||
    Number.isNaN(percentiles[0]) ||
    Number.isNaN(percentiles[1]) ||
    percentiles[0] < 0 ||
    percentiles[1] > 100 ||
    percentiles[0] >= percentiles[1]
  ) {
    throw new RangeError(
      `Invalid option 'percentiles': expected a tuple [low, high] with 0 <= low < high <= 100, got ${JSON.stringify(
        percentiles
      )}.`
    );
  }

  return {
    threshold,
    maxDimension,
    percentiles,
  };
}

/**
 * Rounds a number to a fixed number of decimal places.
 */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Computes the luminance value at a given percentile from a 256-bin histogram.
 *
 * @param histogram - Array of length 256 with pixel counts.
 * @param totalPixels - Total number of pixels.
 * @param percentile - Percentile in [0, 100].
 * @returns Luminance value in [0, 255].
 */
export function getPercentileFromHistogram(
  histogram: Uint32Array,
  totalPixels: number,
  percentile: number
): number {
  if (totalPixels === 0) return 0;

  if (percentile <= 0) {
    for (let i = 0; i < 256; i++) {
      if (histogram[i]! > 0) return i;
    }
    return 0;
  }

  if (percentile >= 100) {
    for (let i = 255; i >= 0; i--) {
      if (histogram[i]! > 0) return i;
    }
    return 255;
  }

  const targetCount = Math.ceil((percentile / 100) * totalPixels);
  let accumulated = 0;

  for (let i = 0; i < 256; i++) {
    accumulated += histogram[i]!;
    if (accumulated >= targetCount) {
      return i;
    }
  }

  return 255;
}
