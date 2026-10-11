import { StyleSheet } from 'react-native';
import type { Theme } from '../../constants/theme';

// A `.tsx` module without JSX on purpose: it imports `StyleSheet`, so it must
// not be a pure `.ts` helper (see "File-extension discipline" in
// apps/client/AGENTS.md). The trade modal's pieces share one sheet, so a
// style is written once wherever it is used.
export const createTradeStyles = (theme: Theme) =>
  StyleSheet.create({
    phoneOverlay: { flex: 1, backgroundColor: theme.surface },
    phoneContent: { flex: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
    // flex:1 (not flexGrow:0) so the Propose button row pins to the bottom.
    phoneScrollArea: { flex: 1, marginBottom: 12 },
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.scrim,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      width: '95%',
      maxHeight: '90%',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 20,
      boxShadow: '0px 2px 4px rgba(0,0,0,0.25)',
      elevation: 5,
    },
    headerRow: {
      marginBottom: 10,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      minHeight: 30,
    },
    closeButtonContainer: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    },
    text: { color: theme.textPrimary },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      textAlign: 'center',
      color: theme.textPrimary,
    },
    headerSubtitle: {
      fontSize: 16,
      textAlign: 'center',
      marginBottom: 10,
      fontStyle: 'italic',
      color: theme.textPrimary,
    },
    scrollArea: {
      flexGrow: 0,
      marginBottom: 20,
    },
    columns: {
      flexDirection: 'row',
    },
    column: {
      flex: 1,
      paddingHorizontal: 5,
    },
    divider: {
      width: 1,
      backgroundColor: theme.borderStrong,
      marginHorizontal: 5,
    },
    subtitle: {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 10,
      textAlign: 'center',
      textDecorationLine: 'underline',
      color: theme.textPrimary,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.borderStrong,
      borderRadius: 5,
      padding: 5,
      marginBottom: 10,
      marginTop: 5,
    },
    row: {
      marginBottom: 10,
    },
    stepper: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: 90,
      marginTop: 5,
    },
    stepperBtn: {
      width: 40,
      height: 30,
      paddingHorizontal: 0,
      paddingVertical: 0,
    },
    propHeader: {
      color: theme.textPrimary,
      fontWeight: 'bold',
      marginTop: 10,
      marginBottom: 5,
    },
    emptyText: {
      fontStyle: 'italic',
      color: theme.textMuted,
    },
    propItem: {
      marginBottom: 2,
    },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    propText: {
      color: theme.textPrimary,
      marginLeft: 8,
      flexShrink: 1,
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: 10,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
    },
    playerColor: {
      marginHorizontal: 8,
    },
    propertyColor: {
      width: 16,
      height: 16,
      marginHorizontal: 8,
      borderRadius: 3,
      borderWidth: 1,
      borderColor: theme.textMuted,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
    },
    // Single-line heading so both proposal columns keep the same height; the
    // shared `nameRow` wraps, which dropped the dot onto its own line.
    columnHeadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    columnHeadingDot: {
      marginHorizontal: 4,
    },
    columnHeadingText: {
      flexShrink: 1,
      marginBottom: 0,
    },
    sliderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    slider: {
      flex: 1,
      height: 40,
    },
    moneyText: {
      fontSize: 16,
      fontWeight: 'bold',
      marginRight: 10,
      color: theme.textPrimary,
      width: 50, // Fixed width to prevent jumping
      textAlign: 'right',
    },
  });
