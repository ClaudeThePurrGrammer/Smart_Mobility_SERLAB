import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, Dimensions, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
  const { user, initializing } = useAuth();
  const logoScale   = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const dotOpacity  = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    // Logo: scale + fade in
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Testo: fade in dopo 400 ms
    setTimeout(() => {
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }, 400);

    // Dots: stagger
    [0, 1, 2].forEach(i => {
      setTimeout(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(dotOpacity[i], { toValue: 1, duration: 380, useNativeDriver: true }),
            Animated.timing(dotOpacity[i], { toValue: 0.2, duration: 380, useNativeDriver: true }),
          ])
        ).start();
      }, 900 + i * 160);
    });

  }, []);

  // Naviga in base alla sessione reale, dopo un minimo di splash e una volta
  // completato il ripristino del token salvato.
  const navigated = useRef(false);
  useEffect(() => {
    if (initializing || navigated.current) return;
    navigated.current = true;
    const dest = !user
      ? '/(auth)/login'
      : user.role === 'AMMINISTRAZIONE'
        ? ('/(admin)' as any)
        : '/(app)';
    const t = setTimeout(() => router.replace(dest), 2400);
    return () => clearTimeout(t);
  }, [initializing, user]);

  return (
    <View style={styles.container}>
      {/* Background gradients */}
      <LinearGradient
        colors={['#08081A', '#0E0E26', '#08081A']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={['rgba(79,142,247,0.12)', 'transparent']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '55%' }}
      />
      <LinearGradient
        colors={['transparent', 'rgba(124,58,237,0.10)']}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%' }}
      />

      {/* Logo */}
      <Animated.View style={{
        opacity: logoOpacity,
        transform: [{ scale: logoScale }],
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 36,
        elevation: 18,
        marginBottom: 32,
      }}>
        <Image
          source={require('@/assets/logo.png')}
          style={{ width: 140, height: 140, borderRadius: 32 }}
          resizeMode="cover"
        />
      </Animated.View>

      {/* Nome app */}
      <Animated.View style={{ opacity: textOpacity, alignItems: 'center', gap: 6 }}>
        <Text style={styles.title}>SMART</Text>
        <Text style={styles.subtitle}>MOBILITY</Text>
      </Animated.View>

      {/* Loading dots */}
      <View style={styles.dots}>
        {dotOpacity.map((op, i) => (
          <Animated.View key={i} style={[styles.dot, { opacity: op }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08081A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 8,
  },
  subtitle: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 12,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 52,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
});
