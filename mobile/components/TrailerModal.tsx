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
  Animated,
} from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
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
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;

  // Reset states every time the modal becomes visible
  useEffect(() => {
    if (visible) {
      setIsLoading(true);
      setHasError(false);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
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
      animationType="none"
      onRequestClose={onClose}
    >
      <BlurView intensity={40} tint="dark" style={styles.blurContainer}>
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.modalContent}>
            {/* Gradient accent line */}
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientLine}
            />

            <Pressable style={styles.closeButton} onPress={onClose}>
              <View style={styles.closeButtonInner}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </View>
            </Pressable>
            
            {/* While loading, show an indicator */}
            {isLoading && (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Загрузка трейлера...</Text>
              </View>
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
        </Animated.View>
      </BlurView>
    </Modal>
  );
};

// --- STYLES ---
const styles = StyleSheet.create({
  blurContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  modalContent: {
    width: SCREEN_WIDTH * 0.95,
    backgroundColor: theme.colors.backgroundDark,
    borderRadius: theme.borderRadius.xl,
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.6,
    shadowRadius: 25,
    elevation: 15,
    position: 'relative',
  },
  gradientLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    zIndex: 1,
  },
  loaderContainer: {
    height: (SCREEN_WIDTH * 0.95 * 9) / 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    width: '100%',
    zIndex: 1,
  },
  loadingText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    marginTop: theme.spacing.md,
  },
  closeButton: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    zIndex: 10,
  },
  closeButtonInner: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    padding: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    lineHeight: 22,
  },
  youtubeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF0000',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
    shadowColor: '#FF0000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  youtubeButtonText: {
    color: '#fff',
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});