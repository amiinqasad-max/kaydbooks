import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Text } from 'react-native';
import { Card, Button } from 'react-native-paper';

const BookCard = ({ book, onPress, onReadPress, onListenPress }) => {
  return (
    <TouchableOpacity onPress={onPress}>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.content}>
            <Image
              source={{ uri: book.cover_url }}
              style={styles.cover}
              resizeMode="cover"
            />
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={2}>
                {book.title}
              </Text>
              <Text style={styles.author} numberOfLines={1}>
                by {book.author}
              </Text>
              <View style={styles.actions}>
                <Button
                  mode="contained"
                  style={[styles.actionButton, styles.readButton]}
                  labelStyle={styles.actionButtonText}
                  onPress={onReadPress}
                >
                  Read
                </Button>
                <Button
                  mode="contained"
                  style={[styles.actionButton, styles.listenButton]}
                  labelStyle={styles.actionButtonText}
                  onPress={onListenPress}
                >
                  Listen
                </Button>
              </View>
            </View>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  content: {
    flexDirection: 'row',
  },
  cover: {
    width: 80,
    height: 120,
    borderRadius: 5,
  },
  info: {
    flex: 1,
    marginLeft: 15,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  author: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    flex: 0.45,
  },
  readButton: {
    backgroundColor: '#007bff',
  },
  listenButton: {
    backgroundColor: '#17a2b8',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default BookCard;
