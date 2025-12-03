import React, { useState, useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Dimensions,
  Text,
  Linking,
  ActivityIndicator,
} from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TrailerModalProps {
  visible: boolean;
  trailerKey: string;
  onClose: () => void;
}

// A reusable component for the fallback UI
const ErrorFallback = ({ trailerKey, onClose }: { trailerKey: string; onClose: () => void }) => {
  const handleOpenYouTube = async () => {
    const youtubeUrl = `https://www.youtube.com/watch?v=${trailerKey}`;
    try {
      const canOpen = await Linking.canOpenURL(youtubeUrl);
      if (canOpen) {
        await Linking.openURL(youtubeUrl);
      } else {
        console.warn('Cannot open YouTube URL');
        // Fallback: try with mobile YouTube app
        const mobileUrl = `vnd.youtube:${trailerKey}`;
        try {
          await Linking.openURL(mobileUrl);
        } catch (mobileError) {
          console.error('Error opening YouTube app:', mobileError);
        }
      }
    } catch (error) {
      console.error('Error opening YouTube:', error);
    }
    onClose();
  };

  return (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle" size={48} color={theme.colors.textSecondary} />
      <Text style={styles.errorTitle}>Видео недоступно для встраивания</Text>
      <Text style={styles.errorText}>
        Владелец ограничил воспроизведение этого трейлера в других приложениях.{'\n'}
        Вы можете посмотреть его в приложении YouTube.
      </Text>
      <Pressable 
        style={styles.youtubeButton} 
        onPress={handleOpenYouTube}
        android_ripple={{ color: 'rgba(255, 255, 255, 0.2)' }}
      >
        <Ionicons name="logo-youtube" size={20} color="#fff" />
        <Text style={styles.youtubeButtonText}>Смотреть на YouTube</Text>
      </Pressable>
    </View>
  );
};

export const TrailerModal: React.FC<TrailerModalProps> = ({
  visible,
  trailerKey,
  onClose,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Reset states every time the modal becomes visible
  useEffect(() => {
    if (visible) {
      setIsLoading(true);
      setHasError(false);
    }
  }, [visible]);

  // This function is called by the library if an error occurs (like 153, embed_not_allowed)
  const onError = useCallback((error: any) => {
    console.warn('YouTube Player Error:', error);
    // Handle specific error types
    const errorString = String(error).toLowerCase();
    const errorCode = typeof error === 'object' ? error?.code : null;
    
    // Check for embed restrictions or other playback errors
    if (
      errorString.includes('embed_not_allowed') ||
      errorString.includes('embedding') ||
      errorString.includes('not available') ||
      errorCode === 150 || // Video not available for embedding
      errorCode === 100 || // Video not found
      errorCode === 101 || // Video not available in this country
      errorCode === 150    // Video not available for embedding
    ) {
      console.warn('Video embedding restricted, showing fallback UI');
    }
    
    setHasError(true);
    setIsLoading(false);
  }, []);

  const onReady = () => {
    setIsLoading(false);
  };
  
  const onStateChange = useCallback((state: string) => {
    if (state === 'ended') {
      onClose();
    }
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.modalContent}>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={28} color={theme.colors.text} />
          </Pressable>
          
          {/* While loading, show an indicator */}
          {isLoading && (
            <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
          )}

          {/* If an error occurred, render our clean fallback component */}
          {hasError ? (
            <ErrorFallback trailerKey={trailerKey} onClose={onClose} />
          ) : (
             /* Otherwise, render the player. Use a view with opacity to hide the initial flash */
            <View style={{ opacity: isLoading ? 0 : 1 }}>
              <YoutubePlayer
                height={(SCREEN_WIDTH * 0.95 * 9) / 16}
                videoId={trailerKey}
                play={true} // Auto-play the video
                onError={onError}
                onReady={onReady}
                onChangeState={onStateChange}
                webViewProps={{
                  // Add webView props to handle errors better
                  onError: (syntheticEvent: any) => {
                    const { nativeEvent } = syntheticEvent;
                    console.warn('WebView error:', nativeEvent);
                    if (nativeEvent?.description?.includes('embed') || 
                        nativeEvent?.description?.includes('not allowed')) {
                      setHasError(true);
                      setIsLoading(false);
                    }
                  },
                }}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

// --- STYLES ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  modalContent: {
    width: SCREEN_WIDTH * 0.95,
    backgroundColor: '#000',
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  loader: {
    height: (SCREEN_WIDTH * 0.95 * 9) / 16, // Match player height
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 1
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 6,
  },
  errorContainer: {
    height: (SCREEN_WIDTH * 0.95 * 9) / 16,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  errorTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    textAlign: 'center'
  },
  errorText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  youtubeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF0000',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  youtubeButtonText: {
    color: '#fff',
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
});