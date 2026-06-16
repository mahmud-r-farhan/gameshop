# GameShop Security

## Authentication & Authorization

### JWT-Based Authentication

- Access tokens expire in 24 hours
- Refresh tokens expire in 7 days
- Tokens are signed with separate secrets
- Tokens are stored in `Authorization: Bearer <token>` header

### Role-Based Access Control

| Role | Access |
|------|--------|
| `USER` | Browse products, place orders, manage own profile |
| `ADMIN` | All user access + admin panel, product management, payment verification |

### Password Policy

- Minimum 8 characters
- Must contain uppercase, lowercase, number, and special character
- Passwords hashed with bcrypt (salt rounds: 10)
- Rate limiting on login: 5 attempts per 15 minutes

## API Security

### Rate Limiting

| Endpoint | Rate |
|----------|------|
| General API | 100 requests/minute |
| Login | 5 requests/15 minutes |
| Registration | 3 requests/hour |

### Headers

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: no-referrer-when-downgrade
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'
```

### Input Validation

- All user input validated with Zod schemas
- SQL injection prevented by Prisma ORM (parameterized queries)
- XSS prevented by React's automatic escaping
- File upload size limited to 20MB

## Infrastructure Security

### Database

- PostgreSQL runs on internal Docker network
- Database user has least-privilege access
- Connection strings use strong passwords
- Automated daily backups with 30-day retention

### Redis

- Password-protected access
- Runs on internal Docker network only
- Memory limited to 512MB
- LRU eviction policy

### Network

- Only ports 80 (HTTP) and 443 (HTTPS) exposed
- SSH limited to key-based authentication
- Fail2ban configured for brute force protection
- UFW firewall enabled with minimal rules

## Data Protection

### Sensitive Data

- Passwords: bcrypt hashed (never stored in plaintext)
- JWT secrets: environment variables only
- API keys: environment variables only
- Payment data: transaction IDs only (no card details stored)
- Personal data: encrypted at rest

### GDPR Compliance

- User data export available
- Account deletion on request
- Session management
- Cookie consent (if applicable)

## Reporting Vulnerabilities

If you discover a security vulnerability, please:

1. **Do not** open a public issue
2. Email: security@gameshop.com
3. Provide detailed description and steps to reproduce
4. Allow 72 hours for initial response

We take all security reports seriously and will respond promptly.

## Best Practices for Developers

### Local Development

```bash
# Never commit .env files
echo ".env" >> .gitignore

# Use different secrets in dev vs production
# Run security checks before committing
npm run lint
```

### Production Deployment

```bash
# Rotate all secrets before production
# Enable HTTPS only
# Use strong, unique passwords
# Enable automated security updates
sudo apt install unattended-upgrades
```

### Secure Coding

```typescript
// ✅ DO: Use parameterized queries (Prisma)
const user = await prisma.user.findUnique({ where: { email } });

// ❌ DON'T: String interpolation in queries
const user = await prisma.$queryRaw`SELECT * FROM users WHERE email = '${email}'`;
```
