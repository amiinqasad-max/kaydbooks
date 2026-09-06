import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import ProgressBar from './ProgressBar';

// Every cover in the app uses the same 2:3 book-cover aspect ratio
// (Phase 2 #27: "use consistent cover ratios throughout the app" --
// audit finding: covers were sized ad hoc per screen with no shared
// constant, e.g. 80x120 in the old dead BookCard vs whatever each Modern*
// screen picked independently).
export const COVER_ASPECT_RATIO = 2 / 3;

const CoverImage = ({ uri, width, height, style }) => {
  const [failed, setFailed] = React.useState(false);
  if (!uri || failed) {
    return (
      <View style={[styles.coverFallback, { width, height }, style]}>
        <MaterialCommunityIcons name="book-open-page-variant" size={width * 0.4} color={COLORS.TEXT_MUTED} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={[{ width, height, borderRadius: BORDER_RADIUS.SM }, style]}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
};

/**
 * CompactBookCard -- a vertical cover-forward card for horizontally
 * scrolling shelves (Continue Reading, Recommended, Popular, New
 * Releases). Optional progress bar under the cover when `progress` is
 * passed (0-100); omitted entirely when there is no real progress to
 * show, rather than rendering an empty 0% bar (Phase 2 #24: real data
 * only).
 */
export const CompactBookCard = ({ book, onPress, progress, width = 112 }) => {
  const height = Math.round(width / COVER_ASPECT_RATIO);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.compactCard, { width }]}
      accessibilityRole="button"
      accessibilityLabel={`${book.title} by ${book.author}`}
    >
      <CoverImage uri={book.cover_url} width={width} height={height} />
      <Text style={styles.compactTitle} numberOfLines={2}>{book.title}</Text>
      <Text style={styles.compactAuthor} numberOfLines={1}>{book.author}</Text>
      {typeof progress === 'number' ? (
        <ProgressBar progress={progress} height={4} style={styles.compactProgress} />
      ) : null}
    </TouchableOpacity>
  );
};

/**
 * BookCard -- the full-width row card (search results, category lists,
 * downloads, library). Replaces the old, unused `components/BookCard.js`
 * (deleted this phase -- it had zero importers anywhere in the app and
 * used a hardcoded light theme with blue/teal buttons that matched
 * nothing else in KaydBooks' dark/yellow visual identity).
 */
const BookCard = ({ book, onPress, onReadPress, onListenPress, progress, badge }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.85}
    style={styles.rowCard}
    accessibilityRole="button"
    accessibilityLabel={`${book.title} by ${book.author}`}
  >
    <CoverImage uri={book.cover_url} width={72} height={108} />
    <View style={styles.rowInfo}>
      <Text style={styles.rowTitle} numberOfLines={2}>{book.title}</Text>
      <Text style={styles.rowAuthor} numberOfLines={1}>by {book.author}</Text>
      {badge}
      {typeof progress === 'number' ? (
        <ProgressBar progress={progress} height={4} style={styles.rowProgress} />
      ) : null}
      <View style={styles.actions}>
        {onReadPress ? (
          <TouchableOpacity onPress={onReadPress} style={styles.actionButton} accessibilityRole="button" accessibilityLabel={`Read ${book.title}`}>
            <MaterialCommunityIcons name="book-open-variant" size={14} color={COLORS.BUTTON_TEXT} />
            <Text style={styles.actionText}>Read</Text>
          </TouchableOpacity>
        ) : null}
        {onListenPress ? (
          <TouchableOpacity onPress={onListenPress} style={[styles.actionButton, styles.actionButtonSecondary]} accessibilityRole="button" accessibilityLabel={`Listen to ${book.title}`}>
            <MaterialCommunityIcons name="headphones" size={14} color={COLORS.ACCENT} />
            <Text style={[styles.actionText, styles.actionTextSecondary]}>Listen</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  coverFallback: {
    borderRadius: BORDER_RADIUS.SM,
    backgroundColor: COLORS.SURFACE_SECONDARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactCard: {
    marginRight: SPACING.MD,
  },
  compactTitle: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.TEXT,
    marginTop: SPACING.XS,
    fontWeight: '600',
  },
  compactAuthor: {
    ...TYPOGRAPHY.caption,
    color: COLORS.TEXT_MUTED,
  },
  compactProgress: {
    marginTop: SPACING.XS,
  },
  rowCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.SURFACE,
    borderRadius: BORDER_RADIUS.MD,
    padding: SPACING.SM_MD,
    marginBottom: SPACING.SM,
    gap: SPACING.SM_MD,
    ...SHADOWS.LIGHT,
  },
  rowInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  rowTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.TEXT,
    fontWeight: '700',
  },
  rowAuthor: {
    ...TYPOGRAPHY.caption,
    color: COLORS.TEXT_MUTED,
    marginTop: 2,
  },
  rowProgress: {
    marginTop: SPACING.SM,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.SM,
    marginTop: SPACING.SM,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.BUTTON,
    paddingHorizontal: SPACING.SM_MD,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.SM,
  },
  actionButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.ACCENT,
  },
  actionText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.BUTTON_TEXT,
    fontWeight: '700',
  },
  actionTextSecondary: {
    color: COLORS.ACCENT,
  },
});

export default BookCard;
