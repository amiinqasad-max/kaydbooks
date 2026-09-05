import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { Text } from 'react-native';
import { Button, Appbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import {
  getBooksByCategory,
  addToFavorites,
  removeFromFavorites,
  isFavorite,
} from '../services/supabase';

const CategoryBooksScreen = ({ navigation, route }) => {
  const { category } = route.params;
  const { user } = useAuth();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFavorites] = useState({});

  useEffect(() => {
    loadBooks();
  }, [category]);

  const loadBooks = async () => {
    try {
      setLoading(true);
      const booksData = await getBooksByCategory(category, 50);
      setBooks(booksData);

      // Load favorites status
      if (user) {
        const favoritesStatus = {};
        await Promise.all(
          booksData.map(async (book) => {
            const isFav = await isFavorite(user.id, book.id);
            favoritesStatus[book.id] = isFav;
          })
        );
        setFavorites(favoritesStatus);
      }
    } catch (error) {
      console.error('Error loading category books:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBooks();
    setRefreshing(false);
  };

  const toggleFavorite = async (bookId) => {
    if (!user) {
      navigation.navigate('Login');
      return;
    }

    try {
      const currentlyFavorite = favorites[bookId];
      
      if (currentlyFavorite) {
        await removeFromFavorites(user.id, bookId);
      } else {
        await addToFavorites(user.id, bookId);
      }
      
      setFavorites(prev => ({
        ...prev,
        [bookId]: !currentlyFavorite
      }));
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const renderBookItem = ({ item }) => (
    <TouchableOpacity
      style={styles.bookItem}
      onPress={() => navigation.navigate('BookDetail', { book: item })}
    >
      <Image source={{ uri: item.cover_url }} style={styles.bookCover} />
      <View style={styles.bookInfo}>
        <Text style={styles.bookTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.bookAuthor} numberOfLines={1}>
          by {item.author}
        </Text>
        {item.pages && (
          <Text style={styles.bookPages}>{item.pages} pages</Text>
        )}
        {item.description && (
          <Text style={styles.bookDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <View style={styles.bookActions}>
          <Button
            title="Read"
            buttonStyle={[styles.actionBtn, styles.readBtn]}
            titleStyle={styles.actionBtnText}
            onPress={() => navigation.navigate('PDFViewer', { book: item })}
          />
          {item.audio_url && (
            <Button
              title="Listen"
              buttonStyle={[styles.actionBtn, styles.listenBtn]}
              titleStyle={styles.actionBtnText}
              onPress={() => navigation.navigate('AudioPlayer', { book: item })}
            />
          )}
        </View>
      </View>
      <TouchableOpacity
        style={styles.favoriteBtn}
        onPress={() => toggleFavorite(item.id)}
      >
        <MaterialCommunityIcons
          name={favorites[item.id] ? "heart" : "heart-outline"}
          size={24}
          color={favorites[item.id] ? "#FF6B6B" : "#CCC"}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Appbar.Header style={{ backgroundColor: '#007AFF' }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={category} titleStyle={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }} />
      </Appbar.Header>

      <FlatList
        data={books}
        renderItem={renderBookItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            <Text style={styles.categoryTitle}>{category} Books</Text>
            <Text style={styles.bookCount}>
              {books.length} book{books.length !== 1 ? 's' : ''} available
            </Text>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="book-outline" size={64} color="#CCC" />
              <Text style={styles.emptyTitle}>No Books in {category}</Text>
              <Text style={styles.emptySubtitle}>
                Check back later for new additions in this category
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  listContainer: {
    padding: 15,
  },
  headerContainer: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  categoryTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  bookCount: {
    fontSize: 14,
    color: '#666',
  },
  bookItem: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  bookCover: {
    width: 70,
    height: 105,
    borderRadius: 8,
  },
  bookInfo: {
    flex: 1,
    marginLeft: 15,
    justifyContent: 'space-between',
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  bookAuthor: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  bookPages: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
  },
  bookDescription: {
    fontSize: 12,
    color: '#777',
    lineHeight: 16,
    marginBottom: 8,
  },
  bookActions: {
    flexDirection: 'row',
  },
  actionBtn: {
    borderRadius: 15,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  readBtn: {
    backgroundColor: '#007AFF',
  },
  listenBtn: {
    backgroundColor: '#FFD700',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  favoriteBtn: {
    padding: 5,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default CategoryBooksScreen;
