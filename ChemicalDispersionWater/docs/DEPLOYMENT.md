# Deployment Guide

## Overview

This guide covers deploying the Chemical Water Dispersion system to various environments including development, staging, and production.

## Prerequisites

### System Requirements

**Minimum Requirements:**
- **OS**: Linux (Ubuntu 20.04+), Windows Server 2019+, or macOS 10.15+
- **CPU**: 2 cores, 2.4 GHz
- **RAM**: 4 GB (8 GB recommended)
- **Storage**: 20 GB available space
- **Network**: Internet access for package downloads

**Recommended for Production:**
- **CPU**: 4+ cores, 3.0 GHz
- **RAM**: 16 GB
- **Storage**: SSD with 100+ GB
- **Load Balancer**: For high availability
- **Monitoring**: Application and infrastructure monitoring

### Software Dependencies

- **.NET 9.0 Runtime** (ASP.NET Core Runtime)
- **PostgreSQL 12+** with PostGIS extension
- **Web Server**: IIS, Nginx, or Apache (for production)
- **Reverse Proxy**: Nginx or Apache (recommended)

## Environment Configurations

### Development Environment

Already covered in the main README.md and Developer Guide.

### Staging Environment

1. **Database Setup**
   ```bash
   # Create staging database
   createdb chemical_dispersion_staging
   psql -d chemical_dispersion_staging -c "CREATE EXTENSION postgis;"
   ```

2. **Application Configuration**
   ```json
   {
     "ConnectionStrings": {
       "DefaultConnection": "Host=staging-db-server;Database=chemical_dispersion_staging;Username=app_user;Password=secure_password"
     },
     "Logging": {
       "LogLevel": {
         "Default": "Information",
         "Microsoft.AspNetCore": "Warning"
       }
     },
     "AllowedHosts": "staging.yourdomain.com"
   }
   ```

3. **Environment Variables**
   ```bash
   export ASPNETCORE_ENVIRONMENT=Staging
   export ASPNETCORE_URLS="http://0.0.0.0:5000"
   ```

### Production Environment

1. **Database Setup**
   ```bash
   # Create production database with proper user
   createuser --pwprompt chemical_app_user
   createdb -O chemical_app_user chemical_dispersion_prod
   psql -d chemical_dispersion_prod -c "CREATE EXTENSION postgis;"
   ```

2. **Security Configuration**
   ```json
   {
     "ConnectionStrings": {
       "DefaultConnection": "Host=prod-db-server;Database=chemical_dispersion_prod;Username=chemical_app_user;Password=${DB_PASSWORD}"
     },
     "Logging": {
       "LogLevel": {
         "Default": "Warning",
         "ChemicalDispersionWater": "Information"
       }
     },
     "AllowedHosts": "yourdomain.com,www.yourdomain.com",
     "HTTPS": {
       "Port": 443
     }
   }
   ```

3. **Environment Variables**
   ```bash
   export ASPNETCORE_ENVIRONMENT=Production
   export ASPNETCORE_URLS="http://0.0.0.0:5000"
   export DB_PASSWORD="your_secure_database_password"
   ```

## Deployment Methods

### 1. Traditional Server Deployment

#### Linux (Ubuntu) with Nginx

1. **Install Prerequisites**
   ```bash
   # Install .NET Runtime
   wget https://packages.microsoft.com/config/ubuntu/20.04/packages-microsoft-prod.deb -O packages-microsoft-prod.deb
   sudo dpkg -i packages-microsoft-prod.deb
   sudo apt update
   sudo apt install -y aspnetcore-runtime-9.0
   
   # Install Nginx
   sudo apt install -y nginx
   
   # Install PostgreSQL with PostGIS
   sudo apt install -y postgresql postgresql-contrib postgis
   ```

2. **Create Application User**
   ```bash
   sudo useradd -r -s /bin/false chemical-app
   sudo mkdir -p /var/www/chemical-dispersion
   sudo chown chemical-app:chemical-app /var/www/chemical-dispersion
   ```

3. **Deploy Application**
   ```bash
   # Build and publish
   dotnet publish -c Release -o /var/www/chemical-dispersion
   sudo chown -R chemical-app:chemical-app /var/www/chemical-dispersion
   sudo chmod +x /var/www/chemical-dispersion/ChemicalDispersionWater.Api
   ```

4. **Configure Systemd Service**
   
   Create `/etc/systemd/system/chemical-dispersion.service`:
   ```ini
   [Unit]
   Description=Chemical Dispersion Water API
   After=network.target
   
   [Service]
   Type=notify
   User=chemical-app
   WorkingDirectory=/var/www/chemical-dispersion
   ExecStart=/var/www/chemical-dispersion/ChemicalDispersionWater.Api
   Restart=always
   RestartSec=10
   KillSignal=SIGINT
   SyslogIdentifier=chemical-dispersion
   Environment=ASPNETCORE_ENVIRONMENT=Production
   Environment=DOTNET_PRINT_TELEMETRY_MESSAGE=false
   Environment=ASPNETCORE_URLS=http://localhost:5000
   
   [Install]
   WantedBy=multi-user.target
   ```

5. **Configure Nginx**
   
   Create `/etc/nginx/sites-available/chemical-dispersion`:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com www.yourdomain.com;
       
       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection keep-alive;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

6. **Enable and Start Services**
   ```bash
   # Enable Nginx site
   sudo ln -s /etc/nginx/sites-available/chemical-dispersion /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   
   # Start application service
   sudo systemctl enable chemical-dispersion
   sudo systemctl start chemical-dispersion
   sudo systemctl status chemical-dispersion
   ```

#### Windows Server with IIS

1. **Install Prerequisites**
   - Install IIS with ASP.NET Core Module
   - Install .NET 9.0 Runtime
   - Install PostgreSQL

2. **Publish Application**
   ```powershell
   dotnet publish -c Release -o C:\inetpub\chemical-dispersion
   ```

3. **Configure IIS**
   - Create new site in IIS Manager
   - Point to published application folder
   - Configure application pool for "No Managed Code"

### 2. Docker Deployment

#### Dockerfile for API

Create `backend/ChemicalDispersionWater.Api/Dockerfile`:
```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ["backend/ChemicalDispersionWater.Api/ChemicalDispersionWater.Api.csproj", "backend/ChemicalDispersionWater.Api/"]
COPY ["backend/ChemicalDispersionWater.Domain/ChemicalDispersionWater.Domain.csproj", "backend/ChemicalDispersionWater.Domain/"]
COPY ["shared/ChemicalDispersionWater.SharedModels.csproj", "shared/"]
RUN dotnet restore "backend/ChemicalDispersionWater.Api/ChemicalDispersionWater.Api.csproj"

COPY . .
WORKDIR "/src/backend/ChemicalDispersionWater.Api"
RUN dotnet build "ChemicalDispersionWater.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "ChemicalDispersionWater.Api.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "ChemicalDispersionWater.Api.dll"]
```

#### Docker Compose

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  api:
    build: 
      context: .
      dockerfile: backend/ChemicalDispersionWater.Api/Dockerfile
    ports:
      - "5000:80"
    environment:
      - ASPNETCORE_ENVIRONMENT=Production
      - ConnectionStrings__DefaultConnection=Host=db;Database=chemical_dispersion;Username=chemical_user;Password=chemical_password
    depends_on:
      - db
    volumes:
      - ./logs:/app/logs

  db:
    image: postgis/postgis:13-3.1
    environment:
      - POSTGRES_DB=chemical_dispersion
      - POSTGRES_USER=chemical_user
      - POSTGRES_PASSWORD=chemical_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./db/init-db.sql:/docker-entrypoint-initdb.d/init-db.sql

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - api

volumes:
  postgres_data:
```

#### Deploy with Docker
```bash
# Build and start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs api
```

### 3. Cloud Deployment

#### Azure App Service

1. **Create Resources**
   ```bash
   # Create resource group
   az group create --name chemical-dispersion-rg --location eastus
   
   # Create App Service plan
   az appservice plan create --name chemical-dispersion-plan --resource-group chemical-dispersion-rg --sku B1 --is-linux
   
   # Create web app
   az webapp create --name chemical-dispersion-api --resource-group chemical-dispersion-rg --plan chemical-dispersion-plan --runtime "DOTNETCORE:9.0"
   ```

2. **Configure Database**
   ```bash
   # Create PostgreSQL server
   az postgres server create --name chemical-dispersion-db --resource-group chemical-dispersion-rg --location eastus --admin-user chemical_admin --admin-password YourSecurePassword123 --sku-name GP_Gen5_1
   ```

3. **Deploy Application**
   ```bash
   # Publish and deploy
   dotnet publish -c Release
   az webapp deploy --resource-group chemical-dispersion-rg --name chemical-dispersion-api --src-path ./publish.zip
   ```

#### AWS Elastic Beanstalk

1. **Install EB CLI**
   ```bash
   pip install awsebcli
   ```

2. **Initialize Application**
   ```bash
   eb init chemical-dispersion-api --platform "64bit Amazon Linux 2 v2.2.0 running .NET Core" --region us-east-1
   ```

3. **Deploy**
   ```bash
   dotnet publish -c Release
   eb create production --database.engine postgres
   eb deploy
   ```

## Database Migration and Management

### Production Migration Strategy

1. **Backup Current Database**
   ```bash
   pg_dump chemical_dispersion_prod > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Apply Migrations**
   ```bash
   dotnet ef database update --connection "Host=prod-server;Database=chemical_dispersion_prod;Username=user;Password=pass"
   ```

3. **Rollback if Needed**
   ```bash
   dotnet ef database update PreviousMigrationName --connection "connection_string"
   ```

### Data Seeding

For production deployments, seed essential data:

```csharp
// In Program.cs or startup
if (app.Environment.IsProduction())
{
    using var scope = app.Services.CreateScope();
    var context = scope.ServiceProvider.GetRequiredService<ChemicalDispersionDbContext>();
    
    // Seed essential chemicals
    if (!context.Chemicals.Any())
    {
        context.Chemicals.AddRange(
            new Chemical { Name = "Benzene", CASNumber = "71-43-2" },
            new Chemical { Name = "Toluene", CASNumber = "108-88-3" }
        );
        context.SaveChanges();
    }
}
```

## Monitoring and Logging

### Application Logging

1. **Configure Structured Logging**
   ```json
   {
     "Serilog": {
       "MinimumLevel": "Information",
       "WriteTo": [
         {
           "Name": "File",
           "Args": {
             "path": "/var/log/chemical-dispersion/app-.log",
             "rollingInterval": "Day",
             "retainedFileCountLimit": 30
           }
         }
       ]
     }
   }
   ```

2. **Add Health Checks**
   ```csharp
   // In Program.cs
   builder.Services.AddHealthChecks()
       .AddDbContext<ChemicalDispersionDbContext>()
       .AddNpgSql(connectionString);
   
   app.MapHealthChecks("/health");
   ```

### Infrastructure Monitoring

1. **System Metrics**
   - CPU and memory usage
   - Disk space and I/O
   - Network connectivity
   - Database performance

2. **Application Metrics**
   - Response times
   - Error rates
   - Active connections
   - Database query performance

### Alerting

Set up alerts for:
- Application errors (>5% error rate)
- High response times (>2 seconds)
- Database connection failures
- Disk space usage (>80%)
- Memory usage (>90%)

## Security Considerations

### HTTPS Configuration

1. **Obtain SSL Certificate**
   ```bash
   # Using Let's Encrypt with Certbot
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```

2. **Configure HTTPS Redirect**
   ```csharp
   // In Program.cs
   if (app.Environment.IsProduction())
   {
       app.UseHttpsRedirection();
       app.UseHsts();
   }
   ```

### Database Security

1. **Network Security**
   - Use private networks
   - Configure firewall rules
   - Limit database access to application servers

2. **Authentication**
   - Use strong passwords
   - Consider certificate-based authentication
   - Implement connection pooling

### Application Security

1. **API Security**
   - Implement rate limiting
   - Use CORS appropriately
   - Validate all inputs
   - Implement authentication (future)

2. **Secrets Management**
   - Use environment variables
   - Consider Azure Key Vault or AWS Secrets Manager
   - Never commit secrets to source control

## Backup and Disaster Recovery

### Database Backups

1. **Automated Backups**
   ```bash
   #!/bin/bash
   # daily-backup.sh
   BACKUP_DIR="/backups/chemical-dispersion"
   DATE=$(date +%Y%m%d_%H%M%S)
   
   pg_dump chemical_dispersion_prod > "$BACKUP_DIR/backup_$DATE.sql"
   
   # Keep only last 30 days
   find $BACKUP_DIR -name "backup_*.sql" -mtime +30 -delete
   ```

2. **Schedule with Cron**
   ```bash
   # Add to crontab
   0 2 * * * /scripts/daily-backup.sh
   ```

### Application Backups

1. **Configuration Files**
   - appsettings.json
   - Nginx/IIS configuration
   - SSL certificates

2. **Application Code**
   - Deploy from version control
   - Keep deployment scripts
   - Document deployment procedures

### Recovery Procedures

1. **Database Recovery**
   ```bash
   # Restore from backup
   psql chemical_dispersion_prod < backup_20250921_020000.sql
   ```

2. **Application Recovery**
   - Redeploy from latest stable version
   - Restore configuration files
   - Verify connectivity and functionality

## Performance Optimization

### Application Performance

1. **Database Optimization**
   - Add appropriate indexes
   - Use connection pooling
   - Optimize queries with EXPLAIN
   - Consider read replicas for scaling

2. **Caching**
   ```csharp
   // Add memory caching
   builder.Services.AddMemoryCache();
   
   // Add distributed caching for scaling
   builder.Services.AddStackExchangeRedisCache(options =>
   {
       options.Configuration = "your-redis-connection";
   });
   ```

### Infrastructure Scaling

1. **Horizontal Scaling**
   - Load balancer configuration
   - Multiple application instances
   - Database read replicas

2. **Vertical Scaling**
   - Increase CPU and memory
   - Optimize database server
   - Use SSD storage

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Check connection string
   - Verify database server status
   - Check firewall rules
   - Test connectivity with psql

2. **Application Startup Errors**
   - Check application logs
   - Verify .NET runtime version
   - Check file permissions
   - Validate configuration files

3. **Performance Issues**
   - Monitor database queries
   - Check memory usage
   - Analyze application logs
   - Review network latency

### Log Analysis

```bash
# Check application logs
sudo journalctl -u chemical-dispersion -f

# Check Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Check database logs
sudo tail -f /var/log/postgresql/postgresql-13-main.log
```

## Maintenance

### Regular Maintenance Tasks

1. **Weekly**
   - Review application logs
   - Check system resources
   - Verify backup integrity

2. **Monthly**
   - Update system packages
   - Review security logs
   - Performance analysis

3. **Quarterly**
   - Disaster recovery testing
   - Security audit
   - Capacity planning review

### Update Procedures

1. **Application Updates**
   ```bash
   # Deploy new version
   sudo systemctl stop chemical-dispersion
   sudo cp -r /tmp/new-version/* /var/www/chemical-dispersion/
   sudo systemctl start chemical-dispersion
   ```

2. **System Updates**
   ```bash
   # Update packages
   sudo apt update && sudo apt upgrade
   
   # Restart if kernel updated
   sudo reboot
   ```