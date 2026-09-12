/**
 * Granular luminance and image geometry details.
 */
export interface ContrastDetails {
  /**
   * Average pixel luminance across the image (0.0 to 255.0).
   */
  meanLuminance: number;

  /**
   * Effective minimum luminance (P_low) after percentile clipping (0 to 255).
   */
  minLuminance: number;

  /**
   * Effective maximum luminance (P_high) after percentile clipping (0 to 255).
   */
  maxLuminance: number;

  /**
   * Absolute minimum luminance in raw pixel data (0 to 255).
   */
  absoluteMinLuminance: number;

  /**
   * Absolute maximum luminance in raw pixel data (0 to 255).
   */
  absoluteMaxLuminance: number;

  /**
   * Raw standard deviation of luminance across all pixels (0.0 to 127.5).
   */
  stdDev: number;

  /**
   * Width of the analyzed image in pixels after downsampling.
   */
  width: number;

  /**
   * Height of the analyzed image in pixels after downsampling.
   */
  height: number;

  /**
   * Total number of pixels analyzed.
   */
  totalPixels: number;
}

/**
 * Configuration options for contrast evaluation.
 */
export interface ContrastOptions {
  /**
   * Contrast score threshold below which an image is considered low contrast.
   * If `score < threshold`, `isLowContrast` evaluates to `true`.
   * @default 0.3
   */
  threshold?: number;

  /**
   * Target maximum dimension (width or height) to downsample the image before analysis,
   * maintaining aspect ratio. Enables blazing sub-millisecond execution speeds while
   * preserving global tonal distribution.
   * Pass `null` or `0` to disable downsampling and process at native resolution.
   * @default 256
   */
  maxDimension?: number | null;

  /**
   * Alternative alias for `maxDimension` for API consistency across companion libraries.
   */
  downsampleWidth?: number;

  /**
   * Percentile range [low, high] for robust luminance bounds to filter outlier hot/dead pixels.
   * E.g. `[1, 99]` calculates Lmin at the 1st percentile and Lmax at the 99th percentile.
   * Set to `[0, 100]` for strict absolute min/max.
   * @default [1, 99]
   */
  percentiles?: [number, number];
}

/**
 * Comprehensive result of image contrast analysis.
 */
export interface ContrastResult {
  /**
   * Overall normalized contrast quality score from 0.0 (flat/washed out) to 1.0 (high contrast).
   */
  score: number;

  /**
   * Michelson contrast ratio: (Lmax - Lmin) / (Lmax + Lmin), bounded [0.0, 1.0].
   * Evaluates dynamic range span relative to total luminance.
   */
  michelsonContrast: number;

  /**
   * Root Mean Square (RMS) contrast: standard deviation of normalized luminance [0.0, 1.0].
   */
  rmsContrast: number;

  /**
   * Whether the image falls below the acceptable contrast threshold (`score < threshold`).
   */
  isLowContrast: boolean;

  /**
   * Qualitative contrast classification:
   * - `'excellent'`: High dynamic range, crisp text separation (>= 0.70).
   * - `'good'`: Clear tonal separation, fully suitable for OCR (0.50 to < 0.70).
   * - `'fair'`: Moderate contrast, readable but degraded (0.30 to < 0.50).
   * - `'poor'`: Washed out, faded, or flat lighting (< 0.30).
   */
  quality: 'excellent' | 'good' | 'fair' | 'poor';

  /**
   * Normalized spread of the luminance histogram: (P_high - P_low) / 255.0, bounded [0.0, 1.0].
   */
  histogramSpread: number;

  /**
   * Optional granular luminance distribution metrics and image geometry diagnostics.
   */
  details?: ContrastDetails;
}
