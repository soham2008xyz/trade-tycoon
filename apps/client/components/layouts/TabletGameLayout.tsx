import React from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Board } from '../Board';
import { TabletCenter } from '../StatusPanel/TabletCenter';
import type { StatusPanelProps } from '../StatusPanel/types';

interface Props extends StatusPanelProps {
  onTilePress: (_tileId: string) => void;
  onTokenMovingChange: (_isMoving: boolean) => void;
}

export const TabletGameLayout: React.FC<Props> = (props) => {
  const insets = useSafeAreaInsets();
  const [frame, setFrame] = React.useState<{ width: number; height: number } | null>(null);

  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    setFrame((prev) =>
      prev && prev.width === width && prev.height === height ? prev : { width, height }
    );
  };

  return (
    // Outer wrapper carries the status-bar inset (iPad shows one too) so the inner
    // onLayout frame, which sizes the Board, excludes it (#250).
    <View style={[styles.wrapper, { paddingTop: insets.top }]}>
      <View style={styles.root} onLayout={onLayout}>
        <Board
          players={props.state.players}
          availableWidth={frame?.width}
          availableHeight={frame?.height}
          onTilePress={props.onTilePress}
          onTokenMovingChange={props.onTokenMovingChange}
          slot={<TabletCenter {...props} />}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 10 },
});
