/**
 * Text styling configuration for slideshows
 * Used by both the AI generator and the slideshow editor to ensure consistency
 */

// Available font sizes in ascending order
export const FONT_SIZES = [12, 16, 20, 24, 32, 40, 48, 56, 64] as const

// Corresponding stroke widths for each font size
//export const STROKE_WIDTHS = [0.25, 0.5, 0.5, 0.75, 1, 1, 1, 1.25, 1.5] as const
export const STROKE_WIDTHS = [0.25, 0.5, 0.5, 0.75, 0.85, 1, 1, 1.25, 1.5] as const

// Maximum characters per line for each font size
//export const MAX_CHARS_PER_LINE = [54, 40, 34, 30, 26, 22, 18, 14, 10] as const
export const MAX_CHARS_PER_LINE = [40, 32, 26, 20, 18, 16, 14, 10, 6] as const

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

/**
 * Get complete text styling configuration for fabric.js text objects
 * This function provides all styling properties needed for consistent text rendering
 */
export const getTextStyling = (fontSize: number = 24) => ({
  ...TEXT_STYLING,
  originX: 'center' as const,
  originY: 'center' as const,
  stroke: 'black',
  strokeWidth: getStrokeWidthForFontSize(fontSize),
  charSpacing: -60,
  lineHeight: 0.8,
  fontSize,
})

/**
 * Text bounds calculation utilities
 * These help prevent text from being positioned offscreen by calculating
 * the actual dimensions text will occupy on the canvas
 */

// Approximate character width multipliers for different font sizes
// These are conservative estimates based on the "proxima-nova" font family
const CHAR_WIDTH_MULTIPLIERS = [0.3, 0.35, 0.4, 0.45, 0.5, 0.52, 0.54, 0.56, 0.58] as const

export const getCharWidthMultiplier = (fontSize: number): number => {
  const index = FONT_SIZES.indexOf(fontSize as FontSize)
  return index !== -1 ? CHAR_WIDTH_MULTIPLIERS[index] : 0.45 // Conservative default
}

/**
 * Estimate the width of text in pixels based on font size and character count
 * This is an approximation used for layout calculations
 */
export const estimateTextWidth = (text: string, fontSize: number): number => {
  // Split by line breaks and get the longest line
  const lines = text.split('\n')
  const longestLine = lines.reduce((longest, line) => 
    line.length > longest.length ? line : longest, '')
  
  const charWidthMultiplier = getCharWidthMultiplier(fontSize)
  const estimatedWidth = Math.ceil(longestLine.length * fontSize * charWidthMultiplier)
  
  // Safety constraint: never estimate width larger than reasonable canvas usage (80%)
  const maxReasonableWidth = 240 // 80% of 300px canvas width
  return Math.min(estimatedWidth, maxReasonableWidth)
}

/**
 * Estimate the height of text in pixels based on font size and line count
 */
export const estimateTextHeight = (text: string, fontSize: number): number => {
  const lineCount = text.split('\n').length
  const lineHeight = fontSize * 1.0 // Based on lineHeight in getTextStyling
  return Math.ceil(lineCount * lineHeight)
}

/**
 * Calculate safe positioning bounds for text to prevent offscreen placement
 * Returns the valid coordinate ranges for position_x and position_y
 */
export const getSafeTextBounds = (
  text: string, 
  fontSize: number, 
  canvasWidth: number, 
  canvasHeight: number
): { minX: number; maxX: number; minY: number; maxY: number } => {
  const textWidth = estimateTextWidth(text, fontSize)
  const textHeight = estimateTextHeight(text, fontSize)
  
  // Since text uses center origin, we need to account for half the dimensions
  const halfWidth = textWidth / 2
  const halfHeight = textHeight / 2
  
  // Add some padding to ensure text doesn't touch canvas edges
  const padding = Math.max(fontSize * 0.25, 10)
  
  return {
    minX: halfWidth + padding,
    maxX: canvasWidth - halfWidth - padding,
    minY: halfHeight + padding, 
    maxY: canvasHeight - halfHeight - padding
  }
}

/**
 * Validate and adjust text position to keep it within safe bounds
 */
export const validateTextPosition = (
  text: string,
  fontSize: number,
  positionX: number,
  positionY: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number; adjusted: boolean } => {
  const bounds = getSafeTextBounds(text, fontSize, canvasWidth, canvasHeight)
  
  const adjustedX = Math.max(bounds.minX, Math.min(bounds.maxX, positionX))
  const adjustedY = Math.max(bounds.minY, Math.min(bounds.maxY, positionY))
  
  const adjusted = adjustedX !== positionX || adjustedY !== positionY
  
  return { x: adjustedX, y: adjustedY, adjusted }
}
