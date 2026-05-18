import React from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Board } from '../Board';
import { TabletCenter } from '../StatusPanel/TabletCenter';
import type { StatusPanelProps } from '../StatusPanel/types';

interface Props extends StatusPanelProps {
  onTilePress: (tileId: string) => void;
  onTokenMovingChange: (isMoving: boolean) => void;
}

export const TabletGameLayout: React.FC<Props> = (props) => {
  const [frame, setFrame] = React.useState<{ width: number; height: number } | null>(null);

  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    setFrame((prev) =>
      prev && prev.width === width && prev.height === height ? prev : { width, height }
    );
  };

  return (
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
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 10 },
});
