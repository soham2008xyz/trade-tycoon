import React from 'react';
import type { AlertOptions } from '../components/ui/Alert';

export type ShowAlert = (title: string, message: string, buttons: AlertOptions['buttons']) => void;

/** The state behind the game's `CustomAlert`: whether it is open and what it says. */
export const useGameAlert = () => {
  const [visible, setVisible] = React.useState(false);
  const [options, setOptions] = React.useState<AlertOptions | null>(null);

  const showAlert = React.useCallback<ShowAlert>((title, message, buttons) => {
    setOptions({ title, message, buttons });
    setVisible(true);
  }, []);
  const closeAlert = React.useCallback(() => {
    setVisible(false);
  }, []);

  return { visible, options, showAlert, closeAlert };
};
