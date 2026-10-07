import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { FullScreenModalShell } from './ui/FullScreenModalShell';
import { Player, TradeOffer, TradeRequest, BOARD } from '@trade-tycoon/game-logic';
import { IconButton } from './ui/IconButton';
import { CloseButton } from './ui/CloseButton';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { GROUP_COLORS } from '../constants';
import { canAcceptTrade, canCancelTrade } from './multiplayer-gating';
import { useGameLayout } from '../hooks/useGameLayout';
import { moneyFromSlider, moneySliderMax, sliderFromMoney } from './trade-money';
import { useTheme } from '../hooks/useTheme';
import type { Theme } from '../constants/theme';
import { formatMoney } from './format-money';

export { canAcceptTrade, canCancelTrade };

/**
 * Accessibility props for a property row that toggles in or out of the offer.
 * Native gets a real checkbox. On web react-native-web only fires Space on
 * `role="button"` (it does not turn `role="checkbox"` into an `<input>`), so
 * the row stays a button there and reports its state with `aria-pressed`.
 */
const checkRowA11yProps = (isChecked: boolean, label: string) =>
  Platform.OS === 'web'
    ? { accessibilityRole: 'button' as const, 'aria-pressed': isChecked, accessibilityLabel: label }
    : {
        accessibilityRole: 'checkbox' as const,
        'aria-checked': isChecked,
        accessibilityLabel: label,
      };

/**
 * One property line in the trade-proposal display (color swatch + tile name).
 * Extracted from `renderContent` so the two property-list `.map()` callbacks
 * stop pumping cyclomatic complexity into the parent.
 */
const TradePropertyLine: React.FC<{ tileId: string }> = ({ tileId }) => {
  const styles = createStyles(useTheme());
  const tile = BOARD.find((t) => t.id === tileId);
  const groupColor = tile?.group ? GROUP_COLORS[tile.group] : null;
  return (
    <View style={[styles.propItem, styles.nameRow, { justifyContent: 'flex-start' }]}>
      {groupColor && <View style={[styles.propertyColor, { backgroundColor: groupColor }]} />}
      <Text style={styles.text}>• {tile?.name}</Text>
    </View>
  );
};

interface Props {
  visible: boolean;
  players: Player[];
  currentPlayerId: string;
  targetPlayerId?: string; // Who we are proposing to
  activeTrade?: TradeRequest | null; // Existing trade
  onPropose: (targetPlayerId: string, offer: TradeOffer, request: TradeOffer) => void;
  onAccept: (tradeId: string) => void;
  onReject: (tradeId: string) => void;
  onCancel: (tradeId: string) => void;
  onClose: () => void;
  /** Toasts to draw above the modal while it is open (see `FullScreenModalShell`). */
  overlay?: React.ReactNode;
  /**
   * In online multiplayer the modal renders on every client involved in the
   * trade, so each client must only see the buttons it can actually act on:
   * the target sees Accept/Reject, the initiator sees Cancel. In local
   * hotseat play (default `false`) the user passes the device between
   * players, so all three buttons render and the user clicks whichever one
   * the active player is supposed to use.
   */
  isMultiplayer?: boolean;
}

// `canAcceptTrade` and `canCancelTrade` live in `./multiplayer-gating` so
// they can be unit-tested in a plain Node vitest environment without React
// Native. They are re-exported above so existing imports keep working.

export const TradeModal: React.FC<Props> = ({
  visible,
  players,
  currentPlayerId,
  targetPlayerId,
  activeTrade,
  onPropose,
  onAccept,
  onReject,
  onCancel,
  onClose,
  overlay,
  isMultiplayer = false,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  // On phone the shell already draws the "Trade" title + close button and
  // fills the screen, so the card-on-grey-backdrop chrome (own ✕, redundant
  // Cancel, "Trade Proposal" heading) would duplicate it. Wide layouts get a
  // bare transparent Modal from the shell, so there the card keeps its chrome.
  const isPhone = useGameLayout() === 'phone';

  const [offerMoney, setOfferMoney] = useState(0);
  const [offerProps, setOfferProps] = useState<string[]>([]);
  const [offerCards, setOfferCards] = useState(0);

  const [reqMoney, setReqMoney] = useState(0);
  const [reqProps, setReqProps] = useState<string[]>([]);
  const [reqCards, setReqCards] = useState(0);

  // Cache the display props to persist content during exit animation
  const [cachedState, setCachedState] = useState<{
    activeTrade?: TradeRequest | null;
    targetPlayerId?: string;
  }>({
    activeTrade,
    targetPlayerId,
  });

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- We must synchronously cache the active trade details when the modal is open so that the native Modal exit slide transition continues to render the trade details instead of abruptly blanking out when the parent clears them on close.
      setCachedState({
        activeTrade,
        targetPlayerId,
      });
    }
  }, [visible, activeTrade, targetPlayerId]);

  const effectiveActiveTrade = visible ? activeTrade : cachedState.activeTrade;
  const effectiveTargetId = visible ? targetPlayerId : cachedState.targetPlayerId;

  const initiator = players.find((p) => p.id === currentPlayerId);
  const target = players.find((p) => p.id === effectiveTargetId);

  // Reset state when opening fresh
  useEffect(() => {
    if (visible && !activeTrade) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- We must reset the proposal input state synchronously when opening the modal fresh so that the input sliders, properties list, and cash values are initialized to zero instead of carrying over values from the previous proposal.
      setOfferMoney(0);
      setOfferProps([]);
      setOfferCards(0);
      setReqMoney(0);
      setReqProps([]);
      setReqCards(0);
    }
  }, [visible, activeTrade]);

  const toggleOfferProp = (id: string) => {
    if (offerProps.includes(id)) {
      setOfferProps(offerProps.filter((p) => p !== id));
    } else {
      setOfferProps([...offerProps, id]);
    }
  };

  const toggleReqProp = (id: string) => {
    if (reqProps.includes(id)) {
      setReqProps(reqProps.filter((p) => p !== id));
    } else {
      setReqProps([...reqProps, id]);
    }
  };

  const handlePropose = () => {
    if (!target) return;

    const offer: TradeOffer = {
      money: offerMoney,
      properties: offerProps,
      getOutOfJailCards: offerCards,
    };
    onPropose(target.id, offer, {
      money: reqMoney,
      properties: reqProps,
      getOutOfJailCards: reqCards,
    });
  };

  const renderContent = () => {
    if (effectiveActiveTrade) {
      const tradeInitiator = players.find((p) => p.id === effectiveActiveTrade.initiatorId);
      const tradeTarget = players.find((p) => p.id === effectiveActiveTrade.targetPlayerId);

      return (
        <View style={isPhone ? styles.phoneContent : styles.modalContent}>
          {!isPhone && <Text style={styles.title}>Trade Proposal</Text>}
          <View style={[styles.headerSubtitle, styles.nameRow, { flexWrap: 'wrap' }]}>
            <View style={[styles.playerColor, { backgroundColor: tradeInitiator?.color }]} />
            <Text style={styles.text}>{tradeInitiator?.name}</Text>
            <Text style={styles.text}> offers to </Text>
            <View style={[styles.playerColor, { backgroundColor: tradeTarget?.color }]} />
            <Text style={styles.text}>{tradeTarget?.name}:</Text>
          </View>
          <View style={styles.columns}>
            <View style={styles.column}>
              <View style={styles.columnHeadingRow}>
                <View
                  style={[
                    styles.playerColor,
                    styles.columnHeadingDot,
                    { backgroundColor: tradeTarget?.color },
                  ]}
                />
                <Text
                  style={[styles.subtitle, styles.columnHeadingText]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {tradeTarget?.name} Receives:
                </Text>
              </View>
              <Text style={styles.text}>Money: ${effectiveActiveTrade.offer.money}</Text>
              <Text style={styles.text}>
                GOOJ Cards: {effectiveActiveTrade.offer.getOutOfJailCards}
              </Text>
              <Text style={styles.propHeader}>Properties:</Text>
              {effectiveActiveTrade.offer.properties.map((id) => (
                <TradePropertyLine key={id} tileId={id} />
              ))}
            </View>

            <View style={styles.column}>
              <View style={styles.columnHeadingRow}>
                <View
                  style={[
                    styles.playerColor,
                    styles.columnHeadingDot,
                    { backgroundColor: tradeTarget?.color },
                  ]}
                />
                <Text
                  style={[styles.subtitle, styles.columnHeadingText]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {tradeTarget?.name} Gives:
                </Text>
              </View>
              <Text style={styles.text}>Money: ${effectiveActiveTrade.request.money}</Text>
              <Text style={styles.text}>
                GOOJ Cards: {effectiveActiveTrade.request.getOutOfJailCards}
              </Text>
              <Text style={styles.propHeader}>Properties:</Text>
              {effectiveActiveTrade.request.properties.map((id) => (
                <TradePropertyLine key={id} tileId={id} />
              ))}
            </View>
          </View>
          {canAcceptTrade(currentPlayerId, effectiveActiveTrade, isMultiplayer) && (
            <View style={styles.buttonRow}>
              <IconButton
                title="Accept"
                icon="check"
                onPress={() => onAccept(effectiveActiveTrade.id)}
                color={theme.successFill}
              />
              <IconButton
                title="Reject"
                icon="close"
                onPress={() => onReject(effectiveActiveTrade.id)}
                color={theme.danger}
              />
            </View>
          )}
          {canCancelTrade(currentPlayerId, effectiveActiveTrade, isMultiplayer) && (
            <View style={{ marginTop: 20, alignItems: 'center' }}>
              <IconButton
                title={`Cancel (by ${tradeInitiator?.name})`}
                icon="close-circle"
                onPress={() => onCancel(effectiveActiveTrade.id)}
                color={theme.neutralButton}
                size="small"
              />
            </View>
          )}
          {/* Non-initiator, non-target observers (only possible in
              multiplayer when somehow both sides involve someone else) get
              an explanatory line so the modal isn't an empty husk. */}
          {isMultiplayer &&
            !canAcceptTrade(currentPlayerId, effectiveActiveTrade, isMultiplayer) &&
            !canCancelTrade(currentPlayerId, effectiveActiveTrade, isMultiplayer) && (
              <View style={{ marginTop: 16, alignItems: 'center' }}>
                <Text style={styles.headerSubtitle}>
                  Waiting for {tradeTarget?.name} to respond…
                </Text>
              </View>
            )}
        </View>
      );
    }

    if (initiator && target) {
      return (
        <View style={isPhone ? styles.phoneContent : styles.modalContent}>
          <View style={styles.headerRow}>
            <View style={styles.nameRow}>
              <Text style={styles.title}>Propose Trade to</Text>
              <View style={[styles.playerColor, { backgroundColor: target.color }]} />
              <Text style={styles.title}>{target.name}</Text>
            </View>
            {!isPhone && (
              <View style={styles.closeButtonContainer}>
                <CloseButton onPress={onClose} />
              </View>
            )}
          </View>
          <ScrollView style={isPhone ? styles.phoneScrollArea : styles.scrollArea}>
            <View style={styles.columns}>
              {/* Left: You Offer */}
              <View style={styles.column}>
                <View style={styles.nameRow}>
                  <View style={[styles.playerColor, { backgroundColor: initiator.color }]} />
                  <Text style={styles.subtitle}>You Offer</Text>
                </View>

                <Text style={styles.text}>Money (Max: {formatMoney(initiator.money)})</Text>
                <View style={styles.sliderRow}>
                  <Text style={styles.moneyText}>${offerMoney}</Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={moneySliderMax(initiator.money)}
                    step={1}
                    value={sliderFromMoney(offerMoney, initiator.money)}
                    onValueChange={(position) => {
                      setOfferMoney(moneyFromSlider(position, initiator.money));
                    }}
                    minimumTrackTintColor={theme.success}
                    maximumTrackTintColor={theme.borderStrong}
                    thumbTintColor={theme.success}
                  />
                </View>

                {initiator.getOutOfJailCards > 0 && (
                  <View style={styles.row}>
                    <Text style={styles.text}>
                      GOOJ Cards ({offerCards}/{initiator.getOutOfJailCards})
                    </Text>
                    <View style={styles.stepper}>
                      <IconButton
                        title=""
                        accessibilityLabel="Offer fewer Get Out of Jail Free cards"
                        icon="minus"
                        onPress={() => setOfferCards(Math.max(0, offerCards - 1))}
                        size="small"
                        style={styles.stepperBtn}
                        color={theme.border}
                        textColor={theme.textPrimary}
                      />
                      <IconButton
                        title=""
                        accessibilityLabel="Offer more Get Out of Jail Free cards"
                        icon="plus"
                        onPress={() =>
                          setOfferCards(Math.min(initiator.getOutOfJailCards, offerCards + 1))
                        }
                        size="small"
                        style={styles.stepperBtn}
                        color={theme.border}
                        textColor={theme.textPrimary}
                      />
                    </View>
                  </View>
                )}

                <Text style={styles.propHeader}>Properties:</Text>
                {initiator.properties.length === 0 && <Text style={styles.emptyText}>None</Text>}
                {initiator.properties.map((id) => {
                  const tile = BOARD.find((t) => t.id === id);
                  const isChecked = offerProps.includes(id);
                  return (
                    <TouchableOpacity
                      key={id}
                      onPress={() => toggleOfferProp(id)}
                      style={styles.checkRow}
                      {...checkRowA11yProps(isChecked, tile?.name ?? id)}
                    >
                      <MaterialCommunityIcons
                        name={isChecked ? 'checkbox-marked' : 'checkbox-blank-outline'}
                        size={24}
                        color={isChecked ? theme.success : theme.textSecondary}
                      />
                      {tile?.group && GROUP_COLORS[tile.group] && (
                        <View
                          style={[
                            styles.propertyColor,
                            { backgroundColor: GROUP_COLORS[tile.group] },
                          ]}
                        />
                      )}
                      <Text style={styles.propText}>{tile?.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Right: You Request */}
              <View style={styles.column}>
                <View style={styles.nameRow}>
                  <View style={[styles.playerColor, { backgroundColor: target.color }]} />
                  <Text style={styles.subtitle}>You Request</Text>
                </View>

                <Text style={styles.text}>Money (Max: {formatMoney(target.money)})</Text>
                <View style={styles.sliderRow}>
                  <Text style={styles.moneyText}>${reqMoney}</Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={moneySliderMax(target.money)}
                    step={1}
                    value={sliderFromMoney(reqMoney, target.money)}
                    onValueChange={(position) => {
                      setReqMoney(moneyFromSlider(position, target.money));
                    }}
                    minimumTrackTintColor={theme.danger}
                    maximumTrackTintColor={theme.borderStrong}
                    thumbTintColor={theme.danger}
                  />
                </View>

                {target.getOutOfJailCards > 0 && (
                  <View style={styles.row}>
                    <Text style={styles.text}>
                      GOOJ Cards ({reqCards}/{target.getOutOfJailCards})
                    </Text>
                    <View style={styles.stepper}>
                      <IconButton
                        title=""
                        accessibilityLabel="Request fewer Get Out of Jail Free cards"
                        icon="minus"
                        onPress={() => setReqCards(Math.max(0, reqCards - 1))}
                        size="small"
                        style={styles.stepperBtn}
                        color={theme.border}
                        textColor={theme.textPrimary}
                      />
                      <IconButton
                        title=""
                        accessibilityLabel="Request more Get Out of Jail Free cards"
                        icon="plus"
                        onPress={() =>
                          setReqCards(Math.min(target.getOutOfJailCards, reqCards + 1))
                        }
                        size="small"
                        style={styles.stepperBtn}
                        color={theme.border}
                        textColor={theme.textPrimary}
                      />
                    </View>
                  </View>
                )}

                <Text style={styles.propHeader}>Properties:</Text>
                {target.properties.length === 0 && <Text style={styles.emptyText}>None</Text>}
                {target.properties.map((id) => {
                  const tile = BOARD.find((t) => t.id === id);
                  const isChecked = reqProps.includes(id);
                  return (
                    <TouchableOpacity
                      key={id}
                      onPress={() => toggleReqProp(id)}
                      style={styles.checkRow}
                      {...checkRowA11yProps(isChecked, tile?.name ?? id)}
                    >
                      <MaterialCommunityIcons
                        name={isChecked ? 'checkbox-marked' : 'checkbox-blank-outline'}
                        size={24}
                        color={isChecked ? theme.success : theme.textSecondary}
                      />
                      {tile?.group && GROUP_COLORS[tile.group] && (
                        <View
                          style={[
                            styles.propertyColor,
                            { backgroundColor: GROUP_COLORS[tile.group] },
                          ]}
                        />
                      )}
                      <Text style={styles.propText}>{tile?.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>
          <View style={styles.footer}>
            <IconButton title="Propose" icon="handshake" onPress={handlePropose} />
            {!isPhone && (
              <>
                <View style={{ width: 10 }} />
                <IconButton
                  title="Cancel"
                  icon="close"
                  onPress={onClose}
                  color={theme.neutralButton}
                />
              </>
            )}
          </View>
        </View>
      );
    }

    return null;
  };

  return (
    <FullScreenModalShell visible={visible} onClose={onClose} title="Trade" overlay={overlay}>
      <View style={isPhone ? styles.phoneOverlay : styles.modalOverlay}>{renderContent()}</View>
    </FullScreenModalShell>
  );
};

const createStyles = (theme: Theme) =>
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
      width: 16,
      height: 16,
      borderRadius: 8,
      marginHorizontal: 8,
      borderWidth: 1,
      borderColor: theme.borderStrong,
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
