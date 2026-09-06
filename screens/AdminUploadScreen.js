import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Card,
  Chip,
  Switch,
  Surface,
  ProgressBar,
  Avatar,
  IconButton,
} from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation } from '@react-navigation/native';
import { uploadFile, getPublicUrl, createBook } from '../services/supabase';
import { FONTS, SPACING, BORDER_RADIUS, COMMON_STYLES } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

const BOOK_CATEGORIES = [
  'Fiction', 'Non-Fiction', 'Science', 'History', 'Biography',
  'Technology', 'Business', 'Self-Help', 'Romance', 'Mystery',
  'Fantasy', 'Horror', 'Adventure', 'Educational', 'Children'
];

const AdminUploadScreen = () => {
  const navigation = useNavigation();
  
  // Form state
  const [bookData, setBookData] = useState({
    title: '',
    author: '',
    description: '',
    isbn: '',
    publication_year: '',
    page_count: '',
    category: '',
    is_premium: false,
    is_featured: false,
  });

  // File state
  const [files, setFiles] = useState({
    coverImage: null,
    pdfFile: null,
    audioFile: null,
  });

  // UI state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const { colors } = useTheme();
  const styles = createStyles(colors);

  // Input handlers
  const handleInputChange = (field, value) => {
    setBookData(prev => ({ ...prev, [field]: value }));
  };

  const handleBooleanChange = (field, value) => {
    setBookData(prev => ({ ...prev, [field]: value }));
  };

  const handleCategorySelect = (category) => {
    setBookData(prev => ({ ...prev, category }));
  };

  // File picker functions
  const pickCoverImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to upload images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setFiles(prev => ({
          ...prev,
          coverImage: {
            uri: asset.uri,
            name: asset.fileName || 'cover.jpg',
            type: asset.type || 'image/jpeg',
          }
        }));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image: ' + error.message);
    }
  };

  const pickPDFFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setFiles(prev => ({
          ...prev,
          pdfFile: {
            uri: asset.uri,
            name: asset.name,
            type: asset.mimeType || 'application/pdf',
          }
        }));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick PDF: ' + error.message);
    }
  };

  const pickAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setFiles(prev => ({
          ...prev,
          audioFile: {
            uri: asset.uri,
            name: asset.name,
            type: asset.mimeType || 'audio/mpeg',
          }
        }));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick audio file: ' + error.message);
    }
  };

  // Validation
  const validateForm = () => {
    const errors = [];
    
    if (!bookData.title.trim()) errors.push('Title is required');
    if (!bookData.author.trim()) errors.push('Author is required');
    if (!bookData.category) errors.push('Category is required');
    if (!files.coverImage) errors.push('Cover image is required');
    if (!files.pdfFile) errors.push('PDF file is required');
    
    return errors;
  };

  // Upload handler
  const handleUpload = async () => {
    const errors = validateForm();
    if (errors.length > 0) {
      Alert.alert('Validation Error', errors.join('\n'));
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadStatus('Starting upload...');

    try {
      let coverUrl = null;
      let pdfUrl = null;
      let audioUrl = null;

      // Upload cover image
      if (files.coverImage) {
        setUploadStatus('Uploading cover image...');
        setUploadProgress(20);
        console.log('Starting cover image upload:', files.coverImage);
        try {
          const coverPath = await uploadFile(files.coverImage, 'books', 'covers');
          console.log('Cover image uploaded successfully:', coverPath);
          coverUrl = getPublicUrl('books', coverPath);
          console.log('Cover URL generated:', coverUrl);
        } catch (error) {
          console.error('Cover image upload failed:', error);
          throw new Error(`Cover image upload failed: ${error.message}`);
        }
      }

      // Upload PDF file
      if (files.pdfFile) {
        setUploadStatus('Uploading PDF file...');
        setUploadProgress(50);
        const pdfPath = await uploadFile(files.pdfFile, 'books', 'pdfs');
        pdfUrl = getPublicUrl('books', pdfPath);
      }

      // Upload audio file (optional)
      if (files.audioFile) {
        setUploadStatus('Uploading audio file...');
        setUploadProgress(80);
        const audioPath = await uploadFile(files.audioFile, 'books', 'audio');
        audioUrl = getPublicUrl('books', audioPath);
      }

      // Create book record
      setUploadStatus('Creating book record...');
      setUploadProgress(90);
      
      // CRITICAL: Filter out columns that don't exist in database schema
      const { is_premium, is_featured, ...safeBookData } = bookData;
      
      const finalBookData = {
        ...safeBookData,
        cover_url: coverUrl,
        pdf_url: pdfUrl,
        audio_url: audioUrl,
      };

      console.log('Sending safe book data to database:', finalBookData);
      const newBook = await createBook(finalBookData);

      setUploadProgress(100);
      setUploadStatus('Upload completed successfully!');

      Alert.alert(
        'Success!',
        'Book uploaded successfully!',
        [
          {
            text: 'Upload Another',
            onPress: resetForm,
          },
          {
            text: 'Go to Manage',
            onPress: () => navigation.navigate('AdminManage'),
          },
        ]
      );

    } catch (error) {
      Alert.alert('Upload Error', error.message);
      setUploadStatus('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setBookData({
      title: '',
      author: '',
      description: '',
      isbn: '',
      publication_year: '',
      page_count: '',
      category: '',
      is_premium: false,
      is_featured: false,
    });
    setFiles({
      coverImage: null,
      pdfFile: null,
      audioFile: null,
    });
    setUploadProgress(0);
    setUploadStatus('');
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>📚 Upload New Book</Text>
          <Text style={styles.subtitle}>Add a new book to your library</Text>
        </View>

        {/* Upload Progress */}
        {uploading && (
          <Card style={styles.progressCard}>
            <Card.Content>
              <Text style={styles.progressText}>{uploadStatus}</Text>
              <ProgressBar progress={uploadProgress / 100} color={colors.primary} style={styles.progressBar} />
              <Text style={styles.progressPercent}>{uploadProgress}%</Text>
            </Card.Content>
          </Card>
        )}

        {/* Basic Information */}
        <Card style={styles.card}>
          <Card.Title
            title="📖 Book Information"
            titleStyle={styles.cardTitle}
            left={(props) => <Avatar.Icon {...props} icon="book" style={styles.cardIcon} />}
          />
          <Card.Content>
            <TextInput
              label="Book Title"
              value={bookData.title}
              onChangeText={(text) => handleInputChange('title', text)}
              style={styles.input}
              mode="outlined"
              disabled={uploading}
              left={<TextInput.Icon icon="format-title" />}
              theme={{
                colors: {
                  text: colors.TEXT,
                  placeholder: colors.TEXT_SECONDARY,
                  primary: colors.BUTTON,
                  outline: colors.BORDER,
                  background: colors.SURFACE,
                }
              }}
            />

            <TextInput
              label="Author"
              value={bookData.author}
              onChangeText={(text) => handleInputChange('author', text)}
              style={styles.input}
              mode="outlined"
              disabled={uploading}
              left={<TextInput.Icon icon="account-edit" />}
              theme={{
                colors: {
                  text: colors.TEXT,
                  placeholder: colors.TEXT_SECONDARY,
                  primary: colors.BUTTON,
                  outline: colors.BORDER,
                  background: colors.SURFACE,
                }
              }}
            />

            <TextInput
              label="Description (Optional)"
              value={bookData.description}
              onChangeText={(text) => handleInputChange('description', text)}
              multiline
              numberOfLines={3}
              style={styles.input}
              mode="outlined"
              disabled={uploading}
              left={<TextInput.Icon icon="text" />}
              theme={{
                colors: {
                  text: colors.TEXT,
                  placeholder: colors.TEXT_SECONDARY,
                  primary: colors.BUTTON,
                  outline: colors.BORDER,
                  background: colors.SURFACE,
                }
              }}
            />
          </Card.Content>
        </Card>

        {/* File Uploads */}
        <Card style={styles.card}>
          <Card.Title
            title="📁 File Attachments"
            titleStyle={styles.cardTitle}
            left={(props) => <Avatar.Icon {...props} icon="file-multiple" style={styles.cardIcon} />}
          />
          <Card.Content>
            
            {/* Cover Image */}
            <View style={styles.fileSection}>
              <View style={styles.fileSectionHeader}>
                <Text style={styles.fileLabel}>🖼️ Cover Image</Text>
                <Chip style={styles.requiredChip} textStyle={styles.chipText} compact>Required</Chip>
              </View>
              {files.coverImage ? (
                <Surface style={styles.selectedFile} elevation={1}>
                  <Text style={styles.fileName}>{files.coverImage.name}</Text>
                  <IconButton
                    icon="close"
                    size={20}
                    onPress={() => setFiles(prev => ({ ...prev, coverImage: null }))}
                    disabled={uploading}
                  />
                </Surface>
              ) : (
                <Button
                  mode="contained"
                  onPress={pickCoverImage}
                  disabled={uploading}
                  style={styles.fileButton}
                  icon="image-plus"
                >
                  Select Cover Image
                </Button>
              )}
            </View>

            {/* PDF File */}
            <View style={styles.fileSection}>
              <View style={styles.fileSectionHeader}>
                <Text style={styles.fileLabel}>📄 PDF Document</Text>
                <Chip style={styles.requiredChip} textStyle={styles.chipText} compact>Required</Chip>
              </View>
              {files.pdfFile ? (
                <Surface style={styles.selectedFile} elevation={1}>
                  <Text style={styles.fileName}>{files.pdfFile.name}</Text>
                  <IconButton
                    icon="close"
                    size={20}
                    onPress={() => setFiles(prev => ({ ...prev, pdfFile: null }))}
                    disabled={uploading}
                  />
                </Surface>
              ) : (
                <Button
                  mode="contained"
                  onPress={pickPDFFile}
                  disabled={uploading}
                  style={styles.fileButton}
                  icon="file-pdf-box"
                >
                  Select PDF Document
                </Button>
              )}
            </View>

            {/* Audio File */}
            <View style={styles.fileSection}>
              <View style={styles.fileSectionHeader}>
                <Text style={styles.fileLabel}>🎵 Audio File</Text>
                <Chip style={styles.optionalChip} textStyle={styles.chipText} compact>Optional</Chip>
              </View>
              {files.audioFile ? (
                <Surface style={styles.selectedFile} elevation={1}>
                  <Text style={styles.fileName}>{files.audioFile.name}</Text>
                  <IconButton
                    icon="close"
                    size={20}
                    onPress={() => setFiles(prev => ({ ...prev, audioFile: null }))}
                    disabled={uploading}
                  />
                </Surface>
              ) : (
                <Button
                  mode="contained"
                  onPress={pickAudioFile}
                  disabled={uploading}
                  style={styles.fileButton}
                  icon="music-note-plus"
                >
                  Select Audio File
                </Button>
              )}
            </View>

          </Card.Content>
        </Card>

        {/* Additional Information */}
        <Card style={styles.card}>
          <Card.Title
            title="ℹ️ Additional Details"
            titleStyle={styles.cardTitle}
            left={(props) => <Avatar.Icon {...props} icon="information" style={styles.cardIcon} />}
          />
          <Card.Content>
            <TextInput
              label="ISBN (Optional)"
              value={bookData.isbn}
              onChangeText={(text) => handleInputChange('isbn', text)}
              style={styles.input}
              mode="outlined"
              disabled={uploading}
              left={<TextInput.Icon icon="barcode" />}
              theme={{
                colors: {
                  text: colors.TEXT,
                  placeholder: colors.TEXT_SECONDARY,
                  primary: colors.BUTTON,
                  outline: colors.BORDER,
                  background: colors.SURFACE,
                }
              }}
            />

            <View style={styles.rowInputs}>
              <TextInput
                label="Publication Year"
                value={bookData.publication_year}
                onChangeText={(text) => handleInputChange('publication_year', text)}
                keyboardType="numeric"
                style={[styles.input, styles.halfInput]}
                mode="outlined"
                disabled={uploading}
                left={<TextInput.Icon icon="calendar" />}
                theme={{
                  colors: {
                    text: colors.TEXT,
                    placeholder: colors.TEXT_SECONDARY,
                    primary: colors.BUTTON,
                    outline: colors.BORDER,
                    background: colors.SURFACE,
                  }
                }}
              />

              <TextInput
                label="Page Count"
                value={bookData.page_count}
                onChangeText={(text) => handleInputChange('page_count', text)}
                keyboardType="numeric"
                style={[styles.input, styles.halfInput]}
                mode="outlined"
                disabled={uploading}
                left={<TextInput.Icon icon="file-document" />}
                theme={{
                  colors: {
                    text: colors.TEXT,
                    placeholder: colors.TEXT_SECONDARY,
                    primary: colors.BUTTON,
                    outline: colors.BORDER,
                    background: colors.SURFACE,
                  }
                }}
              />
            </View>
          </Card.Content>
        </Card>

        {/* Categories */}
        <Card style={styles.card}>
          <Card.Title
            title="🏷️ Category"
            titleStyle={styles.cardTitle}
            left={(props) => <Avatar.Icon {...props} icon="tag" style={styles.cardIcon} />}
            right={() => (
              <Chip style={styles.requiredChip} textStyle={styles.chipText} compact>
                Required
              </Chip>
            )}
          />
          <Card.Content>
            <Text style={styles.categoryHint}>Select a category for your book</Text>
            <View style={styles.categoriesContainer}>
              {BOOK_CATEGORIES.map((category) => (
                <Chip
                  key={category}
                  selected={bookData.category === category}
                  onPress={() => handleCategorySelect(category)}
                  style={[
                    styles.categoryChip,
                    bookData.category === category && styles.selectedCategoryChip
                  ]}
                  textStyle={[
                    styles.categoryChipText,
                    bookData.category === category && styles.selectedCategoryChipText
                  ]}
                  disabled={uploading}
                  icon={bookData.category === category ? "check" : undefined}
                >
                  {category}
                </Chip>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* Settings */}
        <Card style={styles.card}>
          <Card.Title
            title="⚙️ Book Settings"
            titleStyle={styles.cardTitle}
            left={(props) => <Avatar.Icon {...props} icon="cog" style={styles.cardIcon} />}
          />
          <Card.Content>
            <Surface style={styles.settingsContainer} elevation={1}>
              <View style={styles.switchContainer}>
                <View style={styles.switchInfo}>
                  <Text style={styles.switchLabel}>💎 Premium Book</Text>
                  <Text style={styles.switchDescription}>Requires subscription to access</Text>
                </View>
                <Switch
                  value={bookData.is_premium}
                  onValueChange={(value) => handleBooleanChange('is_premium', value)}
                  disabled={uploading}
                />
              </View>

              <View style={styles.switchContainer}>
                <View style={styles.switchInfo}>
                  <Text style={styles.switchLabel}>⭐ Featured Book</Text>
                  <Text style={styles.switchDescription}>Show prominently on home screen</Text>
                </View>
                <Switch
                  value={bookData.is_featured}
                  onValueChange={(value) => handleBooleanChange('is_featured', value)}
                  disabled={uploading}
                />
              </View>
            </Surface>
          </Card.Content>
        </Card>

        {/* Upload Button */}
        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            onPress={handleUpload}
            disabled={uploading}
            loading={uploading}
            style={styles.uploadButton}
            icon={uploading ? undefined : "cloud-upload"}
          >
            {uploading ? 'Uploading Book...' : 'Upload Book'}
          </Button>

          {!uploading && (
            <Button
              mode="outlined"
              onPress={resetForm}
              style={styles.resetButton}
              icon="refresh"
            >
              Reset Form
            </Button>
          )}
        </View>

      </ScrollView>
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.BACKGROUND, // Dark blue #021945
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.MD,
    paddingBottom: SPACING.XL,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.LG,
    paddingVertical: SPACING.MD,
  },
  title: {
    fontSize: FONTS.SIZES.HEADER,
    color: colors.TEXT, // White text
    fontWeight: 'bold',
    marginBottom: SPACING.XS,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: colors.TEXT_SECONDARY, // Light gray
    textAlign: 'center',
  },
  progressCard: {
    marginBottom: SPACING.MD,
    backgroundColor: colors.BACKGROUND, // Dark blue
    borderWidth: 1,
    borderColor: colors.BORDER,
    borderRadius: BORDER_RADIUS.MD,
    padding: SPACING.MD,
  },
  progressText: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: colors.TEXT, // White text
    textAlign: 'center',
    marginBottom: SPACING.SM,
  },
  progressBar: {
    marginBottom: SPACING.XS,
    backgroundColor: colors.PROGRESS_BACKGROUND,
  },
  progressPercent: {
    fontSize: FONTS.SIZES.SMALL,
    color: colors.TEXT_SECONDARY, // Light gray
    textAlign: 'center',
  },
  card: {
    marginBottom: SPACING.MD,
    backgroundColor: colors.BACKGROUND, // Dark blue
    borderWidth: 1,
    borderColor: colors.BORDER,
    borderRadius: BORDER_RADIUS.MD,
    padding: SPACING.MD,
  },
  cardTitle: {
    fontSize: FONTS.SIZES.LARGE,
    color: colors.TEXT, // White text
    fontWeight: '600',
    marginBottom: SPACING.SM,
  },
  cardIcon: {
    backgroundColor: colors.BUTTON, // Yellow
  },
  input: {
    marginBottom: SPACING.SM,
    backgroundColor: colors.BACKGROUND, // Dark blue
  },
  rowInputs: {
    flexDirection: 'row',
    gap: SPACING.SM,
  },
  halfInput: {
    flex: 1,
  },
  fileSection: {
    marginBottom: SPACING.MD,
  },
  fileSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.SM,
  },
  fileLabel: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: colors.TEXT, // White text
    fontWeight: '600',
  },
  requiredChip: {
    backgroundColor: colors.ERROR,
  },
  optionalChip: {
    backgroundColor: colors.TEXT_SECONDARY,
  },
  chipText: {
    color: colors.BACKGROUND, // Dark blue text on colored chips
    fontSize: 10,
    fontWeight: '600',
  },
  selectedFile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.BACKGROUND, // Dark blue
    padding: SPACING.SM,
    borderRadius: BORDER_RADIUS.SM,
    borderWidth: 1,
    borderColor: colors.BUTTON, // Yellow border
  },
  fileName: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: colors.TEXT, // White text
    flex: 1,
  },
  fileButton: {
    marginTop: SPACING.XS,
    backgroundColor: colors.BUTTON, // Yellow button
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.XS,
    marginTop: SPACING.SM,
  },
  categoryHint: {
    fontSize: FONTS.SIZES.SMALL,
    color: colors.TEXT_SECONDARY, // Light gray
    fontStyle: 'italic',
  },
  categoryChip: {
    marginRight: SPACING.XS,
    marginBottom: SPACING.XS,
    backgroundColor: colors.BACKGROUND, // Dark blue
    borderWidth: 1,
    borderColor: colors.BORDER,
  },
  selectedCategoryChip: {
    backgroundColor: colors.BUTTON, // Yellow when selected
  },
  categoryChipText: {
    color: colors.TEXT, // White text
    fontSize: 12,
  },
  selectedCategoryChipText: {
    color: colors.BUTTON_TEXT, // Dark blue text on yellow
    fontWeight: '600',
  },
  settingsContainer: {
    backgroundColor: colors.BACKGROUND, // Dark blue
    borderRadius: BORDER_RADIUS.SM,
    padding: SPACING.SM,
    borderWidth: 1,
    borderColor: colors.BORDER,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.SM,
  },
  switchInfo: {
    flex: 1,
    marginRight: SPACING.SM,
  },
  switchLabel: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: colors.TEXT, // White text
    fontWeight: '600',
    marginBottom: 2,
  },
  switchDescription: {
    fontSize: FONTS.SIZES.SMALL,
    color: colors.TEXT_SECONDARY, // Light gray
    lineHeight: 16,
  },
  buttonContainer: {
    marginTop: SPACING.LG,
    gap: SPACING.SM,
  },
  uploadButton: {
    backgroundColor: colors.BUTTON, // Yellow
    borderRadius: BORDER_RADIUS.SM,
  },
  resetButton: {
    borderColor: colors.BUTTON, // Yellow border
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.SM,
  },
});

export default AdminUploadScreen;
