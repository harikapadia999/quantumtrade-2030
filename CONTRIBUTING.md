# Contributing to QuantumTrade 2030

Thank you for your interest in contributing to QuantumTrade 2030! This document provides guidelines and instructions for contributing.

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please be respectful and professional in all interactions.

## Getting Started

### Prerequisites

- Node.js 20+
- Rust 1.75+
- Python 3.11+
- Docker & Docker Compose
- Git

### Development Setup

1. **Fork and Clone**
```bash
git clone https://github.com/YOUR_USERNAME/quantumtrade-2030.git
cd quantumtrade-2030
```

2. **Install Dependencies**
```bash
# Frontend
cd frontend/web
npm install

# Backend (Node.js services)
cd backend/api-gateway
npm install

# AI/ML (Python)
cd ai-ml/prediction
pip install -r requirements.txt

# Trading Engine (Rust)
cd backend/trading-engine
cargo build
```

3. **Set Up Environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start Development Environment**
```bash
docker-compose up -d
npm run dev
```

## Development Workflow

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions/updates
- `perf/` - Performance improvements

Example: `feature/add-sentiment-analysis`

### Commit Messages

Follow conventional commits:

```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Tests
- `chore`: Maintenance

**Examples:**
```
feat(trading-engine): add stop-loss order support

fix(api): resolve race condition in order matching

docs(readme): update installation instructions
```

### Pull Request Process

1. **Create Feature Branch**
```bash
git checkout -b feature/your-feature-name
```

2. **Make Changes**
- Write clean, documented code
- Add tests for new functionality
- Update documentation as needed

3. **Test Thoroughly**
```bash
# Run tests
npm test
cargo test
pytest

# Check linting
npm run lint
cargo clippy
flake8
```

4. **Commit Changes**
```bash
git add .
git commit -m "feat(scope): description"
```

5. **Push and Create PR**
```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:
- Clear title and description
- Reference related issues
- Screenshots/videos if UI changes
- Test results

6. **Code Review**
- Address reviewer feedback
- Keep PR focused and manageable
- Rebase if needed

## Coding Standards

### TypeScript/JavaScript

- Use TypeScript for type safety
- Follow ESLint configuration
- Use async/await over callbacks
- Document complex logic
- Write unit tests

```typescript
// Good
async function fetchMarketData(symbol: string): Promise<MarketData> {
  try {
    const response = await api.get(`/market/${symbol}`);
    return response.data;
  } catch (error) {
    logger.error('Failed to fetch market data', { symbol, error });
    throw new MarketDataError('Unable to fetch data');
  }
}
```

### Rust

- Follow Rust style guidelines
- Use `cargo fmt` and `cargo clippy`
- Write comprehensive tests
- Document public APIs
- Handle errors explicitly

```rust
/// Matches orders in the order book
pub fn match_orders(&mut self, order: Order) -> Result<Vec<Trade>, MatchError> {
    // Implementation
}
```

### Python

- Follow PEP 8
- Use type hints
- Write docstrings
- Use Black for formatting
- Add unit tests

```python
def predict_price(
    model: torch.nn.Module,
    features: np.ndarray,
    horizon: int = 60
) -> Tuple[float, float]:
    """
    Predict future price movement.
    
    Args:
        model: Trained prediction model
        features: Input features
        horizon: Prediction horizon in minutes
    
    Returns:
        Tuple of (predicted_price, confidence)
    """
    # Implementation
```

## Testing

### Unit Tests

Write tests for all new functionality:

```typescript
describe('OrderBook', () => {
  it('should match buy and sell orders', () => {
    const orderBook = new OrderBook('BTC-USD');
    const buyOrder = createBuyOrder(50000, 1);
    const sellOrder = createSellOrder(50000, 1);
    
    const trades = orderBook.matchOrders(buyOrder, sellOrder);
    
    expect(trades).toHaveLength(1);
    expect(trades[0].price).toBe(50000);
  });
});
```

### Integration Tests

Test service interactions:

```python
def test_prediction_pipeline():
    # Fetch market data
    data = market_data_service.get_ohlcv('BTC-USD', '1h', 100)
    
    # Make prediction
    prediction = prediction_service.predict(data)
    
    # Verify results
    assert prediction['confidence'] > 0.5
    assert 'price_change' in prediction
```

### Performance Tests

Benchmark critical paths:

```rust
#[bench]
fn bench_order_matching(b: &mut Bencher) {
    let mut orderbook = OrderBook::new("BTC-USD");
    b.iter(|| {
        orderbook.add_order(create_test_order());
    });
}
```

## Documentation

### Code Documentation

- Document all public APIs
- Explain complex algorithms
- Add usage examples
- Keep docs up to date

### Architecture Documentation

Update `ARCHITECTURE.md` for:
- New services
- API changes
- Data flow modifications
- Infrastructure updates

### User Documentation

Update user guides for:
- New features
- UI changes
- Configuration options
- Troubleshooting

## Security

### Reporting Vulnerabilities

**DO NOT** open public issues for security vulnerabilities.

Email: security@quantumtrade.io

Include:
- Description of vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Security Best Practices

- Never commit secrets or API keys
- Use environment variables
- Validate all inputs
- Sanitize user data
- Use parameterized queries
- Implement rate limiting
- Follow OWASP guidelines

## Performance

### Optimization Guidelines

- Profile before optimizing
- Focus on bottlenecks
- Use appropriate data structures
- Implement caching strategically
- Minimize database queries
- Use connection pooling
- Optimize critical paths

### Benchmarking

Run benchmarks before and after changes:

```bash
# Rust
cargo bench

# Node.js
npm run benchmark

# Python
pytest --benchmark-only
```

## Review Checklist

Before submitting PR, ensure:

- [ ] Code follows style guidelines
- [ ] All tests pass
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] No console.log or debug code
- [ ] No commented-out code
- [ ] Error handling implemented
- [ ] Performance considered
- [ ] Security reviewed
- [ ] Backwards compatibility maintained

## Getting Help

- **Discord**: https://discord.gg/quantumtrade
- **GitHub Discussions**: Use for questions
- **GitHub Issues**: Use for bugs and features
- **Email**: dev@quantumtrade.io

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Eligible for bounties (if applicable)
- Invited to contributor events

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to QuantumTrade 2030! 🚀
