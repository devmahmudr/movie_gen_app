import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';

interface RatingModalProps {
  visible: boolean;
  currentRating?: number;
  onClose: () => void;
  onRate: (rating: number) => void;
}

export const RatingModal: React.FC<RatingModalProps> = ({
  visible,
  currentRating,
  onClose,
  onRate,
}) => {
  const [selectedRating, setSelectedRating] = useState<number>(currentRating || 0);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      setSelectedRating(currentRating || 0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, currentRating, fadeAnim]);

  const handleRatingSelect = (rating: number) => {
    setSelectedRating(rating);
  };

  const handleConfirm = () => {
    if (selectedRating > 0) {
      onRate(selectedRating);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View
          style={[
            styles.modalContent,
            {
              opacity: fadeAnim,
              transform: [
                {
                  scale: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <Text style={styles.title}>Оценить фильм</Text>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </Pressable>
            </View>

            <View style={styles.ratingContainer}>
              <Ionicons
                name="star"
                size={24}
                color="#FFD700"
                style={styles.starIcon}
              />
              <View style={styles.ratingNumbers}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                  <Pressable
                    key={rating}
                    style={[
                      styles.ratingButton,
                      selectedRating === rating && styles.ratingButtonSelected,
                    ]}
                    onPress={() => handleRatingSelect(rating)}
                  >
                    <Text
                      style={[
                        styles.ratingText,
                        selectedRating === rating && styles.ratingTextSelected,
                      ]}
                    >
                      {rating}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.actions}>
              <Pressable
                style={[
                  styles.confirmButton,
                  selectedRating === 0 && styles.confirmButtonDisabled,
                ]}
                onPress={handleConfirm}
                disabled={selectedRating === 0}
              >
                <Text
                  style={[
                    styles.confirmButtonText,
                    selectedRating === 0 && styles.confirmButtonTextDisabled,
                  ]}
                >
                  Оценить
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

// Yellow/Gold color for ratings (like most rating systems)
const RATING_COLOR = '#FFD700'; // Gold
const RATING_COLOR_DARK = '#FFA500'; // Darker gold/orange for hover states

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.backgroundDark,
    borderRadius: theme.borderRadius.lg,
    width: '90%', // 90% of screen width as shown in the image
    maxWidth: 400,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    minHeight: 60, // Ensure consistent height
  },
  starIcon: {
    marginRight: theme.spacing.sm,
  },
  ratingNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6, // Smaller gap for better spacing
    flex: 1,
    justifyContent: 'center',
    flexWrap: 'wrap', // Allow wrapping if needed
  },
  ratingButton: {
    width: 36, // Slightly larger for better touch target
    height: 36,
    borderRadius: 18, // Perfect circle
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.textSecondary,
  },
  ratingButtonSelected: {
    backgroundColor: RATING_COLOR, // Yellow/gold background
    borderColor: RATING_COLOR,
  },
  ratingText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  ratingTextSelected: {
    color: '#000000', // Black text on yellow background for better contrast
    fontWeight: '700',
  },
  actions: {
    marginTop: theme.spacing.md,
  },
  confirmButton: {
    backgroundColor: RATING_COLOR, // Yellow/gold button
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    width: '100%', // Full width button
  },
  confirmButtonDisabled: {
    backgroundColor: theme.colors.background,
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#000000', // Black text on yellow background
    fontSize: theme.fontSize.md,
    fontWeight: '700', // Bolder for better visibility
  },
  confirmButtonTextDisabled: {
    color: theme.colors.textSecondary,
  },
});
