import { Platform } from 'react-native';

// =========================================================================
// KaydBooks Design System (Phase 2)
//
// Phase 2 audit finding: BACKGROUND, SURFACE, CARD_BACKGROUND,
// SECTION_BACKGROUND and MODAL_BACKGROUND were all the literal same hex
// value (#021945) -- there was no actual visual hierarchy in the token
// file, only in whatever ad hoc gradient overlay each screen happened to
// hand-roll on top of it (a near-identical
// `rgba(250,181,0,x) -> rgba(2,25,69,y)` LinearGradient pair was copy-
// pasted, with slightly different opacities, into at least 8 different
// screens). This section keeps every existing key (nothing importing
// COLORS.* breaks) and adds real, distinct elevation tokens plus the
// gradients as named constants so new/updated screens stop hand-rolling
// their own copy of the same two colors.
// =========================================================================

export const COLORS = {
  // Main Colors
  BACKGROUND: '#021945',      // Dark blue background - ONLY background color
  SURFACE: '#0A2456',         // One step lighter than BACKGROUND -- real elevation for cards/sheets
  SURFACE_ELEVATED: '#123069', // A second, more elevated step (modals, active/selected cards)
  SURFACE_SECONDARY: '#06214F', // Subtle elevation for section/list-row backgrounds
  TEXT: '#FFFFFF',           // White text - ONLY for text
  TEXT_SECONDARY: '#CCCCCC', // Light gray for secondary text
  TEXT_MUTED: '#8C99B8',     // Muted text -- captions, placeholders, disabled labels
  BUTTON: '#FAB500',         // Yellow buttons/boxes - ONLY for interactive elements
  BUTTON_TEXT: '#021945',    // Dark blue text inside buttons
  BUTTON_LIGHT: 'rgba(250, 181, 0, 0.2)', // Light yellow for active states
  ACCENT: '#FAB500',
  ACCENT_SOFT: 'rgba(250, 181, 0, 0.14)', // Soft accent wash for chips/badges/selected rows

  // Additional Colors
  CARD_BACKGROUND: '#0A2456', // Matches SURFACE -- cards now read as elevated, not flat
  SECTION_BACKGROUND: '#021945', // Same as background (sections are not elevated, only cards are)
  MODAL_BACKGROUND: '#123069', // Matches SURFACE_ELEVATED
  SHADOW: 'rgba(0, 0, 0, 0.4)', // Real shadow, not a yellow glow, so elevation reads on dark backgrounds
  BORDER: '#26345E',
  DIVIDER: '#1B2A50',

  // Status Colors
  ERROR: '#FF6B6B',
  ERROR_LIGHT: 'rgba(255, 107, 107, 0.2)',
  WARNING: '#FFD93D',
  INFO: '#6BCF7F',
  SUCCESS: '#4CAF50',

  // Progress Colors
  PROGRESS_BACKGROUND: 'rgba(255, 255, 255, 0.15)',
  PROGRESS_FILL: '#FAB500',
};

// Named gradients so screens stop hand-rolling copies of the same pair of
// colors with slightly different opacities. Use these instead of a new
// inline `colors={[...]}` literal.
export const GRADIENTS = {
  HERO: ['rgba(250, 181, 0, 0.12)', 'rgba(2, 25, 69, 0.92)'],
  HERO_STRONG: ['rgba(250, 181, 0, 0.22)', 'rgba(2, 25, 69, 0.92)'],
  ACCENT_BUTTON: ['#FAB500', 'rgba(250, 181, 0, 0.8)'],
  SURFACE_FADE: [COLORS.BACKGROUND, 'rgba(250, 181, 0, 0.08)'],
};

export const FONTS = {
  REGULAR: 'System',
  BOLD: 'System',
  // Reading typography -- literary serif, used only inside the reader /
  // book-detail long-form copy, never in navigation chrome. No custom font
  // asset is bundled in this pass (that would be a new dependency the
  // phase brief asks to avoid unless genuinely necessary), so this maps to
  // the platform's built-in serif, which is still a deliberate, honest
  // typographic choice rather than System everywhere.
  SERIF: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
  SIZES: {
    SMALL: 12,
    MEDIUM: 14,
    LARGE: 16,
    XLARGE: 18,
    XXLARGE: 20,
    TITLE: 24,
    HEADER: 28,
  },
};

// Typography scale (Phase 2 #4). Every entry defines fontSize, lineHeight
// and fontWeight together so a screen picks one token instead of
// assembling size/weight/lineHeight separately each time.
export const TYPOGRAPHY = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: '700', letterSpacing: 0.2 },
  h1: { fontSize: 26, lineHeight: 33, fontWeight: '700', letterSpacing: 0.1 },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: 0.1 },
  h3: { fontSize: 18, lineHeight: 24, fontWeight: '600', letterSpacing: 0 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400', letterSpacing: 0 },
  bodySmall: { fontSize: 13, lineHeight: 19, fontWeight: '400', letterSpacing: 0 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0.2 },
  button: { fontSize: 15, lineHeight: 20, fontWeight: '700', letterSpacing: 0.3 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.4 },
  // Reading-content variant of `body` -- larger, serif, more generous line
  // height, because long-form reading needs different metrics than UI
  // chrome (Phase 2 #4: "reading content must prioritize readability").
  reading: { fontSize: 17, lineHeight: 27, fontWeight: '400', letterSpacing: 0.1, fontFamily: FONTS.SERIF },
};

export const SPACING = {
  XS: 4,
  SM: 8,
  SM_MD: 12,
  MD: 16,
  MD_LG: 20,
  LG: 24,
  XL: 32,
  XXL: 40,
  XXXL: 48,
};

export const BORDER_RADIUS = {
  SM: 8,
  MD: 12,
  LG: 16,
  XL: 20,
  ROUND: 50,
};

export const SHADOWS = {
  LIGHT: {
    shadowColor: COLORS.SHADOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  MEDIUM: {
    shadowColor: COLORS.SHADOW,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  HEAVY: {
    shadowColor: COLORS.SHADOW,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
};

// Common Styles
export const COMMON_STYLES = {
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND, // Always #021945
  },
  safeContainer: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND, // Always #021945
  },
  text: {
    color: COLORS.TEXT, // Always white text
    fontFamily: FONTS.REGULAR,
  },
  title: {
    color: COLORS.TEXT, // Always white text
    fontFamily: FONTS.BOLD,
    fontSize: FONTS.SIZES.TITLE,
  },
  button: {
    backgroundColor: COLORS.BUTTON, // Always yellow
    borderRadius: BORDER_RADIUS.MD,
    paddingVertical: SPACING.MD,
    paddingHorizontal: SPACING.LG,
  },
  buttonText: {
    color: COLORS.BUTTON_TEXT, // Always dark blue inside yellow buttons
    fontFamily: FONTS.BOLD,
    fontSize: FONTS.SIZES.MEDIUM,
    textAlign: 'center',
  },
  card: {
    backgroundColor: COLORS.SURFACE, // Elevated one step above the screen background, never white
    borderRadius: BORDER_RADIUS.MD,
    padding: SPACING.MD,
    marginVertical: SPACING.SM,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    ...SHADOWS.LIGHT,
  },
  section: {
    backgroundColor: COLORS.BACKGROUND, // Sections sit flat on the screen background
    paddingVertical: SPACING.MD,
  },
  modal: {
    backgroundColor: COLORS.MODAL_BACKGROUND, // Elevated two steps -- modals read as "above" everything else
    borderRadius: BORDER_RADIUS.LG,
  },
  header: {
    backgroundColor: COLORS.BACKGROUND,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  headerTitle: {
    color: COLORS.TEXT, // Always white text
    fontSize: FONTS.SIZES.XLARGE,
    fontWeight: 'bold',
  },
};
