"""
Quantum Portfolio Optimization using QAOA
Optimizes portfolio allocation using quantum annealing
"""

from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister
from qiskit.algorithms import QAOA
from qiskit.algorithms.optimizers import COBYLA
from qiskit.primitives import Sampler
from qiskit_optimization import QuadraticProgram
from qiskit_optimization.algorithms import MinimumEigenOptimizer
from qiskit_optimization.converters import QuadraticProgramToQubo
import numpy as np
from typing import List, Dict, Tuple
from dataclasses import dataclass


@dataclass
class Asset:
    """Asset information"""
    symbol: str
    expected_return: float
    risk: float
    current_price: float


@dataclass
class PortfolioConstraints:
    """Portfolio optimization constraints"""
    min_allocation: float = 0.0  # Minimum allocation per asset
    max_allocation: float = 1.0  # Maximum allocation per asset
    target_return: float = 0.10  # Target annual return (10%)
    max_risk: float = 0.20  # Maximum portfolio risk (20%)
    num_assets_min: int = 3  # Minimum number of assets
    num_assets_max: int = 10  # Maximum number of assets


class QuantumPortfolioOptimizer:
    """
    Quantum-enhanced portfolio optimization using QAOA
    Finds optimal asset allocation to maximize returns while minimizing risk
    """
    
    def __init__(self, assets: List[Asset], constraints: PortfolioConstraints):
        """
        Initialize quantum portfolio optimizer
        
        Args:
            assets: List of available assets
            constraints: Portfolio constraints
        """
        self.assets = assets
        self.constraints = constraints
        self.num_assets = len(assets)
        
        # Calculate covariance matrix (simplified)
        self.covariance_matrix = self._calculate_covariance_matrix()
    
    def optimize(self, budget: float = 1000000.0) -> Dict[str, float]:
        """
        Optimize portfolio allocation using quantum algorithm
        
        Args:
            budget: Total investment budget
        
        Returns:
            Dictionary mapping asset symbols to allocation amounts
        """
        # Build quadratic program
        qp = self._build_quadratic_program(budget)
        
        # Convert to QUBO
        converter = QuadraticProgramToQubo()
        qubo = converter.convert(qp)
        
        # Set up QAOA
        qaoa = QAOA(sampler=Sampler(), optimizer=COBYLA(), reps=3)
        optimizer = MinimumEigenOptimizer(qaoa)
        
        # Solve
        result = optimizer.solve(qubo)
        
        # Extract allocations
        allocations = self._extract_allocations(result, budget)
        
        return allocations
    
    def _build_quadratic_program(self, budget: float) -> QuadraticProgram:
        """
        Build quadratic program for portfolio optimization
        
        Objective: Maximize return - risk_aversion * risk
        Constraints: Budget, allocation limits, diversification
        """
        qp = QuadraticProgram('portfolio_optimization')
        
        # Decision variables: allocation percentage for each asset
        for i, asset in enumerate(self.assets):
            qp.continuous_var(
                name=f'x_{i}',
                lowerbound=self.constraints.min_allocation,
                upperbound=self.constraints.max_allocation
            )
        
        # Objective function: Maximize Sharpe ratio
        # Sharpe = (Return - Risk-free rate) / Risk
        # We'll use a simplified version: Return - lambda * Risk
        
        risk_aversion = 2.0  # Risk aversion parameter
        
        # Linear terms (expected returns)
        linear = {f'x_{i}': asset.expected_return for i, asset in enumerate(self.assets)}
        
        # Quadratic terms (risk from covariance)
        quadratic = {}
        for i in range(self.num_assets):
            for j in range(self.num_assets):
                key = (f'x_{i}', f'x_{j}')
                quadratic[key] = -risk_aversion * self.covariance_matrix[i, j]
        
        qp.maximize(linear=linear, quadratic=quadratic)
        
        # Constraint: Sum of allocations = 1 (fully invested)
        linear_constraint = {f'x_{i}': 1.0 for i in range(self.num_assets)}
        qp.linear_constraint(linear=linear_constraint, sense='==', rhs=1.0, name='budget')
        
        # Constraint: Minimum diversification
        # At least min_assets must have allocation > min_allocation
        
        return qp
    
    def _calculate_covariance_matrix(self) -> np.ndarray:
        """
        Calculate covariance matrix for assets
        In production, this would use historical price data
        """
        # Simplified: Use risk values to create covariance matrix
        risks = np.array([asset.risk for asset in self.assets])
        
        # Create correlation matrix (simplified)
        correlation = np.eye(self.num_assets)
        for i in range(self.num_assets):
            for j in range(i + 1, self.num_assets):
                # Assume some correlation between assets
                correlation[i, j] = correlation[j, i] = 0.3
        
        # Covariance = correlation * outer(risks, risks)
        covariance = correlation * np.outer(risks, risks)
        
        return covariance
    
    def _extract_allocations(self, result, budget: float) -> Dict[str, float]:
        """Extract allocation amounts from optimization result"""
        allocations = {}
        
        for i, asset in enumerate(self.assets):
            var_name = f'x_{i}'
            if var_name in result.variables_dict:
                percentage = result.variables_dict[var_name]
                amount = percentage * budget
                if amount > 0:
                    allocations[asset.symbol] = amount
        
        return allocations
    
    def calculate_portfolio_metrics(self, allocations: Dict[str, float]) -> Dict[str, float]:
        """
        Calculate portfolio performance metrics
        
        Args:
            allocations: Asset allocations
        
        Returns:
            Dictionary with portfolio metrics
        """
        total_value = sum(allocations.values())
        weights = {symbol: amount / total_value for symbol, amount in allocations.items()}
        
        # Expected return
        expected_return = sum(
            weights.get(asset.symbol, 0) * asset.expected_return
            for asset in self.assets
        )
        
        # Portfolio risk (standard deviation)
        weight_vector = np.array([weights.get(asset.symbol, 0) for asset in self.assets])
        portfolio_variance = weight_vector @ self.covariance_matrix @ weight_vector
        portfolio_risk = np.sqrt(portfolio_variance)
        
        # Sharpe ratio (assuming 2% risk-free rate)
        risk_free_rate = 0.02
        sharpe_ratio = (expected_return - risk_free_rate) / portfolio_risk if portfolio_risk > 0 else 0
        
        return {
            'expected_return': expected_return,
            'risk': portfolio_risk,
            'sharpe_ratio': sharpe_ratio,
            'total_value': total_value,
            'num_assets': len(allocations)
        }


class ClassicalPortfolioOptimizer:
    """
    Classical portfolio optimization using Modern Portfolio Theory
    Used as baseline comparison for quantum optimizer
    """
    
    def __init__(self, assets: List[Asset], constraints: PortfolioConstraints):
        self.assets = assets
        self.constraints = constraints
        self.num_assets = len(assets)
    
    def optimize_markowitz(self, budget: float = 1000000.0) -> Dict[str, float]:
        """
        Optimize using Markowitz Mean-Variance optimization
        
        Args:
            budget: Total investment budget
        
        Returns:
            Optimal allocations
        """
        from scipy.optimize import minimize
        
        # Expected returns and covariance
        returns = np.array([asset.expected_return for asset in self.assets])
        risks = np.array([asset.risk for asset in self.assets])
        
        # Simplified covariance matrix
        cov_matrix = np.diag(risks ** 2)
        
        # Objective: Minimize negative Sharpe ratio
        def objective(weights):
            portfolio_return = np.dot(weights, returns)
            portfolio_risk = np.sqrt(np.dot(weights, np.dot(cov_matrix, weights)))
            sharpe = -(portfolio_return - 0.02) / portfolio_risk if portfolio_risk > 0 else 0
            return sharpe
        
        # Constraints
        constraints = [
            {'type': 'eq', 'fun': lambda w: np.sum(w) - 1.0},  # Fully invested
        ]
        
        # Bounds
        bounds = tuple((self.constraints.min_allocation, self.constraints.max_allocation) 
                      for _ in range(self.num_assets))
        
        # Initial guess (equal weight)
        x0 = np.array([1.0 / self.num_assets] * self.num_assets)
        
        # Optimize
        result = minimize(objective, x0, method='SLSQP', bounds=bounds, constraints=constraints)
        
        # Extract allocations
        allocations = {}
        for i, asset in enumerate(self.assets):
            if result.x[i] > 0.001:  # Filter out tiny allocations
                allocations[asset.symbol] = result.x[i] * budget
        
        return allocations


def compare_optimizers():
    """Compare quantum vs classical portfolio optimization"""
    
    # Create sample assets
    assets = [
        Asset('BTC', 0.50, 0.60, 45000),
        Asset('ETH', 0.40, 0.55, 3000),
        Asset('AAPL', 0.15, 0.25, 180),
        Asset('GOOGL', 0.18, 0.28, 140),
        Asset('TSLA', 0.30, 0.50, 250),
        Asset('SPY', 0.10, 0.15, 450),
        Asset('GLD', 0.05, 0.12, 180),
        Asset('USDC', 0.04, 0.01, 1),
    ]
    
    constraints = PortfolioConstraints(
        min_allocation=0.05,
        max_allocation=0.30,
        target_return=0.15,
        max_risk=0.25
    )
    
    budget = 1000000.0
    
    print("=" * 60)
    print("Portfolio Optimization Comparison")
    print("=" * 60)
    print(f"\nBudget: ${budget:,.2f}")
    print(f"Assets: {len(assets)}")
    print(f"Target Return: {constraints.target_return * 100}%")
    print(f"Max Risk: {constraints.max_risk * 100}%")
    
    # Classical optimization
    print("\n" + "-" * 60)
    print("Classical Optimization (Markowitz)")
    print("-" * 60)
    classical_opt = ClassicalPortfolioOptimizer(assets, constraints)
    classical_alloc = classical_opt.optimize_markowitz(budget)
    
    print("\nAllocations:")
    for symbol, amount in sorted(classical_alloc.items(), key=lambda x: x[1], reverse=True):
        pct = (amount / budget) * 100
        print(f"  {symbol:8s}: ${amount:12,.2f} ({pct:5.2f}%)")
    
    # Quantum optimization
    print("\n" + "-" * 60)
    print("Quantum Optimization (QAOA)")
    print("-" * 60)
    quantum_opt = QuantumPortfolioOptimizer(assets, constraints)
    
    try:
        quantum_alloc = quantum_opt.optimize(budget)
        
        print("\nAllocations:")
        for symbol, amount in sorted(quantum_alloc.items(), key=lambda x: x[1], reverse=True):
            pct = (amount / budget) * 100
            print(f"  {symbol:8s}: ${amount:12,.2f} ({pct:5.2f}%)")
        
        # Calculate metrics
        quantum_metrics = quantum_opt.calculate_portfolio_metrics(quantum_alloc)
        print(f"\nPortfolio Metrics:")
        print(f"  Expected Return: {quantum_metrics['expected_return'] * 100:.2f}%")
        print(f"  Risk (Std Dev):  {quantum_metrics['risk'] * 100:.2f}%")
        print(f"  Sharpe Ratio:    {quantum_metrics['sharpe_ratio']:.3f}")
        
    except Exception as e:
        print(f"\nQuantum optimization failed: {e}")
        print("Note: Quantum optimization requires Qiskit and quantum backend access")


if __name__ == '__main__':
    compare_optimizers()
