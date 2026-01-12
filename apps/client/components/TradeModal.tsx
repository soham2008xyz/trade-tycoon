import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Player, TradeOffer, TradeRequest, BOARD } from '@trade-tycoon/game-logic';
import { IconButton } from './ui/IconButton';
import { CloseButton } from './ui/CloseButton';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { GROUP_COLORS } from '../constants';

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
  boardSize?: number;
}

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
  boardSize,
}) => {
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
        <View style={[styles.modalContent, boardSize ? { width: boardSize - 40 } : undefined]}>
          <Text style={styles.title}>Trade Proposal</Text>
          <View style={[styles.headerSubtitle, styles.nameRow, { flexWrap: 'wrap' }]}>
            <View style={[styles.playerColor, { backgroundColor: tradeInitiator?.color }]} />
            <Text>{tradeInitiator?.name}</Text>
            <Text> offers to </Text>
            <View style={[styles.playerColor, { backgroundColor: tradeTarget?.color }]} />
            <Text>{tradeTarget?.name}:</Text>
          </View>
          <View style={styles.columns}>
            <View style={styles.column}>
              <View style={styles.nameRow}>
                <View style={[styles.playerColor, { backgroundColor: tradeTarget?.color }]} />
                <Text style={styles.subtitle}>{tradeTarget?.name} Receives:</Text>
              </View>
              <Text>Money: ${effectiveActiveTrade.offer.money}</Text>
              <Text>GOOJ Cards: {effectiveActiveTrade.offer.getOutOfJailCards}</Text>
              <Text style={styles.propHeader}>Properties:</Text>
              {effectiveActiveTrade.offer.properties.map((id) => {
                const tile = BOARD.find((t) => t.id === id);
                return (
                  <View
                    key={id}
                    style={[styles.propItem, styles.nameRow, { justifyContent: 'flex-start' }]}
                  >
                    {tile?.group && GROUP_COLORS[tile.group] && (
                      <View
                        style={[
                          styles.propertyColor,
                          { backgroundColor: GROUP_COLORS[tile.group] },
                        ]}
                      />
                    )}
                    <Text>• {tile?.name}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.column}>
              <View style={styles.nameRow}>
                <View style={[styles.playerColor, { backgroundColor: tradeTarget?.color }]} />
                <Text style={styles.subtitle}>{tradeTarget?.name} Gives:</Text>
              </View>
              <Text>Money: ${effectiveActiveTrade.request.money}</Text>
              <Text>GOOJ Cards: {effectiveActiveTrade.request.getOutOfJailCards}</Text>
              <Text style={styles.propHeader}>Properties:</Text>
              {effectiveActiveTrade.request.properties.map((id) => {
                const tile = BOARD.find((t) => t.id === id);
                return (
                  <View
                    key={id}
                    style={[styles.propItem, styles.nameRow, { justifyContent: 'flex-start' }]}
                  >
                    {tile?.group && GROUP_COLORS[tile.group] && (
                      <View
                        style={[
                          styles.propertyColor,
                          { backgroundColor: GROUP_COLORS[tile.group] },
                        ]}
                      />
                    )}
                    <Text>• {tile?.name}</Text>
                  </View>
                );
              })}
            </View>
          </View>
          <View style={styles.buttonRow}>
            <IconButton
              title="Accept"
              icon="check"
              onPress={() => onAccept(effectiveActiveTrade.id)}
              color="green"
            />
            <IconButton
              title="Reject"
              icon="close"
              onPress={() => onReject(effectiveActiveTrade.id)}
              color="red"
            />
          </View>
          <View style={{ marginTop: 20, alignItems: 'center' }}>
            <IconButton
              title={`Cancel (by ${tradeInitiator?.name})`}
              icon="close-circle"
              onPress={() => onCancel(effectiveActiveTrade.id)}
              color="#666"
              size="small"
            />
          </View>
        </View>
      );
    }

    if (initiator && target) {
      return (
        <View style={[styles.modalContent, boardSize ? { width: boardSize - 40 } : undefined]}>
          <View style={styles.headerRow}>
            <View style={styles.nameRow}>
              <Text style={styles.title}>Propose Trade to</Text>
              <View style={[styles.playerColor, { backgroundColor: target.color }]} />
              <Text style={styles.title}>{target.name}</Text>
            </View>
            <View style={styles.closeButtonContainer}>
              <CloseButton onPress={onClose} />
            </View>
          </View>
          <ScrollView style={styles.scrollArea}>
            <View style={styles.columns}>
              {/* Left: You Offer */}
              <View style={styles.column}>
                <View style={styles.nameRow}>
                  <View style={[styles.playerColor, { backgroundColor: initiator.color }]} />
                  <Text style={styles.subtitle}>You Offer</Text>
                </View>

                <Text>Money (Max: ${initiator.money})</Text>
                <View style={styles.sliderRow}>
                  <Text style={styles.moneyText}>${offerMoney}</Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={initiator.money}
                    step={1}
                    value={offerMoney}
                    onValueChange={setOfferMoney}
                    minimumTrackTintColor="#4CAF50"
                    maximumTrackTintColor="#ccc"
                    thumbTintColor="#4CAF50"
                  />
                </View>

                {initiator.getOutOfJailCards > 0 && (
                  <View style={styles.row}>
                    <Text>
                      GOOJ Cards ({offerCards}/{initiator.getOutOfJailCards})
                    </Text>
                    <View style={styles.stepper}>
                      <IconButton
                        title=""
                        icon="minus"
                        onPress={() => setOfferCards(Math.max(0, offerCards - 1))}
                        size="small"
                        style={styles.stepperBtn}
                        color="#eee"
                        textColor="#333"
                      />
                      <IconButton
                        title=""
                        icon="plus"
                        onPress={() =>
                          setOfferCards(Math.min(initiator.getOutOfJailCards, offerCards + 1))
                        }
                        size="small"
                        style={styles.stepperBtn}
                        color="#eee"
                        textColor="#333"
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
                    >
                      <MaterialCommunityIcons
                        name={isChecked ? 'checkbox-marked' : 'checkbox-blank-outline'}
                        size={24}
                        color={isChecked ? '#4CAF50' : '#666'}
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

                <Text>Money (Max: ${target.money})</Text>
                <View style={styles.sliderRow}>
                  <Text style={styles.moneyText}>${reqMoney}</Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={target.money}
                    step={1}
                    value={reqMoney}
                    onValueChange={setReqMoney}
                    minimumTrackTintColor="#F44336"
                    maximumTrackTintColor="#ccc"
                    thumbTintColor="#F44336"
                  />
                </View>

                {target.getOutOfJailCards > 0 && (
                  <View style={styles.row}>
                    <Text>
                      GOOJ Cards ({reqCards}/{target.getOutOfJailCards})
                    </Text>
                    <View style={styles.stepper}>
                      <IconButton
                        title=""
                        icon="minus"
                        onPress={() => setReqCards(Math.max(0, reqCards - 1))}
                        size="small"
                        style={styles.stepperBtn}
                        color="#eee"
                        textColor="#333"
                      />
                      <IconButton
                        title=""
                        icon="plus"
                        onPress={() =>
                          setReqCards(Math.min(target.getOutOfJailCards, reqCards + 1))
                        }
                        size="small"
                        style={styles.stepperBtn}
                        color="#eee"
                        textColor="#333"
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
                    >
                      <MaterialCommunityIcons
                        name={isChecked ? 'checkbox-marked' : 'checkbox-blank-outline'}
                        size={24}
                        color={isChecked ? '#4CAF50' : '#666'}
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
            <View style={{ width: 10 }} />
            <IconButton title="Cancel" icon="close" onPress={onClose} color="#666" />
          </View>
        </View>
      );
    }

    return null;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>{renderContent()}</View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '95%',
    maxHeight: '90%',
    backgroundColor: 'white',
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
    fontStyle: 'italic',
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
    backgroundColor: '#ccc',
    marginHorizontal: 5,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
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
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
  emptyText: {
    fontStyle: 'italic',
    color: '#888',
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
    borderColor: '#ccc',
  },
  propertyColor: {
    width: 16,
    height: 16,
    marginHorizontal: 8,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#999',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
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
    width: 50, // Fixed width to prevent jumping
    textAlign: 'right',
  },
});
