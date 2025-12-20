import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Slider from '@react-native-community/slider';

export default function TradingScreen() {
  const [symbol, setSymbol] = useState('BTC-USD');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('limit');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [leverage, setLeverage] = useState(1);

  const handleSubmitOrder = async () => {
    try {
      const orderData = {
        symbol,
        side,
        type: orderType,
        quantity: parseFloat(quantity),
        price: orderType === 'limit' ? parseFloat(price) : undefined,
        leverage,
      };

      // Submit order
      const response = await fetch('/api/trading/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getToken()}`,
        },
        body: JSON.stringify(orderData),
      });

      const result = await response.json();

      if (result.success) {
        Alert.alert('Success', 'Order submitted successfully');
        
        // Reset form
        setQuantity('');
        setPrice('');
      } else {
        Alert.alert('Error', result.error || 'Failed to submit order');
      }
    } catch (error) {
      console.error('Order submission error:', error);
      Alert.alert('Error', 'Failed to submit order');
    }
  };

  const getToken = async () => {
    // Get from secure storage
    return 'token';
  };

  const calculateTotal = () => {
    const qty = parseFloat(quantity) || 0;
    const prc = parseFloat(price) || 0;
    return (qty * prc).toFixed(2);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Symbol Selector */}
      <View style={styles.card}>
        <Text style={styles.label}>Trading Pair</Text>
        <View style={styles.symbolSelector}>
          <TextInput
            style={styles.symbolInput}
            value={symbol}
            onChangeText={setSymbol}
            placeholder="BTC-USD"
            placeholderTextColor="#6B7280"
          />
          <TouchableOpacity style={styles.symbolButton}>
            <Icon name="chevron-down" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Side Selector */}
      <View style={styles.card}>
        <View style={styles.sideSelector}>
          <TouchableOpacity
            style={[
              styles.sideButton,
              side === 'buy' && styles.buyButtonActive,
            ]}
            onPress={() => setSide('buy')}
          >
            <Text style={[
              styles.sideButtonText,
              side === 'buy' && styles.sideButtonTextActive,
            ]}>
              Buy
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sideButton,
              side === 'sell' && styles.sellButtonActive,
            ]}
            onPress={() => setSide('sell')}
          >
            <Text style={[
              styles.sideButtonText,
              side === 'sell' && styles.sideButtonTextActive,
            ]}>
              Sell
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Order Type */}
      <View style={styles.card}>
        <Text style={styles.label}>Order Type</Text>
        <View style={styles.orderTypeSelector}>
          <TouchableOpacity
            style={[
              styles.orderTypeButton,
              orderType === 'market' && styles.orderTypeButtonActive,
            ]}
            onPress={() => setOrderType('market')}
          >
            <Text style={[
              styles.orderTypeText,
              orderType === 'market' && styles.orderTypeTextActive,
            ]}>
              Market
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.orderTypeButton,
              orderType === 'limit' && styles.orderTypeButtonActive,
            ]}
            onPress={() => setOrderType('limit')}
          >
            <Text style={[
              styles.orderTypeText,
              orderType === 'limit' && styles.orderTypeTextActive,
            ]}>
              Limit
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quantity */}
      <View style={styles.card}>
        <Text style={styles.label}>Quantity</Text>
        <TextInput
          style={styles.input}
          value={quantity}
          onChangeText={setQuantity}
          placeholder="0.00"
          placeholderTextColor="#6B7280"
          keyboardType="decimal-pad"
        />
      </View>

      {/* Price (for limit orders) */}
      {orderType === 'limit' && (
        <View style={styles.card}>
          <Text style={styles.label}>Price</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            placeholder="0.00"
            placeholderTextColor="#6B7280"
            keyboardType="decimal-pad"
          />
        </View>
      )}

      {/* Leverage */}
      <View style={styles.card}>
        <View style={styles.leverageHeader}>
          <Text style={styles.label}>Leverage</Text>
          <Text style={styles.leverageValue}>{leverage}x</Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={1}
          maximumValue={10}
          step={1}
          value={leverage}
          onValueChange={setLeverage}
          minimumTrackTintColor="#3B82F6"
          maximumTrackTintColor="#374151"
          thumbTintColor="#3B82F6"
        />
        <View style={styles.leverageLabels}>
          <Text style={styles.leverageLabel}>1x</Text>
          <Text style={styles.leverageLabel}>5x</Text>
          <Text style={styles.leverageLabel}>10x</Text>
        </View>
      </View>

      {/* Order Summary */}
      <View style={styles.card}>
        <Text style={styles.label}>Order Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total</Text>
          <Text style={styles.summaryValue}>${calculateTotal()}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Margin Required</Text>
          <Text style={styles.summaryValue}>
            ${(parseFloat(calculateTotal()) / leverage).toFixed(2)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Fee (0.1%)</Text>
          <Text style={styles.summaryValue}>
            ${(parseFloat(calculateTotal()) * 0.001).toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          side === 'buy' ? styles.buyButton : styles.sellButton,
        ]}
        onPress={handleSubmitOrder}
        disabled={!quantity || (orderType === 'limit' && !price)}
      >
        <Text style={styles.submitButtonText}>
          {side.toUpperCase()} {symbol}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  card: {
    margin: 16,
    marginBottom: 0,
    padding: 16,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  label: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 8,
    fontWeight: '600',
  },
  symbolSelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  symbolInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    padding: 12,
    backgroundColor: '#374151',
    borderRadius: 8,
  },
  symbolButton: {
    marginLeft: 8,
    padding: 12,
    backgroundColor: '#374151',
    borderRadius: 8,
  },
  sideSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  sideButton: {
    flex: 1,
    padding: 16,
    backgroundColor: '#374151',
    borderRadius: 8,
    alignItems: 'center',
  },
  buyButtonActive: {
    backgroundColor: '#10B981',
  },
  sellButtonActive: {
    backgroundColor: '#EF4444',
  },
  sideButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  sideButtonTextActive: {
    color: '#FFFFFF',
  },
  orderTypeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  orderTypeButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#374151',
    borderRadius: 8,
    alignItems: 'center',
  },
  orderTypeButtonActive: {
    backgroundColor: '#3B82F6',
  },
  orderTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  orderTypeTextActive: {
    color: '#FFFFFF',
  },
  input: {
    fontSize: 16,
    color: '#FFFFFF',
    padding: 12,
    backgroundColor: '#374151',
    borderRadius: 8,
  },
  leverageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leverageValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  leverageLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  leverageLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  submitButton: {
    margin: 16,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  buyButton: {
    backgroundColor: '#10B981',
  },
  sellButton: {
    backgroundColor: '#EF4444',
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
