import React, { useState, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { Player, TradeOffer, TradeRequest, BOARD } from '@trade-tycoon/game-logic';
import { IconButton } from './ui/IconButton';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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
}) => {
  const [offerMoney, setOfferMoney] = useState('0');
  const [offerProps, setOfferProps] = useState<string[]>([]);
  const [offerCards, setOfferCards] = useState(0);

  const [reqMoney, setReqMoney] = useState('0');
  const [reqProps, setReqProps] = useState<string[]>([]);
  const [reqCards, setReqCards] = useState(0);

  const initiator = players.find(p => p.id === currentPlayerId);
  const target = players.find(p => p.id === targetPlayerId);

  // Reset state when opening fresh
  useEffect(() => {
    if (visible && !activeTrade) {
      setOfferMoney('0');
      setOfferProps([]);
      setOfferCards(0);
      setReqMoney('0');
      setReqProps([]);
      setReqCards(0);
    }
  }, [visible, activeTrade]);

  // View: Show Offer (Accept/Reject)
  if (activeTrade) {
    const tradeInitiator = players.find(p => p.id === activeTrade.initiatorId);
    const tradeTarget = players.find(p => p.id === activeTrade.targetPlayerId);

    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.title}>Trade Proposal</Text>
            <Text style={styles.headerSubtitle}>{tradeInitiator?.name} offers to {tradeTarget?.name}:</Text>

            <View style={styles.columns}>
              <View style={styles.column}>
                <Text style={styles.subtitle}>{tradeTarget?.name} Receives:</Text>
                <Text>Money: ${activeTrade.offer.money}</Text>
                <Text>GOOJ Cards: {activeTrade.offer.getOutOfJailCards}</Text>
                <Text style={styles.propHeader}>Properties:</Text>
                {activeTrade.offer.properties.map(id => {
                  const tile = BOARD.find(t => t.id === id);
                  return <Text key={id} style={styles.propItem}>• {tile?.name}</Text>;
                })}
              </View>

              <View style={styles.column}>
                <Text style={styles.subtitle}>{tradeTarget?.name} Gives:</Text>
                <Text>Money: ${activeTrade.request.money}</Text>
                <Text>GOOJ Cards: {activeTrade.request.getOutOfJailCards}</Text>
                <Text style={styles.propHeader}>Properties:</Text>
                {activeTrade.request.properties.map(id => {
                   const tile = BOARD.find(t => t.id === id);
                   return <Text key={id} style={styles.propItem}>• {tile?.name}</Text>;
                })}
              </View>
            </View>

            <View style={styles.buttonRow}>
              <IconButton
                title="Accept"
                icon="check"
                onPress={() => onAccept(activeTrade.id)}
                color="green"
              />
              <IconButton
                title="Reject"
                icon="close"
                onPress={() => onReject(activeTrade.id)}
                color="red"
              />
            </View>
             <View style={{ marginTop: 20, alignItems: 'center' }}>
                <IconButton
                  title={`Cancel (by ${tradeInitiator?.name})`}
                  icon="close-circle"
                  onPress={() => onCancel(activeTrade.id)}
                  color="#666"
                  size="small"
                />
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // View: Propose New Trade
  if (!initiator || !target) return null;

  const toggleOfferProp = (id: string) => {
    if (offerProps.includes(id)) {
      setOfferProps(offerProps.filter(p => p !== id));
    } else {
      setOfferProps([...offerProps, id]);
    }
  };

  const toggleReqProp = (id: string) => {
    if (reqProps.includes(id)) {
      setReqProps(reqProps.filter(p => p !== id));
    } else {
      setReqProps([...reqProps, id]);
    }
  };

  const handlePropose = () => {
    const moneyOffer = parseInt(offerMoney) || 0;
    const moneyReq = parseInt(reqMoney) || 0;

    const offer: TradeOffer = {
        money: moneyOffer,
        properties: offerProps,
        getOutOfJailCards: offerCards
    };
    onPropose(target.id, offer, {
        money: moneyReq,
        properties: reqProps,
        getOutOfJailCards: reqCards
    });
  };

  const setSafeOfferMoney = (text: string) => {
      const val = parseInt(text) || 0;
      if (val > initiator.money) {
          setOfferMoney(initiator.money.toString());
      } else {
          setOfferMoney(text);
      }
  };

  const setSafeReqMoney = (text: string) => {
    const val = parseInt(text) || 0;
    if (val > target.money) {
        setReqMoney(target.money.toString());
    } else {
        setReqMoney(text);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
            <View style={styles.headerRow}>
                <Text style={styles.title}>Propose Trade to {target.name}</Text>
                <IconButton
                  title=""
                  icon="close"
                  onPress={onClose}
                  color="transparent"
                  textColor="#333"
                  size="small"
                  style={{ elevation: 0, paddingHorizontal: 0, paddingVertical: 0 }}
                />
            </View>

            <ScrollView style={styles.scrollArea}>
                <View style={styles.columns}>
                    {/* Left: You Offer */}
                    <View style={styles.column}>
                        <Text style={styles.subtitle}>You Offer</Text>

                        <Text>Money (Max: ${initiator.money})</Text>
                        <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            value={offerMoney}
                            onChangeText={setSafeOfferMoney}
                            placeholder="0"
                        />

                        {initiator.getOutOfJailCards > 0 && (
                             <View style={styles.row}>
                                <Text>GOOJ Cards ({offerCards}/{initiator.getOutOfJailCards})</Text>
                                <View style={styles.stepper}>
                                    <IconButton title="" icon="minus" onPress={() => setOfferCards(Math.max(0, offerCards - 1))} size="small" style={styles.stepperBtn} color="#eee" textColor="#333" />
                                    <IconButton title="" icon="plus" onPress={() => setOfferCards(Math.min(initiator.getOutOfJailCards, offerCards + 1))} size="small" style={styles.stepperBtn} color="#eee" textColor="#333" />
                                </View>
                             </View>
                        )}

                        <Text style={styles.propHeader}>Properties:</Text>
                        {initiator.properties.length === 0 && <Text style={styles.emptyText}>None</Text>}
                        {initiator.properties.map(id => {
                            const tile = BOARD.find(t => t.id === id);
                            const isChecked = offerProps.includes(id);
                            return (
                                <TouchableOpacity key={id} onPress={() => toggleOfferProp(id)} style={styles.checkRow}>
                                    <MaterialCommunityIcons
                                        name={isChecked ? "checkbox-marked" : "checkbox-blank-outline"}
                                        size={24}
                                        color={isChecked ? "#4CAF50" : "#666"}
                                    />
                                    <Text style={styles.propText}>{tile?.name}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Right: You Request */}
                    <View style={styles.column}>
                        <Text style={styles.subtitle}>You Request</Text>

                        <Text>Money (Max: ${target.money})</Text>
                        <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            value={reqMoney}
                            onChangeText={setSafeReqMoney}
                            placeholder="0"
                        />

                         {target.getOutOfJailCards > 0 && (
                             <View style={styles.row}>
                                <Text>GOOJ Cards ({reqCards}/{target.getOutOfJailCards})</Text>
                                <View style={styles.stepper}>
                                    <IconButton title="" icon="minus" onPress={() => setReqCards(Math.max(0, reqCards - 1))} size="small" style={styles.stepperBtn} color="#eee" textColor="#333" />
                                    <IconButton title="" icon="plus" onPress={() => setReqCards(Math.min(target.getOutOfJailCards, reqCards + 1))} size="small" style={styles.stepperBtn} color="#eee" textColor="#333" />
                                </View>
                             </View>
                        )}

                        <Text style={styles.propHeader}>Properties:</Text>
                        {target.properties.length === 0 && <Text style={styles.emptyText}>None</Text>}
                        {target.properties.map(id => {
                            const tile = BOARD.find(t => t.id === id);
                            const isChecked = reqProps.includes(id);
                            return (
                                <TouchableOpacity key={id} onPress={() => toggleReqProp(id)} style={styles.checkRow}>
                                    <MaterialCommunityIcons
                                        name={isChecked ? "checkbox-marked" : "checkbox-blank-outline"}
                                        size={24}
                                        color={isChecked ? "#4CAF50" : "#666"}
                                    />
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
      </View>
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
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
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
});
