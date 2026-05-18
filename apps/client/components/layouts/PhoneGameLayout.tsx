import React, { useMemo, useRef } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { Board } from '../Board';
import { Peek } from '../StatusPanel/Peek';
import { Expanded } from '../StatusPanel/Expanded';
import type { StatusPanelProps } from '../StatusPanel/types';

interface Props extends StatusPanelProps {
  onTilePress: (_tileId: string) => void;
  onTokenMovingChange: (_isMoving: boolean) => void;
}

export const PhoneGameLayout: React.FC<Props> = (props) => {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['28%', '85%'], []);
  const [boardFrame, setBoardFrame] = React.useState<{ width: number; height: number } | null>(
    null
  );

  const handleBoardLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    setBoardFrame((prev) =>
      prev && prev.width === width && prev.height === height ? prev : { width, height }
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.boardArea} onLayout={handleBoardLayout}>
        <Board
          players={props.state.players}
          availableWidth={boardFrame?.width}
          availableHeight={boardFrame?.height}
          onTilePress={props.onTilePress}
          onTokenMovingChange={props.onTokenMovingChange}
          slot={null}
        />
      </View>
      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        // Disable sheet panning while the auction modal is open so its gestures
        // don't fight the modal's. Spec § "Error handling and edge cases".
        enableContentPanningGesture={props.state.phase !== 'auction'}
        enableHandlePanningGesture={props.state.phase !== 'auction'}
        keyboardBehavior="interactive"
      >
        <View style={styles.peek}>
          <Peek {...props} />
        </View>
        <Expanded {...props} />
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', padding: 10 },
  peek: { borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
});
