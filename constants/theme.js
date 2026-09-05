// Dark Theme Configuration
export const COLORS = {
  // Main Colors
  BACKGROUND: '#021945',      // Dark blue background - ONLY background color
  SURFACE: '#021945',         // Same as background for cards/surfaces
  TEXT: '#FFFFFF',           // White text - ONLY for text
  TEXT_SECONDARY: '#CCCCCC', // Light gray for secondary text
  BUTTON: '#FAB500',         // Yellow buttons/boxes - ONLY for interactive elements
  BUTTON_TEXT: '#021945',    // Dark blue text inside buttons
  BUTTON_LIGHT: 'rgba(250, 181, 0, 0.2)', // Light yellow for active states
  
  // Additional Colors (all using dark blue background)
  CARD_BACKGROUND: '#021945', // Same as background
  SECTION_BACKGROUND: '#021945', // Same as background
  MODAL_BACKGROUND: '#021945', // Same as background
  SHADOW: 'rgba(250, 181, 0, 0.3)', // Yellow shadow
  BORDER: '#444444',
  
  // Status Colors
  ERROR: '#FF6B6B',
  ERROR_LIGHT: 'rgba(255, 107, 107, 0.2)',
  WARNING: '#FFD93D',
  INFO: '#6BCF7F',
  SUCCESS: '#4CAF50',
  
  // Progress Colors
  PROGRESS_BACKGROUND: 'rgba(255, 255, 255, 0.2)',
  PROGRESS_FILL: '#FAB500',
};

export const FONTS = {
  REGULAR: 'System',
  BOLD: 'System',
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

export const SPACING = {
  XS: 4,
  SM: 8,
  MD: 16,
  LG: 24,
  XL: 32,
  XXL: 40,
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
    backgroundColor: COLORS.BACKGROUND, // Always #021945, never white
    borderRadius: BORDER_RADIUS.MD,
    padding: SPACING.MD,
    marginVertical: SPACING.SM,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    ...SHADOWS.LIGHT,
  },
  section: {
    backgroundColor: COLORS.BACKGROUND, // Always #021945
    paddingVertical: SPACING.MD,
  },
  modal: {
    backgroundColor: COLORS.BACKGROUND, // Always #021945
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
