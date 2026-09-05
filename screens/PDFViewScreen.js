import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { Appbar } from 'react-native-paper';
import { COLORS, COMMON_STYLES } from '../constants/theme';
import { getSignedFileUrl } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * PHASE 0 NOTE -- this is a security fix, not the reader rebuild.
 *
 * This screen still renders PDFs through Google's public Docs Viewer
 * inside a WebView. That is a known, tracked limitation (see the product
 * audit): it cannot report page position back into the app, cannot work
 * offline, and cannot apply the app's reading theme/fonts. Replacing it
 * with a real, offline-capable renderer is Phase 1 engineering work, not
 * done here.
 *
 * What WAS fixed here: this screen used to receive a permanent, public
 * `pdf_url` and hand it directly to Google's viewer -- meaning the "no PDF
 * downloads" rule was trivially bypassable (the URL is visible in network
 * traffic and never expires) and gated/premium PDFs were exposed the same
 * way as free ones. Now, whenever the book has a `pdf_path` (a private
 * storage object -- see supabase/migrations/003_authorization_and_schema_fixes.sql),
 * this screen resolves a signed URL that:
 *   - expires in a few minutes, not never
 *   - only exists if the *signed-in user* is allowed to read that object
 *     under Row Level Security (free content: any signed-in user; premium
 *     content: requires an active subscription) -- enforced in Postgres,
 *     not just by this screen choosing to ask nicely
 *
 * Legacy rows that only have the old public `pdf_url` still work via a
 * fallback, since they predate this fix and haven't been re-uploaded.
 */
const PDFViewScreen = ({ route, navigation }) => {
  const { pdfPath, pdfUrl: legacyPdfUrl } = route.params || {};
  const { user } = useAuth();
  const [resolvedUrl, setResolvedUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const resolveUrl = async () => {
      try {
        if (pdfPath) {
          // Short-lived on purpose -- see the note above. Re-resolved
          // every time this screen mounts, never cached long-term.
          const signed = await getSignedFileUrl('books', pdfPath, 300);
          if (!cancelled) setResolvedUrl(signed);
        } else if (legacyPdfUrl) {
          if (!cancelled) setResolvedUrl(legacyPdfUrl);
        } else {
          if (!cancelled) setError('This book has no readable file.');
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.message?.includes('access')
              ? 'You need an active subscription to read this book.'
              : 'Could not open this book right now. Please try again.'
          );
        }
      }
    };

    resolveUrl();
    return () => { cancelled = true; };
  }, [pdfPath, legacyPdfUrl]);

  const googleDocsUrl = resolvedUrl
    ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(resolvedUrl)}`
    : null;

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Reader" titleStyle={styles.headerTitle} />
      </Appbar.Header>

      {error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : !googleDocsUrl ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.BUTTON} />
        </View>
      ) : (
        <WebView
          source={{ uri: googleDocsUrl }}
          style={styles.webview}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.centered}>
              <ActivityIndicator color={COLORS.BUTTON} />
            </View>
          )}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          mixedContentMode="compatibility"
          onShouldStartLoadWithRequest={(request) => {
            return request.url.includes('docs.google.com') || request.url === resolvedUrl;
          }}
          onError={(err) => {
            console.error('PDF WebView Error:', err);
            setError('Could not load this book. Please check your connection and try again.');
          }}
          userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  header: {
    backgroundColor: COLORS.BACKGROUND,
    elevation: 0,
    shadowOpacity: 0,
  },
  headerTitle: {
    color: COLORS.TEXT,
    fontSize: 18,
    fontWeight: 'bold',
  },
  webview: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    color: COLORS.TEXT,
    textAlign: 'center',
    fontSize: 15,
  },
});

export default PDFViewScreen;
