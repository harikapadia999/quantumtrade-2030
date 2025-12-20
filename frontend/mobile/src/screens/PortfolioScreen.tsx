import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import Icon from 'react-native-vector-icons/Ionicons';

interface Position {
  symbol: string;
  quantity: number;
  value: number;
  pnl: number;
  pnlPercent: number;
}

interface Portfolio {
  totalEquity: number;
  cashBalance: number;
  totalPnl: number;
  totalPnlPercent: number;
  positions: Position[];
}

export default function PortfolioScreen() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [timeframe, setTimeframe] = useState<'1d' | '7d' | '30d' | 'all'>('7d');

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const fetchPortfolio = async () => {
    try {
      const response = await fetch('/api/portfolio', {
        headers: {
          'Authorization': `Bearer ${await getToken()}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setPortfolio(data.portfolio);
      }
    } catch (error) {
      console.error('Failed to fetch portfolio:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPortfolio();
    setRefreshing(false);
  };

  const getToken = async () => {
    return 'token';
  };

  const getPieChartData = () => {
    if (!portfolio || portfolio.positions.length === 0) {
      return [];
    }

    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'];

    return portfolio.positions.map((pos, index) => ({
      name: pos.symbol,
      value: pos.value,
      color: colors[index % colors.length],
      legendFontColor: '#9CA3AF',
      legendFontSize: 12,
    }));
  };

  if (!portfolio) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading portfolio...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
      }
    >
      {/* Portfolio Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total Value</Text>
        <Text style={styles.summaryValue}>
          ${portfolio.totalEquity.toLocaleString()}
        </Text>
        <View style={styles.pnlRow}>
          <Icon
            name={portfolio.totalPnl >= 0 ? 'trending-up' : 'trending-down'}
            size={20}
            color={portfolio.totalPnl >= 0 ? '#10B981' : '#EF4444'}
          />
          <Text
            style={[
              styles.pnlText,
              { color: portfolio.totalPnl >= 0 ? '#10B981' : '#EF4444' },
            ]}
          >
            {portfolio.totalPnl >= 0 ? '+' : ''}${portfolio.totalPnl.toFixed(2)}
          </Text>
          <Text
            style={[
              styles.pnlPercent,
              { color: portfolio.totalPnl >= 0 ? '#10B981' : '#EF4444' },
            ]}
          >
            ({portfolio.totalPnlPercent >= 0 ? '+' : ''}
            {portfolio.totalPnlPercent.toFixed(2)}%)
          </Text>
        </View>
      </View>

      {/* Timeframe Selector */}
      <View style={styles.timeframeContainer}>
        {(['1d', '7d', '30d', 'all'] as const).map((tf) => (
          <TouchableOpacity
            key={tf}
            style={[
              styles.timeframeButton,
              timeframe === tf && styles.timeframeButtonActive,
            ]}
            onPress={() => setTimeframe(tf)}
          >
            <Text
              style={[
                styles.timeframeText,
                timeframe === tf && styles.timeframeTextActive,
              ]}
            >
              {tf.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Allocation Chart */}
      {portfolio.positions.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Asset Allocation</Text>
          <PieChart
            data={getPieChartData()}
            width={Dimensions.get('window').width - 32}
            height={220}
            chartConfig={{
              color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
            }}
            accessor="value"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        </View>
      )}

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Cash Balance</Text>
          <Text style={styles.statValue}>
            ${portfolio.cashBalance.toLocaleString()}
          </Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Positions</Text>
          <Text style={styles.statValue}>{portfolio.positions.length}</Text>
        </View>
      </View>

      {/* Positions List */}
      <View style={styles.positionsContainer}>
        <Text style={styles.sectionTitle}>Holdings</Text>

        {portfolio.positions.map((position) => (
          <View key={position.symbol} style={styles.positionCard}>
            <View style={styles.positionHeader}>
              <Text style={styles.positionSymbol}>{position.symbol}</Text>
              <Text style={styles.positionValue}>
                ${position.value.toLocaleString()}
              </Text>
            </View>

            <View style={styles.positionDetails}>
              <View style={styles.positionDetail}>
                <Text style={styles.positionDetailLabel}>Quantity</Text>
                <Text style={styles.positionDetailValue}>
                  {position.quantity.toFixed(4)}
                </Text>
              </View>

              <View style={styles.positionDetail}>
                <Text style={styles.positionDetailLabel}>P&L</Text>
                <Text
                  style={[
                    styles.positionDetailValue,
                    { color: position.pnl >= 0 ? '#10B981' : '#EF4444' },
                  ]}
                >
                  {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
                </Text>
              </View>

              <View style={styles.positionDetail}>
                <Text style={styles.positionDetailLabel}>P&L %</Text>
                <Text
                  style={[
                    styles.positionDetailValue,
                    { color: position.pnlPercent >= 0 ? '#10B981' : '#EF4444' },
                  ]}
                >
                  {position.pnlPercent >= 0 ? '+' : ''}
                  {position.pnlPercent.toFixed(2)}%
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  loadingText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  summaryCard: {
    margin: 16,
    padding: 24,
    backgroundColor: '#1F2937',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  pnlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pnlText: {
    fontSize: 18,
    fontWeight: '600',
  },
  pnlPercent: {
    fontSize: 16,
    fontWeight: '600',
  },
  timeframeContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  timeframeButton: {
    flex: 1,
    padding: 10,
    backgroundColor: '#1F2937',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  timeframeButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  timeframeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  timeframeTextActive: {
    color: '#FFFFFF',
  },
  chartCard: {
    margin: 16,
    marginTop: 0,
    padding: 16,
    backgroundColor: '#1F2937',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    marginHorizontal: 16,
    gap: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  positionsContainer: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  positionCard: {
    padding: 16,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 12,
  },
  positionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  positionSymbol: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  positionValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  positionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  positionDetail: {
    flex: 1,
  },
  positionDetailLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  positionDetailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
