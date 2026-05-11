export interface ViewportSnapshot {
  platform: string;
  isPad: boolean;
  width: number;
  height: number;
}

export interface IpadNativePresentation {
  isNativeIpadShell: boolean;
  isLandscape: boolean;
  shellDirection: 'row' | 'column';
  shellPadding: number;
  sidebarWidth: number;
}

/**
 * The native tablet shell is reserved for real iPad builds. Web keeps the
 * existing browser layout, and phones stay on the compact single-pane shell.
 */
export const isNativeIpadShell = ({ platform, isPad }: ViewportSnapshot): boolean => {
  return platform === 'ios' && isPad;
};

export const getIpadNativePresentation = (snapshot: ViewportSnapshot): IpadNativePresentation => {
  const isLandscape = snapshot.width >= snapshot.height;
  const nativeIpadShell = isNativeIpadShell(snapshot);

  return {
    isNativeIpadShell: nativeIpadShell,
    isLandscape,
    shellDirection: nativeIpadShell && isLandscape ? 'row' : 'column',
    shellPadding: nativeIpadShell ? (isLandscape ? 24 : 20) : 0,
    sidebarWidth: nativeIpadShell && isLandscape ? 280 : 0,
  };
};
