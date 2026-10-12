import React, { useMemo, useRef } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Board } from '../Board';
import { ConnectionBanner } from '../ui/ConnectionBanner';
import { getSideBySideBoardArea, isSideBySide } from '../board-size';
import { Peek } from '../StatusPanel/Peek';
import { Expanded } from '../StatusPanel/Expanded';
import type { StatusPanelProps } from '../StatusPanel/types';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../constants/theme';

interface Props extends StatusPanelProps {
  onTilePress: (_tileId: string) => void;
  onTokenMovingChange: (_isMoving: boolean) => void;
}

interface Frame {
  width: number;
  height: number;
}

/** A view's laid-out size, kept referentially stable while it does not change. */
const useMeasuredFrame = (): [Frame | null, (_event: LayoutChangeEvent) => void] => {
  const [frame, setFrame] = React.useState<Frame | null>(null);
  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    setFrame((prev) =>
      prev && prev.width === width && prev.height === height ? prev : { width, height }
    );
  };
  return [frame, onLayout];
};

const isCurrentPlayerJailed = (state: Props['state']): boolean =>
  state.players.some((player) => player.id === state.currentPlayerId && player.isInJail);

// Jail guidance and a held-card action can add rows. Keep every action above
// the collapsed sheet's edge when they fit; oversized content can scroll.
const useSnapPoints = (isJailed: boolean, layoutHeight: number, peekHeight: number) =>
  useMemo(
    () =>
      isJailed && layoutHeight > 0 && peekHeight > 0
        ? [Math.min(Math.max(layoutHeight * 0.28, peekHeight + 24), layoutHeight * 0.85 - 1), '85%']
        : ['28%', '85%'],
    [isJailed, layoutHeight, peekHeight]
  );

// Peek and Expanded take the whole panel prop bag. They are created with
// createElement rather than <Peek {...props} />: a JSX spread that ends a tag
// makes Lizard (the CI complexity analysis) lose where the component ends and
// fold the rest of the file into it.
const renderPeek = (panel: Props) => React.createElement(Peek, panel);
const renderExpanded = (panel: Props, scrollable?: boolean) =>
  React.createElement(Expanded, { ...panel, scrollable });

interface BoardPaneProps {
  panel: Props;
  sideBySide: boolean;
  frame: Frame;
}

/**
 * zIndex: 0 makes this wrapper its own stacking context. Board's corners/center/
 * tokens use zIndex 10-100+, which otherwise compete with the sibling sheet
 * at the root and paint over the Players list and Trade button (#257).
 * The top inset (status bar / notch / Dynamic Island) is padding on this
 * wrapper rather than on boardArea: boardArea's onLayout then reports the
 * inset-adjusted frame, so Board sizes itself to the visible area (#250).
 */
const BoardPane: React.FC<BoardPaneProps> = ({ panel, sideBySide, frame }) => {
  const styles = createStyles(useTheme());
  const insets = useSafeAreaInsets();
  const [boardFrame, onBoardLayout] = useMeasuredFrame();
  // The default floor would clip a short landscape viewport.
  const minSize = sideBySide ? 0 : undefined;

  return (
    <View
      style={[
        styles.boardWrapper,
        { paddingTop: insets.top },
        sideBySide && {
          // Not flex: 0, because react-native-web turns that into a 0% basis, which
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
      <ConnectionBanner />
      <View style={styles.boardArea} onLayout={onBoardLayout}>
        <Board
          players={panel.state.players}
          availableWidth={boardFrame?.width}
          availableHeight={boardFrame?.height}
          minSize={minSize}
          onTilePress={panel.onTilePress}
          onTokenMovingChange={panel.onTokenMovingChange}
          slot={null}
        />
      </View>
    </View>
  );
};

interface SidePanelProps {
  panel: Props;
}

/** Landscape: the status panel beside the board, scrolling as one column. */
const SidePanel: React.FC<SidePanelProps> = ({ panel }) => {
  const styles = createStyles(useTheme());
  return (
    <ScrollView style={styles.sidePanel}>
      {/* Peek first so the turn's actions are visible without scrolling. */}
      <View style={styles.peek}>{renderPeek(panel)}</View>
      {renderExpanded(panel, false)}
    </ScrollView>
  );
};

interface SheetContentProps {
  panel: Props;
  isJailed: boolean;
  onPeekHeight: (_height: number) => void;
}

/** The Peek summary and the Expanded panel, scrolling together when the player is jailed. */
const SheetContent: React.FC<SheetContentProps> = ({ panel, isJailed, onPeekHeight }) => {
  const styles = createStyles(useTheme());
  const insets = useSafeAreaInsets();

  if (!isJailed) {
    return (
      <>
        <View style={styles.peek}>{renderPeek(panel)}</View>
        {renderExpanded(panel)}
      </>
    );
  }
  // The measured Peek can exceed the largest snap point with large text
  // or a short viewport. Scroll the whole jailed panel rather than
  // putting unreachable controls below a fixed, non-scrolling header.
  return (
    <BottomSheetScrollView>
      <View
        style={[styles.peek, { paddingBottom: insets.bottom }]}
        onLayout={({ nativeEvent }) => onPeekHeight(nativeEvent.layout.height)}
      >
        {renderPeek(panel)}
      </View>
      {renderExpanded(panel, false)}
    </BottomSheetScrollView>
  );
};

interface PhoneSheetProps extends SheetContentProps {
  snapPoints: (string | number)[];
}

/**
 * Portrait: the status panel in a bottom sheet over the board. The sheet sits
 * above boardArea (zIndex 0 in the styles); elevation is the Android
 * equivalent, where elevation rather than zIndex decides draw order across
 * siblings. It paints its own white background and handle by default, so both
 * are themed through the style props below.
 */
const PhoneSheet: React.FC<PhoneSheetProps> = ({ panel, isJailed, onPeekHeight, snapPoints }) => {
  const sheetRef = useRef<BottomSheet>(null);
  const styles = createStyles(useTheme());
  // Disable sheet panning while the auction modal is open so its gestures
  // don't fight the modal's. Spec § "Error handling and edge cases".
  const canPan = panel.state.phase !== 'auction';

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      containerStyle={styles.sheetContainer}
      style={styles.sheet}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.sheetHandle}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose={false}
      enableContentPanningGesture={canPan}
      enableHandlePanningGesture={canPan}
      keyboardBehavior="interactive"
    >
      <SheetContent panel={panel} isJailed={isJailed} onPeekHeight={onPeekHeight} />
    </BottomSheet>
  );
};

export const PhoneGameLayout: React.FC<Props> = (props) => {
  const styles = createStyles(useTheme());
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const [rootFrame, onRootLayout] = useMeasuredFrame();
  // Before the first layout pass the window stands in for the root frame.
  const frame = rootFrame ?? win;
  // In landscape (web only — native locks to portrait) a collapsed sheet would
  // cover most of the board and push the actions off screen, so the panel sits
  // beside the board instead (#288).
  const sideBySide = isSideBySide(frame.width, frame.height);
  const [peekHeight, setPeekHeight] = React.useState(0);
  const isJailed = isCurrentPlayerJailed(props.state);
  const snapPoints = useSnapPoints(isJailed, rootFrame?.height ?? 0, peekHeight);
  const rootStyle = [
    styles.root,
    sideBySide && styles.rootSideBySide,
    sideBySide && {
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingBottom: insets.bottom,
    },
  ];

  return (
    <View style={rootStyle} onLayout={onRootLayout}>
      {/* The board wrapper stays the first child in both arrangements so a
          rotation keeps the same Board and token instances. */}
      <BoardPane panel={props} sideBySide={sideBySide} frame={frame} />
      {sideBySide ? (
        <SidePanel panel={props} />
      ) : (
        <PhoneSheet
          panel={props}
          isJailed={isJailed}
          snapPoints={snapPoints}
          onPeekHeight={setPeekHeight}
        />
      )}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.background },
    rootSideBySide: { flexDirection: 'row' },
    boardWrapper: { flex: 1, zIndex: 0 },
    boardArea: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: 10,
    },
    sidePanel: { flex: 1, borderLeftWidth: 1, borderLeftColor: theme.border },
    sheetContainer: { zIndex: 1, elevation: 10 },
    sheet: { elevation: 10 },
    peek: { borderBottomWidth: 1, borderBottomColor: theme.border },
    sheetBackground: { backgroundColor: theme.surface },
    sheetHandle: { backgroundColor: theme.borderStrong },
  });
