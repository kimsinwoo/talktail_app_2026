import React, {useEffect, useRef} from 'react';
import {View, Text, StyleSheet, Animated} from 'react-native';

const DOT_COUNT = 3;

export function LoadingDots() {
  const anims = useRef(Array.from({length: DOT_COUNT}, () => new Animated.Value(0.3))).current;

  useEffect(() => {
    const delays = anims.map((_, i) => i * 200);
    const animations = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delays[i]),
          Animated.timing(a, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(a, {
            toValue: 0.3,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, [anims]);

  return (
    <View style={styles.container}>
      {anims.map((anim, i) => (
        <Animated.Text
          key={i}
          style={[
            styles.dot,
            {
              opacity: anim,
            },
          ]}>
          ●
        </Animated.Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dot: {
    fontSize: 14,
    color: '#2E8B7E',
  },
});
