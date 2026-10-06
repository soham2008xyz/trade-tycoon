import { StyleSheet } from 'react-native';
import type { Theme } from '../../constants/theme';

// Shared by the online connect, lobby and status screens. A `.tsx` file
// because it imports react-native (see "File-extension discipline").
export const createOnlineStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent',
      padding: 24,
    },
    card: {
      width: '90%',
      maxWidth: 460,
      backgroundColor: theme.card,
      borderRadius: 28,
      padding: 24,
      alignItems: 'center',
      boxShadow: '0px 18px 36px rgba(0,0,0,0.2)',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 20,
      color: theme.textPrimary,
    },
    subtitle: {
      fontSize: 18,
      marginBottom: 10,
      alignSelf: 'flex-start',
      color: theme.textPrimary,
    },
    input: {
      width: '100%',
      borderWidth: 1,
      borderColor: theme.borderStrong,
      borderRadius: 8,
      padding: 12,
      marginBottom: 15,
      fontSize: 16,
      color: theme.textPrimary,
      backgroundColor: theme.surface,
    },
    buttonContainer: {
      width: '100%',
      gap: 10,
    },
    button: {
      width: '100%',
    },
    secondaryButton: {
      width: '100%',
      backgroundColor: theme.neutralButton,
      marginTop: 10,
    },
    error: {
      color: theme.errorText,
      marginBottom: 10,
    },
    playerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    colorDot: {
      width: 20,
      height: 20,
      borderRadius: 10,
      marginRight: 10,
    },
    playerText: {
      fontSize: 16,
      color: theme.textPrimary,
    },
    spacer: {
      height: 20,
    },
    roomCodeRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 20,
    },
    roomCodeButton: {
      backgroundColor: theme.neutralButton,
    },
    waitingText: {
      fontStyle: 'italic',
      color: theme.textSecondary,
      marginBottom: 20,
    },
  });
