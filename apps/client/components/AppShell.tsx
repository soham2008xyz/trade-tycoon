import React from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { getIpadNativePresentation } from './ipad-native-presentation';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { width, height } = useWindowDimensions();
  const presentation = getIpadNativePresentation({
    platform: Platform.OS,
    isPad: Platform.OS === 'ios' ? Platform.isPad : false,
    width,
    height,
  });

  if (!presentation.isNativeIpadShell) {
    return <View style={styles.phoneShell}>{children}</View>;
  }

  return (
    <View style={styles.root}>
      <View style={[styles.glow, styles.glowTop]} pointerEvents="none" />
      <View style={[styles.glow, styles.glowBottom]} pointerEvents="none" />

      <View
        style={[
          styles.shell,
          {
            flexDirection: presentation.shellDirection,
            padding: presentation.shellPadding,
          },
        ]}
      >
        {presentation.isLandscape && (
          <View style={[styles.sidebar, { width: presentation.sidebarWidth }]}>
            <Text style={styles.eyebrow}>Native iPad App</Text>
            <Text style={styles.sidebarTitle}>Trade Tycoon</Text>
            <Text style={styles.sidebarBody}>
              This layout is reserved for the native iPad build so the board can breathe, the action
              flow can stay visible, and the game feels at home on a tablet screen.
            </Text>

            <View style={styles.sidebarCard}>
              <Text style={styles.cardLabel}>Orientation</Text>
              <Text style={styles.cardValue}>
                Full-screen landscape on iPad, portrait preserved on phones
              </Text>
            </View>

            <View style={styles.sidebarCard}>
              <Text style={styles.cardLabel}>Board Stage</Text>
              <Text style={styles.cardValue}>
                Measured from the live app stage so the sidebar never crowds the board
              </Text>
            </View>
          </View>
        )}

        <View style={styles.stage}>
          <View style={styles.stageInner}>{children}</View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#08111f',
  },
  phoneShell: {
    flex: 1,
    backgroundColor: '#1c2434',
  },
  shell: {
    flex: 1,
    gap: 24,
  },
  sidebar: {
    borderRadius: 28,
    backgroundColor: 'rgba(9, 18, 35, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(140, 180, 255, 0.22)',
    padding: 28,
    gap: 18,
    boxShadow: '0px 24px 48px rgba(0,0,0,0.28)',
  },
  eyebrow: {
    color: '#8bd3ff',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontSize: 12,
    fontWeight: '700',
  },
  sidebarTitle: {
    color: '#f8fbff',
    fontSize: 34,
    fontWeight: '800',
  },
  sidebarBody: {
    color: '#d5def0',
    fontSize: 16,
    lineHeight: 24,
  },
  sidebarCard: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 18,
    gap: 8,
  },
  cardLabel: {
    color: '#8bd3ff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardValue: {
    color: '#f8fbff',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  stage: {
    flex: 1,
    minHeight: 0,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#1c2434',
    borderWidth: 1,
    borderColor: 'rgba(140, 180, 255, 0.18)',
    boxShadow: '0px 28px 56px rgba(0,0,0,0.32)',
  },
  stageInner: {
    flex: 1,
    backgroundColor: '#1c2434',
  },
  glow: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.5,
  },
  glowTop: {
    width: 360,
    height: 360,
    top: -100,
    right: -40,
    backgroundColor: '#1f5fff',
  },
  glowBottom: {
    width: 340,
    height: 340,
    bottom: -120,
    left: -60,
    backgroundColor: '#0f9d7a',
  },
});
