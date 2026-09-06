import React from 'react';
import { FlatList } from 'react-native';
import { SPACING } from '../../constants/theme';
import { CompactBookCard } from './BookCard';
import { ShelfSkeleton } from './SkeletonLoader';

/**
 * HorizontalBookList -- Phase 2 shared component (#6, #23).
 * A single virtualized (FlatList, not a manually-mapped ScrollView)
 * horizontal shelf, used by Home's Continue Reading/Recommended/Popular/
 * New Releases rows and Discover's category rows -- Phase 2 #23 audit
 * finding: several Modern* screens rendered horizontal shelves with
 * `.map()` inside a ScrollView, which mounts every card up front instead
 * of virtualizing off-screen ones.
 */
const HorizontalBookList = ({
  data,
  onBookPress,
  getProgress,
  loading = false,
  cardWidth = 112,
}) => {
  if (loading) return <ShelfSkeleton />;

  return (
    <FlatList
      data={data}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{ paddingHorizontal: SPACING.MD }}
      initialNumToRender={4}
      windowSize={5}
      removeClippedSubviews
      renderItem={({ item }) => (
        <CompactBookCard
          book={item}
          width={cardWidth}
          progress={getProgress ? getProgress(item) : undefined}
          onPress={() => onBookPress(item)}
        />
      )}
    />
  );
};

export default HorizontalBookList;
