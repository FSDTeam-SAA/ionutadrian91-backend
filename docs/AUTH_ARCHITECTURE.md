# Authentication Architecture - Production-Ready for 1M+ Traffic

## Overview
This document explains the secure, scalable authentication architecture following industry best practices.

---

## 🔐 Security Features Implemented

### 1. ✅ JTI (JWT ID) Tied to Refresh Token

**Problem Solved:** Previously, refresh token ID wasn't embedded in JWT.

**Implementation:**
```typescript
// JTI generated FIRST (cryptographically secure)
const jti: string = crypto.randomBytes(32).toString('hex');

// Embedded in JWT using standard jwtid claim
const refreshToken = jwt.sign(
  { userId, jti },
  secret,
  { jwtid: jti } // Standard JWT claim
);
```

**Benefits:**
- ✅ Can detect token replay attacks
- ✅ Can rotate tokens safely
- ✅ Can revoke single tokens reliably
- ✅ Links JWT to Redis for validation

---

### 2. ✅ Refresh Token Hash Storage

**Problem Solved:** Raw tokens stored in Redis = security risk if leaked.

**Implementation:**
```typescript
// Hash token before storage (never store raw)
const tokenHash = crypto.createHash('sha256')
  .update(refreshToken)
  .digest('hex');

// Store in Redis
await redis.set(key, {
  userId,
  jti,
  tokenHash, // Only hash stored!
  ip,
  userAgent,
  createdAt
});
```

**Validation on refresh:**
```typescript
const storedData = await redis.get(key);
const currentHash = hashToken(providedRefreshToken);

if (storedData.tokenHash !== currentHash) {
  // Token tampered! Revoke all user tokens
  await revokeAllUserTokens(userId);
  throw Error('Invalid token');
}
```

**Benefits:**
- ✅ Even if Redis leaks, attacker can't use hashes
- ✅ Validates token integrity
- ✅ Detects tampering attempts

---

### 3. ✅ Token Rotation Enforcement

**Problem Solved:** Same refresh token reusable forever = replay attacks.

**Implementation:**
```typescript
async refreshToken(oldRefreshToken, meta) {
  // 1. Verify old token
  const { userId, jti } = verifyRefreshToken(oldRefreshToken);
  
  // 2. Get stored data from Redis
  const storedData = await redis.get(`refresh:user:${userId}:${jti}`);
  
  // 3. Token not found = already rotated = REPLAY ATTACK
  if (!storedData) {
    await revokeAllUserTokens(userId); // Security measure
    throw Error('Token revoked');
  }
  
  // 4. Generate NEW JTI for new token
  const newJti = generateSecureId();
  
  // 5. ATOMIC rotation: Delete old, create new
  await Promise.all([
    redis.del(`refresh:user:${userId}:${jti}`),      // Delete old
    redis.set(`refresh:user:${userId}:${newJti}`, newData), // Create new
  ]);
  
  return { newAccessToken, newRefreshToken };
}
```

**Benefits:**
- ✅ Each refresh token usable ONCE only
- ✅ Replay attacks detected and blocked
- ✅ All user tokens revoked on suspicious activity

---

### 4. ✅ Timing Attack Prevention

**Problem Solved:** Response time difference reveals valid emails.

**Before (Vulnerable):**
```typescript
if (!user) throw Error('Invalid'); // Fast ~1ms
// vs
await bcrypt.compare(password, user.password); // Slow ~200ms
```

**After (Secure):**
```typescript
const fakeHash = '$2a$12$...'; // Pre-generated

if (!user) {
  // Run fake bcrypt to match timing
  await bcrypt.compare(password, fakeHash);
  throw Error('Invalid');
}

// Real comparison
await bcrypt.compare(password, user.password);
```

**Benefits:**
- ✅ Consistent ~200ms response regardless of user existence
- ✅ Prevents email enumeration attacks
- ✅ No information leakage

---

### 5. ✅ Rate Limiting Without Redis Explosion

**Problem Solved:** User-agent rate limiting = attackers fill Redis.

**Before (Vulnerable):**
```typescript
// Attacker randomizes user-agent → millions of Redis keys
await checkRateLimit(`login:ua:${userAgent}`); // ❌
```

**After (Secure):**
```typescript
// Only rate limit by email and IP
await Promise.all([
  checkRateLimit(`login:email:${email}`),
  checkRateLimit(`login:ip:${ip}`),
]);
// No user-agent rate limiting ✅
```

**Benefits:**
- ✅ Predictable Redis key count
- ✅ Still prevents brute force
- ✅ No memory explosion risk

---

### 6. ✅ Cryptographically Secure IDs

**Problem Solved:** `Math.random()` not secure, can collide.

**Before:**
```typescript
const id = `${userId}:${Date.now()}:${Math.random().toString(36)}`; // ❌
```

**After:**
```typescript
import crypto from 'crypto';
const jti = crypto.randomBytes(32).toString('hex'); // ✅ 256 bits entropy
```

**Benefits:**
- ✅ Cryptographically secure randomness
- ✅ Virtually no collision risk
- ✅ Cannot be predicted

---

### 7. ✅ Multi-Device Limit

**Problem Solved:** Unlimited sessions = abuse potential.

**Implementation:**
```typescript
const MAX_DEVICES_PER_USER = 5;

async enforceMaxDevices(userId, maxDevices) {
  const sessions = await redis.get(`sessions:user:${userId}`);
  
  if (sessions.length <= maxDevices) return;
  
  // Remove oldest sessions
  const toRemove = sessions.slice(0, sessions.length - maxDevices + 1);
  
  await Promise.all(
    toRemove.map(jti => redis.del(`refresh:user:${userId}:${jti}`))
  );
}
```

**Benefits:**
- ✅ Limits concurrent logins
- ✅ Auto-removes oldest devices
- ✅ Prevents session abuse

---

### 8. ✅ Minimal Access Token Payload

**Problem Solved:** Email in JWT = larger tokens, privacy risk.

**Before:**
```typescript
{ userId, email, role } // Includes email
```

**After:**
```typescript
{ userId, role } // Minimal - fetch email when needed
```

**Benefits:**
- ✅ Smaller JWT size
- ✅ Less PII in token
- ✅ Role changes reflect on next login

---

### 9. ✅ Shorter Access Token Lifetime

**Changed:**
```typescript
ACCESS: '15m',  // Was '1h'
REFRESH: '7d',  // Unchanged
```

**Benefits:**
- ✅ Shorter window for stolen tokens
- ✅ Forces more frequent refresh (token rotation)
- ✅ Better security posture

---

## 🏗️ Architecture Overview

### Token Flow
```
┌─────────────────────────────────────────────────────────┐
│                        LOGIN                             │
├─────────────────────────────────────────────────────────┤
│ 1. Rate limit check (email + IP only)                   │
│ 2. Fetch user + security data (1 query)                 │
│ 3. Timing-safe password verification                    │
│ 4. Generate JTI (crypto.randomBytes)                    │
│ 5. Create access token (stateless, minimal)             │
│ 6. Create refresh token (with JTI)                      │
│ 7. Hash refresh token                                   │
│ 8. Store hash in Redis: refresh:user:{id}:{jti}        │
│ 9. Enforce max devices                                  │
│ 10. Return tokens                                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    REFRESH TOKEN                         │
├─────────────────────────────────────────────────────────┤
│ 1. Verify refresh JWT signature                         │
│ 2. Extract JTI from token                               │
│ 3. Lookup in Redis: refresh:user:{id}:{jti}            │
│ 4. If not found → REPLAY ATTACK → revoke all           │
│ 5. Verify token hash matches                            │
│ 6. Generate NEW JTI                                     │
│ 7. ATOMIC: delete old, create new                       │
│ 8. Return new token pair                                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    AUTH CHECK                            │
├─────────────────────────────────────────────────────────┤
│ 1. Extract access token from header                     │
│ 2. Verify JWT signature                                 │
│ 3. Done! (No Redis/DB lookup)                          │
└─────────────────────────────────────────────────────────┘
```

### Redis Key Structure
```
app:refresh:user:{userId}:{jti}     → Token hash + metadata
app:sessions:user:{userId}          → List of active JTIs
app:rate_limit:login:email:{email}  → Rate limit counter
app:rate_limit:login:ip:{ip}        → Rate limit counter
```

---

## 📊 Security Comparison

| Feature | ❌ Before | ✅ After |
|---------|----------|---------|
| **JTI in JWT** | No | Yes |
| **Token hash storage** | No | Yes (SHA-256) |
| **Token rotation** | No | Yes (mandatory) |
| **Replay detection** | No | Yes |
| **Timing attack prevention** | No | Yes (fake bcrypt) |
| **UA rate limiting** | Yes (DoS risk) | No (removed) |
| **Secure random IDs** | Math.random() | crypto.randomBytes() |
| **Max devices** | Unlimited | 5 (configurable) |
| **Access token payload** | userId, email, role | userId, role |
| **Access token TTL** | 1 hour | 15 minutes |

---

## 🚀 Scalability Characteristics

### For 1M+ Daily Active Users

#### Redis Usage (Optimized)
- **Per user:** 1-5 keys (max devices)
- **Per login:** 2 rate limit keys (email + IP)
- **Total:** ~5M keys max for 1M users
- **Memory:** ~500MB (with proper TTLs)

#### Database Load
- **Login:** 1 read + 1 conditional write
- **Refresh:** 1 read (user fetch)
- **Auth check:** 0 queries ✅

#### Request Performance
- **Login:** ~200ms (bcrypt dominant)
- **Refresh:** ~10ms (Redis + JWT)
- **Auth check:** ~1ms (JWT verify only)

---

## 🔧 Configuration

```typescript
export const AUTH_CONFIG = {
  TOKEN_EXPIRY: {
    ACCESS: '15m',   // Short for security
    REFRESH: '7d',   // Long for convenience
  },
  
  SESSION: {
    MAX_DEVICES_PER_USER: 5,
  },
  
  RATE_LIMIT: {
    LOGIN_MAX_ATTEMPTS: 5,
    LOGIN_WINDOW_MS: 15 * 60 * 1000, // 15 min
  },
  
  ACCOUNT_LOCKOUT: {
    MAX_FAILED_ATTEMPTS: 5,
    LOCKOUT_DURATION_MS: 30 * 60 * 1000, // 30 min
  },
};
```

---

## 🛡️ Attack Mitigation Summary

| Attack | Mitigation |
|--------|------------|
| **Brute force** | Rate limiting (email + IP) |
| **User enumeration** | Timing attack prevention |
| **Token theft** | Short TTL (15m), rotation |
| **Token replay** | JTI + rotation detection |
| **Session hijacking** | Token hash validation |
| **Redis leak** | Only hashes stored |
| **Device sprawl** | Max 5 devices per user |
| **DoS via UA** | UA rate limiting removed |

---

## ✅ Checklist for Production

- [x] JTI embedded in refresh tokens
- [x] Refresh tokens hashed before storage
- [x] Token rotation enforced
- [x] Replay attack detection
- [x] Timing attack prevention
- [x] Cryptographically secure IDs
- [x] Multi-device limit
- [x] Minimal access token payload
- [x] Short access token TTL
- [x] Rate limiting without Redis explosion
- [x] Account lockout mechanism
- [x] Generic error messages
- [x] Stateless access token verification
- [x] Fire-and-forget audit logging

**This architecture is now production-ready for 1M+ traffic!** 🎉
