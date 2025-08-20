/**
 * Text styling configuration for slideshows
 * Used by both the AI generator and the slideshow editor to ensure consistency
 */

// Available font sizes in ascending order
export const FONT_SIZES = [12, 16, 20, 24, 32, 40, 48, 56, 64] as const

// Corresponding stroke widths for each font size
export const STROKE_WIDTHS = [0.25, 0.5, 0.5, 0.75, 1, 1, 1, 1.25, 1.5] as const

// Maximum characters per line for each font size
export const MAX_CHARS_PER_LINE = [54, 40, 34, 30, 26, 22, 18, 14, 10] as const

// Type definitions for type safety
export type FontSize = typeof FONT_SIZES[number]
export type StrokeWidth = typeof STROKE_WIDTHS[number]

// Helper functions
export const getStrokeWidthForFontSize = (fontSize: number): number => {
  const index = FONT_SIZES.indexOf(fontSize as FontSize)
  return index !== -1 ? STROKE_WIDTHS[index] : STROKE_WIDTHS[0]
}

export const getMaxCharsForFontSize = (fontSize: number): number => {
  const index = FONT_SIZES.indexOf(fontSize as FontSize)
  return index !== -1 ? MAX_CHARS_PER_LINE[index] : MAX_CHARS_PER_LINE[0]
}

export const isValidFontSize = (fontSize: number): fontSize is FontSize => {
  return FONT_SIZES.includes(fontSize as FontSize)
}

// Font styling constants
export const TEXT_STYLING = {
  fontFamily: '"proxima-nova", sans-serif',
  fontWeight: '600',
  fontStyle: 'normal',
  fill: '#ffffff',
  textAlign: 'center' as const,
} as const
