# Message Requirements & Routing Rationale

## Why Message Requirements?

Different cross-chain operations have different needs. Some prioritize cost, others prioritize speed. The `MessageRequirements` system helps choose the optimal routing path based on your specific needs.

## EIL Native Bridges vs LayerZero

### EIL Native Bridges

**What they are:** Direct L1↔L2 bridges (Arbitrum, Optimism native bridges)

**Pros:**
- ✅ **Lower cost** - Native bridge fees are typically cheaper
- ✅ **Native security** - Uses the rollup's own security model
- ✅ **Direct integration** - Built into the L2 infrastructure
- ✅ **Proven reliability** - Battle-tested by rollup protocols

**Cons:**
- ❌ **7-day challenge period** - L2→L1 messages must wait 7 days
- ❌ **Limited chains** - Only works for specific L2s (Arbitrum, Optimism)
- ❌ **Manual proof submission** - Users must submit Merkle proofs
- ❌ **Slower finality** - Can take days for L2→L1 messages

**Best for:**
- Cost-sensitive operations
- Operations that can tolerate delays
- Simple L1↔L2 coordination
- High-volume, low-urgency transfers

---

### LayerZero v2

**What it is:** Universal cross-chain messaging protocol (60+ chains)

**Pros:**
- ✅ **Fast finality** - Minutes to hours, no 7-day wait
- ✅ **Universal** - Works across 60+ chains
- ✅ **Guaranteed delivery** - Executor abstraction ensures delivery
- ✅ **Automatic** - No manual proof submission needed
- ✅ **DVN security** - Decentralized verifier network

**Cons:**
- ❌ **Higher cost** - More expensive than native bridges
- ❌ **Third-party dependency** - Relies on LayerZero infrastructure
- ❌ **Complexity** - More moving parts (DVNs, Executors)

**Best for:**
- Time-sensitive operations
- Multi-chain operations
- Operations requiring guaranteed delivery
- Chains without native bridges

---

## Decision Matrix

| Requirement | EIL Native | LayerZero |
|-------------|------------|-----------|
| **Cost** | ✅ Lower | ❌ Higher |
| **Speed** | ❌ Slower (7 days) | ✅ Faster (minutes) |
| **Chain Support** | ❌ Limited (L1↔L2) | ✅ Universal (60+) |
| **Reliability** | ✅ Native security | ✅ DVN security |
| **Ease of Use** | ❌ Manual proofs | ✅ Automatic |

## Security Considerations

### EIL Native Bridges Security
- ✅ **Native Security** - Uses rollup's own security model
- ✅ **Dispute Resolution** - Built-in dispute mechanisms
- ✅ **Economic Security** - XLP staking/slashing
- ✅ **Audit Trail** - Complete on-chain history

### LayerZero Security
- ✅ **DVN Security** - Decentralized verifier network
- ⚠️ **Third-Party Dependency** - Relies on LayerZero infrastructure
- ❌ **No Built-in Disputes** - Different trust model

## Routing Logic

The `MessageRequirements` system uses these factors to choose (in priority order):

1. **Security Requirements** (Highest Priority)
   - `requiresNativeSecurity` → Prefer EIL Native (if available)
   - `requiresDisputeResolution` → Prefer EIL Native
   - `securityLevel == CRITICAL` → Prefer EIL Native

2. **Speed Requirements**
   - `requiresFastFinality` → LayerZero
   - `requiresGuaranteedDelivery` → LayerZero

3. **Operational Requirements**
   - `isMultiChain` → LayerZero
   - `isCostSensitive + can wait` → EIL Native

4. **Chain Support**
   - Chain not supported by native bridge → LayerZero

## Example Scenarios

### Scenario 1: High-Volume, Low-Urgency
```
Requirement: Cost-sensitive, can wait 7 days
Decision: EIL Native Bridge
Reason: Save money, no rush
```

### Scenario 2: Critical Transfer (Fast)
```
Requirement: Fast finality, guaranteed delivery
Decision: LayerZero
Reason: Need speed and reliability
```

### Scenario 3: Multi-Chain Broadcast
```
Requirement: Send to 5 different chains
Decision: LayerZero
Reason: Only LayerZero supports all chains
```

### Scenario 4: High-Security Transfer
```
Requirement: requiresNativeSecurity=true, securityLevel=HIGH
Decision: EIL Native Bridge
Reason: Need native security and dispute resolution
```

### Scenario 5: Critical Security Operation
```
Requirement: securityLevel=CRITICAL, requiresDisputeResolution=true
Decision: EIL Native Bridge (if delay acceptable)
Reason: Maximum security requirements
```

## Security Requirements

The system now supports security-aware routing:

- **`requiresNativeSecurity`** - Prefer native bridge security (EIL)
- **`requiresDisputeResolution`** - Need dispute mechanisms (EIL)
- **`securityLevel`** - LOW, MEDIUM, HIGH, or CRITICAL

Security requirements take precedence over speed/cost considerations.

## Summary

**EIL Native Bridges** = Cost-optimized, slower, L1↔L2 only, native security, dispute resolution

**LayerZero** = Speed-optimized, universal, guaranteed delivery, DVN security

The `MessageRequirements` system automatically chooses the best option based on your needs, with security requirements taking highest priority.

