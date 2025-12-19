"""
Autonomous Trading Agent using Reinforcement Learning
Learns optimal trading strategies through interaction with market
"""

import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from collections import deque
import random


@dataclass
class AgentConfig:
    """Configuration for trading agent"""
    state_dim: int = 128
    action_dim: int = 3  # Buy, Hold, Sell
    hidden_dim: int = 256
    learning_rate: float = 0.001
    gamma: float = 0.99  # Discount factor
    epsilon_start: float = 1.0
    epsilon_end: float = 0.01
    epsilon_decay: float = 0.995
    memory_size: int = 10000
    batch_size: int = 64
    target_update_freq: int = 100


class DQNNetwork(nn.Module):
    """Deep Q-Network for trading decisions"""
    
    def __init__(self, state_dim: int, action_dim: int, hidden_dim: int):
        super().__init__()
        
        self.network = nn.Sequential(
            nn.Linear(state_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, action_dim)
        )
    
    def forward(self, state: torch.Tensor) -> torch.Tensor:
        return self.network(state)


class ReplayMemory:
    """Experience replay buffer"""
    
    def __init__(self, capacity: int):
        self.memory = deque(maxlen=capacity)
    
    def push(self, state, action, reward, next_state, done):
        self.memory.append((state, action, reward, next_state, done))
    
    def sample(self, batch_size: int):
        return random.sample(self.memory, batch_size)
    
    def __len__(self):
        return len(self.memory)


class AutonomousTradingAgent:
    """
    Reinforcement Learning agent for autonomous trading
    Uses Deep Q-Learning (DQN) to learn optimal trading strategies
    """
    
    def __init__(self, config: AgentConfig, risk_tolerance: float = 0.5):
        """
        Initialize trading agent
        
        Args:
            config: Agent configuration
            risk_tolerance: Risk tolerance (0=conservative, 1=aggressive)
        """
        self.config = config
        self.risk_tolerance = risk_tolerance
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Q-Networks
        self.policy_net = DQNNetwork(
            config.state_dim,
            config.action_dim,
            config.hidden_dim
        ).to(self.device)
        
        self.target_net = DQNNetwork(
            config.state_dim,
            config.action_dim,
            config.hidden_dim
        ).to(self.device)
        
        self.target_net.load_state_dict(self.policy_net.state_dict())
        self.target_net.eval()
        
        # Optimizer
        self.optimizer = optim.Adam(
            self.policy_net.parameters(),
            lr=config.learning_rate
        )
        
        # Replay memory
        self.memory = ReplayMemory(config.memory_size)
        
        # Exploration
        self.epsilon = config.epsilon_start
        
        # Training stats
        self.steps = 0
        self.episodes = 0
        self.total_reward = 0.0
    
    def get_state_features(self, market_data: Dict) -> np.ndarray:
        """
        Extract state features from market data
        
        Args:
            market_data: Dictionary with market information
        
        Returns:
            State feature vector
        """
        features = []
        
        # Price features
        features.extend([
            market_data.get('current_price', 0),
            market_data.get('price_change_1h', 0),
            market_data.get('price_change_24h', 0),
            market_data.get('price_change_7d', 0),
        ])
        
        # Technical indicators
        features.extend([
            market_data.get('rsi_14', 50),
            market_data.get('macd', 0),
            market_data.get('macd_signal', 0),
            market_data.get('bb_position', 0.5),  # Position in Bollinger Bands
        ])
        
        # Volume features
        features.extend([
            market_data.get('volume_24h', 0),
            market_data.get('volume_ratio', 1.0),
        ])
        
        # Sentiment
        features.extend([
            market_data.get('sentiment_score', 0),
            market_data.get('sentiment_confidence', 0),
        ])
        
        # Portfolio state
        features.extend([
            market_data.get('position_size', 0),
            market_data.get('unrealized_pnl', 0),
            market_data.get('available_capital', 0),
        ])
        
        # Pad to state_dim
        while len(features) < self.config.state_dim:
            features.append(0.0)
        
        return np.array(features[:self.config.state_dim], dtype=np.float32)
    
    def select_action(self, state: np.ndarray, training: bool = True) -> int:
        """
        Select action using epsilon-greedy policy
        
        Args:
            state: Current state
            training: Whether in training mode
        
        Returns:
            Action index (0=Buy, 1=Hold, 2=Sell)
        """
        # Exploration vs exploitation
        if training and random.random() < self.epsilon:
            return random.randrange(self.config.action_dim)
        
        # Exploitation: choose best action
        with torch.no_grad():
            state_tensor = torch.FloatTensor(state).unsqueeze(0).to(self.device)
            q_values = self.policy_net(state_tensor)
            return q_values.argmax().item()
    
    def calculate_reward(
        self,
        action: int,
        prev_portfolio_value: float,
        curr_portfolio_value: float,
        transaction_cost: float = 0.001
    ) -> float:
        """
        Calculate reward for the action taken
        
        Args:
            action: Action taken (0=Buy, 1=Hold, 2=Sell)
            prev_portfolio_value: Portfolio value before action
            curr_portfolio_value: Portfolio value after action
            transaction_cost: Transaction cost as percentage
        
        Returns:
            Reward value
        """
        # Portfolio value change
        pnl = curr_portfolio_value - prev_portfolio_value
        pnl_pct = pnl / prev_portfolio_value if prev_portfolio_value > 0 else 0
        
        # Base reward from P&L
        reward = pnl_pct * 100  # Scale to reasonable range
        
        # Penalize transactions (except hold)
        if action != 1:  # Not hold
            reward -= transaction_cost * 100
        
        # Risk-adjusted reward
        # Penalize high volatility if risk-averse
        if self.risk_tolerance < 0.5:
            volatility_penalty = abs(pnl_pct) * (1 - self.risk_tolerance)
            reward -= volatility_penalty * 10
        
        return reward
    
    def train_step(self):
        """Perform one training step"""
        if len(self.memory) < self.config.batch_size:
            return
        
        # Sample batch
        batch = self.memory.sample(self.config.batch_size)
        states, actions, rewards, next_states, dones = zip(*batch)
        
        # Convert to tensors
        states = torch.FloatTensor(np.array(states)).to(self.device)
        actions = torch.LongTensor(actions).to(self.device)
        rewards = torch.FloatTensor(rewards).to(self.device)
        next_states = torch.FloatTensor(np.array(next_states)).to(self.device)
        dones = torch.FloatTensor(dones).to(self.device)
        
        # Current Q values
        current_q_values = self.policy_net(states).gather(1, actions.unsqueeze(1))
        
        # Next Q values from target network
        with torch.no_grad():
            next_q_values = self.target_net(next_states).max(1)[0]
            target_q_values = rewards + (1 - dones) * self.config.gamma * next_q_values
        
        # Compute loss
        loss = nn.MSELoss()(current_q_values.squeeze(), target_q_values)
        
        # Optimize
        self.optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.policy_net.parameters(), 1.0)
        self.optimizer.step()
        
        # Update target network
        self.steps += 1
        if self.steps % self.config.target_update_freq == 0:
            self.target_net.load_state_dict(self.policy_net.state_dict())
        
        # Decay epsilon
        self.epsilon = max(
            self.config.epsilon_end,
            self.epsilon * self.config.epsilon_decay
        )
        
        return loss.item()
    
    def save(self, path: str):
        """Save agent state"""
        torch.save({
            'policy_net': self.policy_net.state_dict(),
            'target_net': self.target_net.state_dict(),
            'optimizer': self.optimizer.state_dict(),
            'epsilon': self.epsilon,
            'steps': self.steps,
            'episodes': self.episodes,
        }, path)
    
    def load(self, path: str):
        """Load agent state"""
        checkpoint = torch.load(path)
        self.policy_net.load_state_dict(checkpoint['policy_net'])
        self.target_net.load_state_dict(checkpoint['target_net'])
        self.optimizer.load_state_dict(checkpoint['optimizer'])
        self.epsilon = checkpoint['epsilon']
        self.steps = checkpoint['steps']
        self.episodes = checkpoint['episodes']


class TradingEnvironment:
    """
    Simulated trading environment for agent training
    """
    
    def __init__(self, historical_data: List[Dict], initial_capital: float = 100000):
        self.data = historical_data
        self.initial_capital = initial_capital
        self.reset()
    
    def reset(self) -> np.ndarray:
        """Reset environment to initial state"""
        self.current_step = 0
        self.cash = self.initial_capital
        self.position = 0.0
        self.portfolio_value = self.initial_capital
        return self._get_state()
    
    def _get_state(self) -> np.ndarray:
        """Get current state"""
        if self.current_step >= len(self.data):
            return np.zeros(128)
        
        market_data = self.data[self.current_step].copy()
        market_data['position_size'] = self.position
        market_data['available_capital'] = self.cash
        market_data['unrealized_pnl'] = self._calculate_pnl()
        
        # This would use the agent's get_state_features method
        return np.random.randn(128)  # Placeholder
    
    def step(self, action: int) -> Tuple[np.ndarray, float, bool, Dict]:
        """
        Execute action and return next state
        
        Args:
            action: 0=Buy, 1=Hold, 2=Sell
        
        Returns:
            (next_state, reward, done, info)
        """
        if self.current_step >= len(self.data) - 1:
            return self._get_state(), 0, True, {}
        
        current_price = self.data[self.current_step]['current_price']
        prev_value = self.portfolio_value
        
        # Execute action
        if action == 0:  # Buy
            buy_amount = self.cash * 0.95  # Use 95% of cash
            shares = buy_amount / current_price
            self.position += shares
            self.cash -= buy_amount
        
        elif action == 2:  # Sell
            if self.position > 0:
                sell_value = self.position * current_price * 0.95
                self.cash += sell_value
                self.position = 0
        
        # Move to next step
        self.current_step += 1
        next_price = self.data[self.current_step]['current_price']
        
        # Calculate new portfolio value
        self.portfolio_value = self.cash + (self.position * next_price)
        
        # Calculate reward
        reward = (self.portfolio_value - prev_value) / prev_value * 100
        
        # Check if done
        done = self.current_step >= len(self.data) - 1
        
        info = {
            'portfolio_value': self.portfolio_value,
            'cash': self.cash,
            'position': self.position,
        }
        
        return self._get_state(), reward, done, info
    
    def _calculate_pnl(self) -> float:
        """Calculate unrealized P&L"""
        if self.position == 0:
            return 0.0
        current_price = self.data[self.current_step]['current_price']
        return self.position * current_price - (self.initial_capital - self.cash)


if __name__ == '__main__':
    # Example usage
    config = AgentConfig()
    agent = AutonomousTradingAgent(config, risk_tolerance=0.6)
    
    print("Autonomous Trading Agent initialized")
    print(f"State dimension: {config.state_dim}")
    print(f"Action dimension: {config.action_dim}")
    print(f"Risk tolerance: 0.6 (moderate)")
    print(f"Device: {agent.device}")
