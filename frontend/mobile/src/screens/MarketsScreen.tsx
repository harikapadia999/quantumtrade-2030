import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

interface Market {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap?: number;
}

export default function MarketsScreen({ navigation }: any) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [filteredMarkets, setFilteredMarkets] = useState<Market[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'crypto' | 'stocks'>('all');

  useEffect(() => {
    fetchMarkets();
  }, [filter]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = markets.filter(
        (m) =>
          m.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredMarkets(filtered);
    } else {
      setFilteredMarkets(markets);
    }
  }, [searchQuery, markets]);

  const fetchMarkets = async () => {
    try {
      const response = await fetch(`/api/market-data/markets?filter=${filter}`);
      const data = await response.json();

      if (data.success) {
        setMarkets(data.markets);
        setFilteredMarkets(data.markets);
      }
    } catch (error) {
      console.error('Failed to fetch markets:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMarkets();
    setRefreshing(false);
  };

  const renderMarketItem = ({ item }: { item: Market }) => (
    <TouchableOpacity
      style={styles.marketItem}
      onPress={() => navigation.navigate('Trade', { symbol: item.symbol })}
    >
      <View style={styles.marketInfo}>
        <Text style={styles.marketSymbol}>{item.symbol}</Text>
        <Text style={styles.marketName}>{item.name}</Text>
      </View>

      <View style={styles.marketStats}>
        <Text style={styles.marketPrice}>${item.price.toLocaleString()}</Text>
        <View style={styles.changeContainer}>
          <Icon
            name={item.change24h >= 0 ? 'trending-up' : 'trending-down'}
            size={14}
            color={item.change24h >= 0 ? '#10B981' : '#EF4444'}
          />
          <Text
            style={[
              styles.marketChange,
              { color: item.change24h >= 0 ? '#10B981' : '#EF4444' },
            ]}
          >
            {item.change24h >= 0 ? '+' : ''}
            {item.change24h.toFixed(2)}%
          </Text>
        </View>
      </View>

      <Icon name="chevron-forward" size={20} color="#6B7280" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#6B7280" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search markets..."
          placeholderTextColor="#6B7280"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="close-circle" size={20} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text
            style={[
              styles.filterText,
              filter === 'all' && styles.filterTextActive,
            ]}
          >
            All Markets
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filter === 'crypto' && styles.filterTabActive]}
          onPress={() => setFilter('crypto')}
        >
          <Text
            style={[
              styles.filterText,
              filter === 'crypto' && styles.filterTextActive,
            ]}
          >
            Crypto
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filter === 'stocks' && styles.filterTabActive]}
          onPress={() => setFilter('stocks')}
        >
          <Text
            style={[
              styles.filterText,
              filter === 'stocks' && styles.filterTextActive,
            ]}
          >
            Stocks
          </Text>
        </TouchableOpacity>
      </View>

      {/* Markets List */}
      <FlatList
        data={filteredMarkets}
        renderItem={renderMarketItem}
        keyExtractor={(item) => item.symbol}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3B82F6"
          />
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 12,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
  },
  filterContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    padding: 12,
    backgroundColor: '#1F2937',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
  },
  marketItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 12,
  },
  marketInfo: {
    flex: 1,
  },
  marketSymbol: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  marketName: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  marketStats: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  marketPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  marketChange: {
    fontSize: 14,
    fontWeight: '600',
  },
});
