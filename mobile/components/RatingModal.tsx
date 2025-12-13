import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';

interface RatingModalProps {
  visible: boolean;
  currentRating?: number | null;
  onClose: () => void;
  onRate: (rating: number) => Promise<void>;
  movieTitle?: string;
}

export const RatingModal: React.FC<RatingModalProps> = ({
  visible,
  currentRating,
  onClose,
  onRate,
  movieTitle,
}) => {
  const [selectedRating, setSelectedRating] = useState<number | null>(currentRating || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;

  React.useEffect(() => {
    if (visible) {
      setSelectedRating(currentRating || null);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
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
      scaleAnim.setValue(0.8);
    }
  }, [visible, currentRating]);

  const handleRatingSelect = (rating: number) => {
    setSelectedRating(rating);
  };

  const handleSubmit = async () => {
    if (selectedRating === null) return;
    
    setIsSubmitting(true);
    try {
      await onRate(selectedRating);
      onClose();
    } catch (error) {
      console.error('Error submitting rating:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <BlurView intensity={30} tint="dark" style={styles.blurContainer}>
          <Animated.View
            style={[
              styles.modalContent,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              {/* Close button */}
              <Pressable style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </Pressable>

              {/* Gradient accent line */}
              <LinearGradient
                colors={[theme.colors.rating, theme.colors.rating + '80']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientLine}
              />

              {movieTitle && (
                <Text style={styles.movieTitle} numberOfLines={2}>
                  {movieTitle}
                </Text>
              )}
              
              <View style={styles.ratingContainer}>
                <View style={styles.starContainer}>
                  <Ionicons 
                    name="star" 
                    size={40} 
                    color={selectedRating ? theme.colors.rating : theme.colors.textSecondary} 
                    style={styles.starIcon}
                  />
                  {selectedRating && (
                    <Animated.View
                      style={[
                        styles.starGlow,
                        {
                          opacity: fadeAnim,
                        },
                      ]}
                    />
                  )}
                </View>
                <Text style={styles.ratingLabel}>
                  {selectedRating ? `Ваша оценка: ${selectedRating}/10` : 'Выберите оценку'}
                </Text>
                <View style={styles.numbersContainer}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <Pressable
                      key={num}
                      style={[
                        styles.numberButton,
                        selectedRating === num && styles.numberButtonSelected,
                      ]}
                      onPress={() => handleRatingSelect(num)}
                    >
                      <Text
                        style={[
                          styles.numberText,
                          selectedRating === num && styles.numberTextSelected,
                        ]}
                      >
                        {num}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.buttonContainer}>
                <LinearGradient
                  colors={selectedRating && !isSubmitting 
                    ? [theme.colors.rating, theme.colors.rating + 'CC'] 
                    : [theme.colors.textSecondary + '40', theme.colors.textSecondary + '20']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.submitButtonGradient,
                    (selectedRating === null || isSubmitting) && styles.submitButtonDisabled,
                  ]}
                >
                  <Pressable
                    style={styles.submitButton}
                    onPress={handleSubmit}
                    disabled={selectedRating === null || isSubmitting}
                  >
                    <Text style={styles.submitButtonText}>
                      {isSubmitting ? 'Сохранение...' : 'Оценить'}
                    </Text>
                  </Pressable>
                </LinearGradient>
                <Pressable
                  style={styles.cancelButton}
                  onPress={onClose}
                  disabled={isSubmitting}
                >
                  <Text style={styles.cancelButtonText}>Отмена</Text>
                </Pressable>
              </View>
            </Pressable>
          </Animated.View>
        </BlurView>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.backgroundDark,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    width: '90%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.background + '80',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
  },
  movieTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  ratingContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  starContainer: {
    position: 'relative',
    marginBottom: theme.spacing.md,
  },
  starIcon: {
    zIndex: 1,
  },
  starGlow: {
    position: 'absolute',
    top: -10,
    left: -10,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.rating + '30',
    zIndex: 0,
  },
  ratingLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  numbersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  numberButton: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  numberButtonSelected: {
    backgroundColor: theme.colors.rating,
    borderColor: theme.colors.rating,
    shadowColor: theme.colors.rating,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  numberText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  numberTextSelected: {
    color: theme.colors.background,
    fontWeight: 'bold',
    fontSize: theme.fontSize.md,
  },
  buttonContainer: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  submitButtonGradient: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  submitButton: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: theme.colors.background,
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cancelButton: {
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
  },
});

