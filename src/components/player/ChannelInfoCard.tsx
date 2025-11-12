import React, { useEffect, useRef } from 'react';
import { Animated, Image, Platform, Text, View } from 'react-native';
import { Channel, EPGProgram } from '../../types';

interface ChannelInfoCardProps {
  channel: Channel | null;
  program: EPGProgram | null;
  visible: boolean;
  onHide: () => void;
}

const ChannelInfoCard: React.FC<ChannelInfoCardProps> = ({
  channel,
  program,
  visible,
  onHide,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const [imageError, setImageError] = React.useState(false);

  const hideCard = React.useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide();
    });
  }, [onHide]);

  useEffect(() => {
    // Reset image error when channel changes
    setImageError(false);
  }, [channel?.id]);

  useEffect(() => {
    if (visible) {
      // Show animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-hide after 4 seconds
      const timer = setTimeout(() => {
        hideCard();
      }, 4000);

      return () => clearTimeout(timer);
    } else {
      hideCard();
    }
  }, [visible, hideCard]);

  if (!visible || !channel) return null;

  const startDate =
    program && program.start ? new Date(program.start) : null;
  const endDate =
    program && program.end ? new Date(program.end) : null;

  const isValidDate = (date: Date | null) =>
    !!date && !Number.isNaN(date.getTime());

  const timeString =
    isValidDate(startDate) && isValidDate(endDate)
      ? `${startDate!.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })} - ${endDate!.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}`
      : '';

  const safeDescription =
    program && typeof program.description === 'string'
      ? program.description.trim()
      : '';

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: Platform.OS === 'android' ? 60 : 40,
        left: 20,
        right: 20,
        zIndex: 100,
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
      pointerEvents="none"
    >
      <View
        className="bg-slate-900/95 rounded-2xl border-2 border-cyan-400/60 shadow-2xl px-6 py-5"
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: 'rgba(34, 211, 238, 0.3)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.5,
          shadowRadius: 16,
          elevation: 20,
        }}
      >
        {/* Channel Name */}
        <View className="flex-row items-center mb-3">
          {channel.logo && !imageError ? (
            <View className="mr-3">
              <View
                style={{
                  width: 56,
                  height: 56,
                  backgroundColor: '#fff',
                  borderRadius: 8,
                  overflow: 'hidden',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Image
                  source={{ uri: channel.logo }}
                  style={{
                    width: '100%',
                    height: '100%',
                    resizeMode: 'contain',
                  }}
                  onError={() => setImageError(true)}
                />
              </View>
            </View>
          ) : channel.logo ? (
            <View className="mr-3">
              <View
                style={{
                  width: 56,
                  height: 56,
                  backgroundColor: '#e5e7eb',
                  borderRadius: 8,
                  overflow: 'hidden',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    color: '#6b7280',
                    fontSize: 20,
                    fontWeight: '700',
                  }}
                >
                  {channel.name.substring(0, 2).toUpperCase()}
                </Text>
              </View>
            </View>
          ) : null}
          <View className="flex-1">
            <Text
              className="text-cyan-50 font-extrabold text-2xl leading-tight"
              style={{
                color: '#ecfeff',
                fontWeight: '800',
                fontSize: 24,
                lineHeight: 28,
              }}
              numberOfLines={1}
            >
              {channel.name || 'Unknown Channel'}
            </Text>
            {channel.number && (
              <Text
                className="text-cyan-300 font-semibold text-base mt-1"
                style={{
                  color: '#67e8f9',
                  fontWeight: '600',
                  fontSize: 16,
                  marginTop: 4,
                }}
              >
                Channel {channel.number}
              </Text>
            )}
          </View>
        </View>

        {/* Current Program */}
        {program && (
          <View className="mt-2 pt-3 border-t border-slate-700/50">
            <Text
              className="text-cyan-50 font-bold text-lg mb-1"
              style={{
                color: '#ecfeff',
                fontWeight: '700',
                fontSize: 18,
                marginBottom: 4,
              }}
              numberOfLines={2}
            >
              {program.title}
            </Text>
            {timeString && (
              <Text
                className="text-cyan-300 font-medium text-sm"
                style={{
                  color: '#67e8f9',
                  fontWeight: '500',
                  fontSize: 14,
                }}
              >
                {timeString}
              </Text>
            )}
            {safeDescription ? (
              <Text
                className="text-gray-300 text-sm mt-2 leading-relaxed"
                style={{
                  color: '#d1d5db',
                  fontSize: 14,
                  marginTop: 8,
                  lineHeight: 20,
                }}
                numberOfLines={2}
              >
                {safeDescription}
              </Text>
            ) : null}
          </View>
        )}

        {!program && (
          <View className="mt-2 pt-3 border-t border-slate-700/50">
            <Text
              className="text-gray-400 text-base font-medium"
              style={{
                color: '#9ca3af',
                fontSize: 16,
                fontWeight: '500',
              }}
            >
              No program information available
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

export default ChannelInfoCard;

