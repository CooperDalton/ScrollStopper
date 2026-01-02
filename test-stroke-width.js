// Test the stroke width calculation function
const FONT_SIZES = [12, 16, 20, 24, 32, 40, 48, 56, 64];
const STROKE_WIDTHS = [0.25, 0.5, 0.5, 0.75, 0.85, 1, 1, 1.25, 1.5];

const getStrokeWidthForFontSize = (fontSize) => {
  const index = FONT_SIZES.indexOf(fontSize);
  if (index !== -1) {
    return STROKE_WIDTHS[index];
  }

  // For scaled font sizes not in the predefined list, interpolate proportionally
  if (fontSize < FONT_SIZES[0]) {
    return STROKE_WIDTHS[0];
  }

  if (fontSize > FONT_SIZES[FONT_SIZES.length - 1]) {
    const baseSize = FONT_SIZES[FONT_SIZES.length - 1];
    const baseStroke = STROKE_WIDTHS[STROKE_WIDTHS.length - 1];
    const scaleFactor = fontSize / baseSize;
    return Math.max(baseStroke * scaleFactor, baseStroke);
  }

  // Interpolate between the two closest font sizes
  let lowerIndex = 0;
  let upperIndex = FONT_SIZES.length - 1;

  for (let i = 0; i < FONT_SIZES.length - 1; i++) {
    if (fontSize >= FONT_SIZES[i] && fontSize <= FONT_SIZES[i + 1]) {
      lowerIndex = i;
      upperIndex = i + 1;
      break;
    }
  }

  const lowerSize = FONT_SIZES[lowerIndex];
  const upperSize = FONT_SIZES[upperIndex];
  const lowerStroke = STROKE_WIDTHS[lowerIndex];
  const upperStroke = STROKE_WIDTHS[upperIndex];

  const ratio = (fontSize - lowerSize) / (upperSize - lowerSize);
  return lowerStroke + (upperStroke - lowerStroke) * ratio;
};
