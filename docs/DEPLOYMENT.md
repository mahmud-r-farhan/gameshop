# GameShop Deployment Guide

## Overview

This guide covers deploying GameShop to production using Docker on a VPS.

## Prerequisites

- A VPS with Ubuntu 22.04+ (minimum 2GB RAM, 2 vCPU)
- A registered domain name
- Docker & Docker Compose installed
- Nginx installed

## Step 1: VPS Initial Setup

```bash
# Connect to your VPS
ssh ubuntu@your-vps-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Log out and back in for group changes to take effect

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Nginx
sudo apt install nginx -y

# Install Certbot (for SSL)
sudo apt install certbot python3-certbot-nginx -y

# Configure firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Step 2: Configure DNS

Add A records in your DNS provider dashboard:

```
yourdomain.com  →  VPS_IP
www.yourdomain.com  →  VPS_IP
admin.yourdomain.com  →  VPS_IP
```

## Step 3: Deploy Application

```bash
# Clone repository
cd /var/www
sudo mkdir gameshop
sudo chown $USER:$USER gameshop
git clone https://github.com/mahmud-r-farhan/gameshop.git .

# Create environment file
cp .env.example .env
```

Edit `.env` with your production values:

```env
DOMAIN_NAME=yourdomain.com
DB_PASSWORD=<secure_random_password>
REDIS_PASSWORD=<secure_random_password>
JWT_SECRET=<long_random_string>
JWT_REFRESH_SECRET=<different_long_random_string>
```

## Step 4: Set Up SSL Certificate

```bash
# Get SSL certificate
sudo certbot certonly --nginx -d yourdomain.com -d www.yourdomain.com -d admin.yourdomain.com

# Copy certificates for Docker
sudo mkdir -p /var/www/gameshop/ssl
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /var/www/gameshop/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /var/www/gameshop/ssl/
sudo chmod 600 /var/www/gameshop/ssl/privkey.pem
```

## Step 5: Start Production Services

```bash
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose -f docker-compose.prod.yml logs -f

# Verify health
curl http://localhost:5000/health
```

## Step 6: Configure Nginx

Replace the Nginx config:

```bash
sudo rm /etc/nginx/sites-enabled/default
sudo cp nginx/prod.conf /etc/nginx/nginx.conf
sudo nginx -t
sudo systemctl restart nginx
```

## Step 7: Run Database Migrations

```bash
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npm run prisma:seed
```

## Step 8: Verify Deployment

```bash
# Health check
curl https://yourdomain.com/health

# API test
curl https://yourdomain.com/api/v1/products
```

## SSL Auto-Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Set up cron for auto-renewal
sudo crontab -e
# Add: 0 3 * * 1 certbot renew --quiet && docker exec gameshop_nginx nginx -s reload
```

## Backup Configuration

### Automated Database Backups

```bash
# Create backup script
cat > /usr/local/bin/backup-gameshop.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/gameshop"
mkdir -p $BACKUP_DIR
docker exec gameshop_postgres pg_dump -U gameshop gameshop_db | gzip > $BACKUP_DIR/gameshop_$(date +%Y%m%d).sql.gz
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
EOF

chmod +x /usr/local/bin/backup-gameshop.sh

# Add to crontab
0 2 * * * /usr/local/bin/backup-gameshop.sh
```

### Restore from Backup

```bash
gunzip < /var/backups/gameshop/gameshop_20240101.sql.gz | docker exec -i gameshop_postgres psql -U gameshop gameshop_db
```

## Monitoring

### Quick Health Check

```bash
# Container status
docker ps

# Resource usage
docker stats

# Logs
docker-compose logs --tail=100 backend
```

### Prometheus Metrics

Available at: `https://yourdomain.com/metrics` (if enabled)

### Common Issues

| Issue | Solution |
|-------|----------|
| SSL Certificate Expired | Run `sudo certbot renew` and reload nginx |
| Database Full | `docker system prune -a` and check backups |
| High Memory Usage | `docker-compose restart backend` or scale up VPS |
| 502 Bad Gateway | Check if backend is running: `docker ps \| grep backend` |

## Scaling

### Horizontal Scaling (Multiple Backend Instances)

Edit `docker-compose.prod.yml` and add additional backend services, then update Nginx upstream config.

### Vertical Scaling

Upgrade your VPS plan for more RAM/CPU, then restart:
```bash
docker-compose down
docker-compose up -d
```
