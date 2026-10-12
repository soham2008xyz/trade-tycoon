import React from 'react';
import { BOARD } from '@trade-tycoon/game-logic';

/** The game screen's own UI state: the log modal, the tapped tile, and token animation. */
export const useScreenState = () => {
  const [logVisible, setLogVisible] = React.useState(false);
  const [selectedTileId, setSelectedTileId] = React.useState<string | null>(null);
  const [isTokenMoving, setIsTokenMoving] = React.useState(false);
  const openLog = React.useCallback(() => {
    setLogVisible(true);
  }, []);
  const closeLog = () => {
    setLogVisible(false);
  };
  const clearSelectedTile = () => {
    setSelectedTileId(null);
  };
  const selectedTile = selectedTileId ? BOARD.find((t) => t.id === selectedTileId) || null : null;

  return {
    logVisible,
    openLog,
    closeLog,
    selectedTile,
    selectedTileId,
    selectTile: setSelectedTileId,
    clearSelectedTile,
    isTokenMoving,
    setIsTokenMoving,
  };
};
