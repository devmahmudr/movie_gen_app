import React, { useState, useEffect, useRef } from 'react';
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

interface StyledAlertProps {
  visible: boolean;
  title?: string;
  message: string;
  onClose: () => void;
  type?: 'info' | 'error' | 'warning' | 'success';
  buttonText?: string;
}

export const StyledAlert: React.FC<StyledAlertProps> = ({
  visible,
  title,
  message,
  onClose,
  type = 'info',
  buttonText = 'OK',
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
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
  }, [visible]);

  const getIcon = () => {
    switch (type) {
      case 'error':
        return 'alert-circle';
      case 'warning':
        return 'warning';
      case 'success':
        return 'checkmark-circle';
      default:
        return 'information-circle';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'error':
        return theme.colors.error;
      case 'warning':
        return theme.colors.rating;
      case 'success':
        return '#4CAF50';
      default:
        return theme.colors.primary;
    }
  };

  const getGradientColors = () => {
    switch (type) {
      case 'error':
        return [theme.colors.error, theme.colors.error + 'CC'];
      case 'warning':
        return [theme.colors.rating, theme.colors.rating + 'CC'];
      case 'success':
        return ['#4CAF50', '#4CAF50CC'];
      default:
        return [theme.colors.primary, theme.colors.secondary];
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
              styles.alertContent,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              {/* Gradient accent line */}
              <LinearGradient
                colors={getGradientColors()}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientLine}
              />

              {/* Icon */}
              <View style={styles.iconContainer}>
                <Ionicons
                  name={getIcon() as any}
                  size={48}
                  color={getIconColor()}
                />
              </View>

              {/* Title */}
              {title && (
                <Text style={styles.title}>{title}</Text>
              )}

              {/* Message */}
              <Text style={styles.message}>{message}</Text>

              {/* Button */}
              <LinearGradient
                colors={getGradientColors()}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <Pressable
                  style={styles.button}
                  onPress={onClose}
                  android_ripple={{ color: 'rgba(255, 255, 255, 0.2)' }}
                >
                  <Text style={styles.buttonText}>{buttonText}</Text>
                </Pressable>
              </LinearGradient>
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
  alertContent: {
    backgroundColor: theme.colors.backgroundDark,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    width: '85%',
    maxWidth: 400,
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
  gradientLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  message: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xs,
  },
  buttonGradient: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  button: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: theme.colors.background,
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

