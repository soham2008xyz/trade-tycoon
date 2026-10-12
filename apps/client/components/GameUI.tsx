import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GameToasts } from './GameToasts';
import { GameModals } from './GameModals';
import { TabletGameLayout } from './layouts/TabletGameLayout';
import { PhoneGameLayout } from './layouts/PhoneGameLayout';
import { useGameLayout } from '../hooks/useGameLayout';
import { useGameFlows } from '../hooks/useGameFlows';
import { useLayoutProps } from '../hooks/useLayoutProps';
import type { GameUIProps } from './game-ui-props';

export const GameUI: React.FC<GameUIProps> = (props) => {
  const { uiToastMessage, setUiToastMessage } = props;
  const layout = useGameLayout();
  const flows = useGameFlows(props);
  const layoutProps = useLayoutProps(props, flows);
  const dismissUiToast = () => {
    setUiToastMessage(null);
  };

  // The feedback and UI toasts render in exactly one place: two copies would
  // announce twice and, in hotseat, dispatch the dismiss twice. Moving between
  // places remounts the toast, restarting its timer (it is not announced
  // again; see `Toast`); that only happens when a modal opens or closes.
  const toasts = (
    <GameToasts
      feedback={flows.feedback.feedback}
      onDismissFeedback={flows.feedback.dismiss}
      uiToastMessage={uiToastMessage}
      onDismissUiToast={dismissUiToast}
    />
  );
  const Layout = layout === 'phone' ? PhoneGameLayout : TabletGameLayout;

  return (
    <View style={styles.container}>
      {flows.toastHost === null && toasts}
      {React.createElement(Layout, layoutProps)}
      <GameModals ui={props} flows={flows} toasts={toasts} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', width: '100%', height: '100%' },
});
