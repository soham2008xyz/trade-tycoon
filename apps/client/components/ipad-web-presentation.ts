export interface ViewportSnapshot {
  platform: string;
  width: number;
  height: number;
}

export interface IpadWebPresentation {
  isTabletWebViewport: boolean;
  isLandscape: boolean;
  shellDirection: 'row' | 'column';
  shellPadding: number;
  sidebarWidth: number;
}

const MIN_TABLET_SHORT_EDGE = 744;
const MIN_TABLET_LONG_EDGE = 1024;

/**
 * Treat only roomy web viewports as iPad-class surfaces. Native iPad builds
 * already get their own tablet behavior from Expo; this helper exists so the
 * exported web app can present itself like an installable tablet app without
 * affecting phones or native clients.
 */
export const isTabletWebViewport = ({ platform, width, height }: ViewportSnapshot): boolean => {
  if (platform !== 'web') return false;
  const shortEdge = Math.min(width, height);
  const longEdge = Math.max(width, height);
  return shortEdge >= MIN_TABLET_SHORT_EDGE && longEdge >= MIN_TABLET_LONG_EDGE;
};

export const getIpadWebPresentation = (snapshot: ViewportSnapshot): IpadWebPresentation => {
  const isLandscape = snapshot.width >= snapshot.height;
  const tabletViewport = isTabletWebViewport(snapshot);

  return {
    isTabletWebViewport: tabletViewport,
    isLandscape,
    shellDirection: tabletViewport && isLandscape ? 'row' : 'column',
    shellPadding: tabletViewport ? (isLandscape ? 24 : 20) : 0,
    sidebarWidth: tabletViewport && isLandscape ? 280 : 0,
  };
};
