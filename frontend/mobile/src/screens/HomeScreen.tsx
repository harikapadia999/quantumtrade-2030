import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import Icon from 'react-native-vector-icons/Ionicons';

interface Portfolio {
  totalEquity: number;
  totalPnl: number;
  totalPnlPercent: number;
  cashBalance: number;
  positions: number;
}

export default function HomeScreen({ navigation }: any) {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [chartData, setChartData] = useState<number[]>([]);

  useEffect(() => {
    fetchPortfolio();
    fetchChartData();
  }, []);

  const fetchPortfolio = async () => {
    try {
      // Fetch from API
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

  const fetchChartData = async () => {
    try {
      const response = await fetch('/api/portfolio/history?period=7d&interval=1d', {
        headers: {
          'Authorization': `Bearer ${await getToken()}`,
        },
      });

      const data = await response.json();
      
      if (data.success) {
        setChartData(data.history.map((h: any) => h.value));
      }
    } catch (error) {
      console.error('Failed to fetch chart data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchPortfolio(), fetchChartData()]);
    setRefreshing(false);
  };

  const getToken = async () => {
    // Get from secure storage
    return 'token';
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
      }
    >
      {/* Portfolio Value Card */}
      <View style={styles.portfolioCard}>
        <Text style={styles.portfolioLabel}>Total Portfolio Value</Text>
        <Text style={styles.portfolioValue}>
          ${portfolio?.totalEquity.toLocaleString() || '0.00'}
        </Text>
        <View style={styles.pnlContainer}>
          <Text style={[
            styles.pnlText,
            { color: (portfolio?.totalPnl || 0) >= 0 ? '#10B981' : '#EF4444' }
          ]}>
            {(portfolio?.totalPnl || 0) >= 0 ? '+' : ''}
            ${portfolio?.totalPnl.toFixed(2) || '0.00'}
          </Text>
          <Text style={[
            styles.pnlPercent,
            { color: (portfolio?.totalPnlPercent || 0) >= 0 ? '#10B981' : '#EF4444' }
          ]}>
            ({(portfolio?.totalPnlPercent || 0) >= 0 ? '+' : ''}
            {portfolio?.totalPnlPercent.toFixed(2) || '0.00'}%)
          </Text>
        </View>
      </View>

      {/* Portfolio Chart */}
      {chartData.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>7 Day Performance</Text>
          <LineChart
            data={{
              labels: ['', '', '', '', '', '', ''],
              datasets: [{ data: chartData }],
            }}
            width={Dimensions.get('window').width - 32}
            height={200}
            chartConfig={{
              backgroundColor: '#1F2937',
              backgroundGradientFrom: '#1F2937',
              backgroundGradientTo: '#1F2937',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(156, 163, 175, ${opacity})`,
              style: { borderRadius: 16 },
              propsForDots: {
                r: '4',
                strokeWidth: '2',
                stroke: '#3B82F6',
              },
            }}
            bezier
            style={styles.chart}
          />
        </View>
      )}

      {/* Quick Stats */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Icon name="wallet-outline" size={24} color="#3B82F6" />
          <Text style={styles.statValue}>${portfolio?.cashBalance.toLocaleString() || '0'}</Text>
          <Text style={styles.statLabel}>Cash Balance</Text>
        </View>

        <View style={styles.statCard}>
          <Icon name="trending-up-outline" size={24} color="#10B981" />
          <Text style={styles.statValue}>{portfolio?.positions || 0}</Text>
          <Text style={styles.statLabel}>Open Positions</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsContainer}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Trade')}
          >
            <Icon name="swap-horizontal" size={28} color="#3B82F6" />
            <Text style={styles.actionText}>Trade</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Markets')}
          >
            <Icon name="trending-up" size={28} color="#10B981" />
            <Text style={styles.actionText}>Markets</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {}}
          >
            <Icon name="add-circle" size={28} color="#8B5CF6" />
            <Text style={styles.actionText}>Deposit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {}}
          >
            <Icon name="remove-circle" size={28} color="#F59E0B" />
            <Text style={styles.actionText}>Withdraw</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.activityContainer}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        
        <View style={styles.activityList}>
          <View style={styles.activityItem}>
            <View style={styles.activityIcon}>
              <Icon name="arrow-up" size={16} color="#10B981" />
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>Bought BTC</Text>
              <Text style={styles.activityTime}>2 hours ago</Text>
            </View>
            <Text style={styles.activityAmount}>+0.05 BTC</Text>
          </View>

          <View style={styles.activityItem}>
            <View style={styles.activityIcon}>
              <Icon name="arrow-down" size={16} color="#EF4444" />
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>Sold ETH</Text>
              <Text style={styles.activityTime}>5 hours ago</Text>
            </View>
            <Text style={styles.activityAmount}>-2.5 ETH</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  portfolioCard: {
    margin: 16,
    padding: 24,
    backgroundColor: '#1F2937',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  portfolioLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  portfolioValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  pnlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pnlText: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  pnlPercent: {
    fontSize: 16,
    fontWeight: '600',
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
  chart: {
    borderRadius: 16,
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
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  actionsContainer: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    width: (Dimensions.get('window').width - 56) / 2,
    padding: 20,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginTop: 8,
    fontWeight: '600',
  },
  activityContainer: {
    margin: 16,
    marginBottom: 32,
  },
  activityList: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    overflow: 'hidden',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
