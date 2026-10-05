import React, { useMemo, useRef } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Board } from '../Board';
import { getSideBySideBoardArea, isSideBySide } from '../board-size';
import { Peek } from '../StatusPanel/Peek';
import { Expanded } from '../StatusPanel/Expanded';
import type { StatusPanelProps } from '../StatusPanel/types';

interface Props extends StatusPanelProps {
  onTilePress: (_tileId: string) => void;
  onTokenMovingChange: (_isMoving: boolean) => void;
}

export const PhoneGameLayout: React.FC<Props> = (props) => {
  const sheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const [rootFrame, setRootFrame] = React.useState<{ width: number; height: number } | null>(null);
  const layoutHeight = rootFrame?.height ?? 0;
  // Before the first layout pass the window stands in for the root frame.
  const frame = rootFrame ?? win;
  const sideBySide = isSideBySide(frame.width, frame.height);
  const [peekHeight, setPeekHeight] = React.useState(0);
  const isCurrentPlayerInJail = props.state.players.some(
    (player) => player.id === props.state.currentPlayerId && player.isInJail
  );
  // Jail guidance and a held-card action can add rows. Keep every action above
  // the collapsed sheet's edge when they fit; oversized content can scroll.
  const snapPoints = useMemo(
    () =>
      isCurrentPlayerInJail && layoutHeight > 0 && peekHeight > 0
        ? [Math.min(Math.max(layoutHeight * 0.28, peekHeight + 24), layoutHeight * 0.85 - 1), '85%']
        : ['28%', '85%'],
    [isCurrentPlayerInJail, layoutHeight, peekHeight]
  );
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
    <View
      style={[
        styles.root,
        sideBySide && styles.rootSideBySide,
        sideBySide && {
          paddingLeft: insets.left,
          paddingRight: insets.right,
          paddingBottom: insets.bottom,
        },
      ]}
      onLayout={({ nativeEvent }) => {
        const { width, height } = nativeEvent.layout;
        setRootFrame((prev) =>
          prev && prev.width === width && prev.height === height ? prev : { width, height }
        );
      }}
    >
      {/* zIndex: 0 makes this wrapper its own stacking context. Board's corners/center/
          tokens use zIndex 10-100+, which otherwise compete with the sibling sheet
          at the root and paint over the Players list and Trade button (#257).
          The top inset (status bar / notch / Dynamic Island) is padding on this
          wrapper rather than on boardArea: boardArea's onLayout then reports the
          inset-adjusted frame, so Board sizes itself to the visible area (#250). */}
      {/* In landscape (web only — native locks to portrait) a collapsed sheet would
          cover most of the board and push the actions off screen, so the panel sits
          beside the board instead (#288). The board wrapper stays the first child in
          both arrangements so a rotation keeps the same Board and token instances. */}
      <View
        style={[
          styles.boardWrapper,
          { paddingTop: insets.top },
          sideBySide && {
            // Not `flex: 0`: react-native-web turns that into a 0% basis, which
            // overrides the width and collapses the board.
            flexGrow: 0,
            flexShrink: 0,
            flexBasis: 'auto',
            width: getSideBySideBoardArea(
              frame.width - insets.left - insets.right,
              frame.height - insets.bottom
            ),
          },
        ]}
      >
        <View style={styles.boardArea} onLayout={handleBoardLayout}>
          <Board
            players={props.state.players}
            availableWidth={boardFrame?.width}
            availableHeight={boardFrame?.height}
            // The default floor would clip a short landscape viewport.
            minSize={sideBySide ? 0 : undefined}
            onTilePress={props.onTilePress}
            onTokenMovingChange={props.onTokenMovingChange}
            slot={null}
          />
        </View>
      </View>
      {sideBySide ? (
        <ScrollView style={styles.sidePanel}>
          {/* Peek first so the turn's actions are visible without scrolling. */}
          <View style={styles.peek}>
            <Peek {...props} />
          </View>
          <Expanded {...props} scrollable={false} />
        </ScrollView>
      ) : (
        <BottomSheet
          ref={sheetRef}
          index={0}
          // Above boardArea (zIndex 0); elevation is the Android equivalent, where
          // elevation rather than zIndex decides draw order across siblings.
          containerStyle={styles.sheetContainer}
          style={styles.sheet}
          snapPoints={snapPoints}
          enableDynamicSizing={false}
          enablePanDownToClose={false}
          // Disable sheet panning while the auction modal is open so its gestures
          // don't fight the modal's. Spec § "Error handling and edge cases".
          enableContentPanningGesture={props.state.phase !== 'auction'}
          enableHandlePanningGesture={props.state.phase !== 'auction'}
          keyboardBehavior="interactive"
        >
          {isCurrentPlayerInJail ? (
            // The measured Peek can exceed the largest snap point with large text
            // or a short viewport. Scroll the whole jailed panel rather than
            // putting unreachable controls below a fixed, non-scrolling header.
            <BottomSheetScrollView>
              <View
                style={[styles.peek, { paddingBottom: insets.bottom }]}
                onLayout={({ nativeEvent }) => setPeekHeight(nativeEvent.layout.height)}
              >
                <Peek {...props} />
              </View>
              <Expanded {...props} scrollable={false} />
            </BottomSheetScrollView>
          ) : (
            <>
              <View style={styles.peek}>
                <Peek {...props} />
              </View>
              <Expanded {...props} />
            </>
          )}
        </BottomSheet>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  rootSideBySide: { flexDirection: 'row' },
  boardWrapper: { flex: 1, zIndex: 0 },
  boardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 10,
  },
  sidePanel: { flex: 1, borderLeftWidth: 1, borderLeftColor: '#e5e7eb' },
  sheetContainer: { zIndex: 1, elevation: 10 },
  sheet: { elevation: 10 },
  peek: { borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
});
