import React, { useImperativeHandle } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { TYPOGRAPHY, SPACING } from '../constants/theme';

/**
 * PdfRenderer -- web fallback.
 *
 * Metro/Expo resolve `.web.js` for the web platform (see
 * PdfRenderer.native.js, the sibling file iOS/Android resolve to
 * instead). `react-native-pdf` is a native-only library -- it has no
 * web build -- so this file does not import it at all; that's what
 * actually keeps the web bundle from failing, not just avoiding
 * rendering it. See PDFViewScreen.js for the shared import site.
 *
 * Honest, not silently broken: this does not fake page rendering or
 * progress, and it deliberately does NOT call the `onError` prop --
 * PDFViewScreen's onError handler sets a generic "This file could not
 * be displayed. It may be corrupted." message, which would be actively
 * misleading here (the file is fine; PDF reading just isn't supported
 * on this platform). This component renders its own honest explanation
 * directly instead of routing through that unrelated error state.
 *
 * Exposes a no-op `setPage` on its ref so PDFViewScreen's
 * `pdfRef.current?.setPage(targetPage)` (used by chapter/bookmark
 * jump-to-page) never throws here -- there is nothing to page to
 * without a renderer, so it's a safe no-op, not a crash.
 */
const PdfRenderer = React.forwardRef(({ style }, ref) => {
  const { colors } = useTheme();

  useImperativeHandle(ref, () => ({
    setPage: () => {},
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.BACKGROUND }, style]}>
      <MaterialCommunityIcons name="book-off-outline" size={48} color={colors.TEXT_MUTED} />
      <Text style={[styles.title, { color: colors.TEXT }]}>PDF reading isn&apos;t available on web yet</Text>
      <Text style={[styles.message, { color: colors.TEXT_MUTED }]}>
        Open KaydBooks on Android or iOS to read this book.
      </Text>
    </View>
  );
});

PdfRenderer.displayName = 'PdfRenderer';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.XL,
  },
  title: {
    ...TYPOGRAPHY.h3,
    textAlign: 'center',
    marginTop: SPACING.MD,
  },
  message: {
    ...TYPOGRAPHY.body,
    textAlign: 'center',
    marginTop: SPACING.XS,
  },
});

export default PdfRenderer;
