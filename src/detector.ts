import sharp from 'sharp';
import type { ContrastOptions, ContrastResult } from './types';
import {
  getPercentileFromHistogram,
  normalizeOptions,
  roundTo,
  validateInput,
} from './utils';

/**
 * Analyzes image and document contrast quality using Michelson contrast,
 * RMS contrast, and luminance histogram distribution via Sharp.
 *
 * @param input - File path string, Buffer, or Uint8Array representing an image.
 * @param options - Optional configuration options.
 * @returns Promise resolving to a detailed ContrastResult.
 */
export async function analyzeContrast(
  input: string | Buffer | Uint8Array,
  options?: ContrastOptions
): Promise<ContrastResult> {
  validateInput(input);
  const opts = normalizeOptions(options);

  let pipeline = sharp(input);

  if (opts.maxDimension !== null) {
    pipeline = pipeline.resize({
      width: opts.maxDimension,
      height: opts.maxDimension,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  const { data, info } = await pipeline
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const totalPixels = width * height;

  if (totalPixels === 0) {
    throw new Error('Image contains no pixel data.');
  }

  // 1. Build 256-bin luminance histogram & calculate basic stats
  const histogram = new Uint32Array(256);
  let luminanceSum = 0;
  let absoluteMin = 255;
  let absoluteMax = 0;

  for (let i = 0; i < totalPixels; i++) {
    const lum = data[i]!;
    histogram[lum]++;
    luminanceSum += lum;
    if (lum < absoluteMin) absoluteMin = lum;
    if (lum > absoluteMax) absoluteMax = lum;
  }

  const meanLuminance = luminanceSum / totalPixels;

  // Handle completely flat / solid image (zero variance)
  if (absoluteMin === absoluteMax) {
    const isLow = 0.0 < opts.threshold;
    return {
      score: 0.0,
      michelsonContrast: 0.0,
      rmsContrast: 0.0,
      isLowContrast: isLow,
      quality: 'poor',
      histogramSpread: 0.0,
      details: {
        meanLuminance: roundTo(meanLuminance, 2),
        minLuminance: absoluteMin,
        maxLuminance: absoluteMax,
        absoluteMinLuminance: absoluteMin,
        absoluteMaxLuminance: absoluteMax,
        stdDev: 0.0,
        width,
        height,
        totalPixels,
      },
    };
  }

  // 2. Standard deviation and RMS contrast calculation
  let varianceSum = 0;
  for (let k = 0; k < 256; k++) {
    const count = histogram[k]!;
    if (count > 0) {
      const diff = k - meanLuminance;
      varianceSum += diff * diff * count;
    }
  }

  const variance = varianceSum / totalPixels;
  const stdDev = Math.sqrt(variance);

  // RMS contrast: standard deviation of normalized luminance [0, 1]
  const rmsContrast = roundTo(stdDev / 255.0, 4);

  // 3. Percentile clipping for robust bounds (filters sensor noise & hot/dead pixels)
  const pLow = opts.percentiles[0];
  const pHigh = opts.percentiles[1];
  const minLuminance = getPercentileFromHistogram(histogram, totalPixels, pLow);
  const maxLuminance = getPercentileFromHistogram(histogram, totalPixels, pHigh);

  // 4. Michelson contrast: (Lmax - Lmin) / (Lmax + Lmin)
  let michelsonContrast = 0.0;
  const lumSum = maxLuminance + minLuminance;
  if (lumSum > 0) {
    michelsonContrast = roundTo((maxLuminance - minLuminance) / lumSum, 4);
  }

  // 5. Histogram spread: (Lmax - Lmin) / 255.0
  const histogramSpread = roundTo((maxLuminance - minLuminance) / 255.0, 4);

  // 6. Balanced composite contrast score (0.0 to 1.0)
  // Text contrast documents have naturally sparse dark ink (~5-25% coverage).
  // stdDev / 64.0 normalizes RMS contrast for typical document text distribution.
  const normalizedRms = Math.min(1.0, stdDev / 64.0);
  const compositeScore = Math.min(
    1.0,
    Math.max(
      0.0,
      0.4 * histogramSpread + 0.35 * michelsonContrast + 0.25 * normalizedRms
    )
  );
  const score = roundTo(compositeScore, 4);

  // 7. Qualitative classification
  let quality: 'excellent' | 'good' | 'fair' | 'poor';
  if (score >= 0.7) {
    quality = 'excellent';
  } else if (score >= 0.5) {
    quality = 'good';
  } else if (score >= 0.3) {
    quality = 'fair';
  } else {
    quality = 'poor';
  }

  const isLowContrast = score < opts.threshold;

  return {
    score,
    michelsonContrast,
    rmsContrast,
    isLowContrast,
    quality,
    histogramSpread,
    details: {
      meanLuminance: roundTo(meanLuminance, 2),
      minLuminance,
      maxLuminance,
      absoluteMinLuminance: absoluteMin,
      absoluteMaxLuminance: absoluteMax,
      stdDev: roundTo(stdDev, 2),
      width,
      height,
      totalPixels,
    },
  };
}

/**
 * Convenience method returning a single normalized contrast score (0.0 to 1.0).
 *
 * @param input - File path, Buffer, or Uint8Array.
 * @param options - Optional contrast options.
 * @returns Promise resolving to a number between 0.0 and 1.0.
 */
export async function getContrastScore(
  input: string | Buffer | Uint8Array,
  options?: ContrastOptions
): Promise<number> {
  const result = await analyzeContrast(input, options);
  return result.score;
}

/**
 * Convenience method checking whether an image suffers from low contrast.
 *
 * @param input - File path, Buffer, or Uint8Array.
 * @param thresholdOrOptions - Score threshold (default 0.3) or full ContrastOptions object.
 * @returns Promise resolving to true if score < threshold.
 */
export async function isLowContrast(
  input: string | Buffer | Uint8Array,
  thresholdOrOptions?: number | ContrastOptions
): Promise<boolean> {
  let opts: ContrastOptions | undefined;
  if (typeof thresholdOrOptions === 'number') {
    opts = { threshold: thresholdOrOptions };
  } else if (thresholdOrOptions && typeof thresholdOrOptions === 'object') {
    opts = thresholdOrOptions;
  }
  const result = await analyzeContrast(input, opts);
  return result.isLowContrast;
}
