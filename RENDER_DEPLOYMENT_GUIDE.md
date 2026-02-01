# Render.com Deployment Guide for Starhawk Backend

This guide provides step-by-step instructions for deploying the Starhawk Backend to Render.com.

## Prerequisites

1. **GitHub Account** - Your code must be in a GitHub repository
2. **Render Account** - Sign up at [render.com](https://render.com)
3. **MongoDB Atlas Account** - For cloud database (or use Render's MongoDB service)

---

## Step 1: Prepare Your Repository

### 1.1 Ensure Your Code is on GitHub

1. Push your code to a GitHub repository:
   ```bash
   git add .
   git commit -m "Prepare for Render deployment"
   git push origin main
   ```

### 1.2 Verify Key Files Exist

Make sure these files are in your repository root:
- ✅ `package.json`
- ✅ `tsconfig.json`
- ✅ `nest-cli.json`
- ✅ `.gitignore` (should exclude `node_modules`, `.env`, `dist/`)

---

## Step 2: Set Up MongoDB Atlas (Cloud Database)

### 2.1 Create MongoDB Atlas Account

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up for a free account
3. Create a new cluster (Free tier: M0)

### 2.2 Configure Database Access

1. Go to **Database Access**
2. Click **Add New Database User**
3. Choose **Password** authentication
4. Create a username and strong password (save these!)
5. Set user privileges to **Read and write to any database**

### 2.3 Configure Network Access

1. Go to **Network Access**
2. Click **Add IP Address**
3. For Render deployment, click **Allow Access from Anywhere** (0.0.0.0/0)
   - ⚠️ For production, restrict to Render's IP ranges later

### 2.4 Get Connection String

1. Go to **Database** → Click **Connect** on your cluster
2. Choose **Connect your application**
3. Copy the connection string (looks like):
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
4. Replace `<username>` and `<password>` with your database user credentials
5. Add your database name at the end: `/starhawk?retryWrites=true&w=majority`

**Final connection string format:**
```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/starhawk?retryWrites=true&w=majority
```

---

## Step 3: Deploy on Render

### 3.1 Create a New Web Service

1. Log in to [Render Dashboard](https://dashboard.render.com)
2. Click **New +** → **Web Service**
3. Connect your GitHub account if not already connected
4. Select your repository
5. Click **Connect**

### 3.2 Configure Build Settings

Fill in the following configuration:

**Basic Settings:**
- **Name**: `starhawk-backend` (or your preferred name)
- **Region**: Choose closest to your users (e.g., `Oregon (US West)`)
- **Branch**: `main` (or your default branch)
- **Root Directory**: Leave empty (if repo is at root) or specify if nested

**Build Settings:**
- **Runtime**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start:prod`

**Plan Settings:**
- Start with **Free** tier (suitable for development/testing)
- Upgrade to **Starter** ($7/month) or higher for production

### 3.3 Configure Environment Variables

Click **Environment** tab and add these variables:

#### Required Variables:

```env
# Application
NODE_ENV=production
PORT=10000
CORS_ORIGIN=https://your-frontend-domain.com,*

# Database (Use your MongoDB Atlas connection string)
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/starhawk?retryWrites=true&w=majority

# JWT Authentication (Generate a secure secret)
JWT_SECRET=your_base64_encoded_secret_here
JWT_EXPIRATION_MS=86400000

# EOSDA API
EOSDA_API_URL=https://api-connect.eos.com
EOSDA_API_KEY=your_eosda_api_key_here

# Email Configuration (SMTP)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=your-email@gmail.com
MAIL_PASSWORD=your-app-specific-password
MAIL_FROM=noreply@starhawk.com

# Admin Bootstrap (IMPORTANT: Change these!)
ADMIN_EMAIL=admin@starhawk.com
ADMIN_PHONE=0721234567
ADMIN_NATIONAL_ID=1199012345678901
ADMIN_PASSWORD=SecurePassword123!

# NIDA API
NIDA_API_URL=https://prod.safaribus.rw/nxreporting/nida

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=1048576
```

#### Generating JWT_SECRET:

**Linux/Mac:**
```bash
openssl rand -base64 32
```

**Windows PowerShell:**
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

**Or use online tool:**
- Visit: https://generate-secret.vercel.app/32

### 3.4 Advanced Settings (Optional)

**Health Check Path:**
- Leave default or set to: `/api/v1/health`

**Auto-Deploy:**
- ✅ **Yes** - Automatically deploy on push to main branch

**Docker:**
- Leave as default (Render auto-detects Node.js)

### 3.5 Deploy

1. Review all settings
2. Click **Create Web Service**
3. Render will start building and deploying your application
4. Watch the build logs for any errors

---

## Step 4: Post-Deployment Setup

### 4.1 Verify Deployment

1. Wait for build to complete (usually 3-5 minutes)
2. Check that service shows **Live** status
3. Visit your service URL: `https://your-app-name.onrender.com`
4. Check Swagger docs: `https://your-app-name.onrender.com/api`

### 4.2 Test Health Endpoint

```bash
curl https://your-app-name.onrender.com/api/v1/health
```

Expected response:
```json
{
  "status": "ok",
  "info": { ... },
  "error": {},
  "details": { ... }
}
```

### 4.3 Test Database Connection

1. Try to register a user or login
2. Check Render logs for any MongoDB connection errors
3. Verify in MongoDB Atlas that collections are being created

### 4.4 Create Admin User

The admin user should be created automatically on first startup using the `ADMIN_*` environment variables.

Test admin login:
```bash
curl -X POST https://your-app-name.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "0721234567",
    "password": "SecurePassword123!"
  }'
```

---

## Step 5: Configure Custom Domain (Optional)

### 5.1 Add Custom Domain

1. Go to your service settings
2. Click **Custom Domains**
3. Add your domain (e.g., `api.starhawk.com`)
4. Follow DNS configuration instructions

### 5.2 Update CORS_ORIGIN

Update `CORS_ORIGIN` environment variable to include your custom domain:
```env
CORS_ORIGIN=https://your-frontend-domain.com,https://api.starhawk.com
```

---

## Troubleshooting

### Build Fails

**Issue**: Build command fails
**Solution**: 
- Check build logs for specific errors
- Ensure all dependencies are in `package.json`
- Verify `npm run build` works locally

### Application Crashes on Startup

**Issue**: Service crashes immediately after deployment
**Solution**:
- Check logs in Render dashboard
- Verify all environment variables are set correctly
- Ensure MongoDB connection string is valid
- Check that PORT is set (Render uses dynamic ports)

### MongoDB Connection Failed

**Issue**: Cannot connect to MongoDB
**Solution**:
- Verify MongoDB Atlas network access allows all IPs (0.0.0.0/0)
- Check connection string format
- Ensure username/password are URL-encoded if they contain special characters
- Check MongoDB Atlas cluster status

### Environment Variables Not Loading

**Issue**: Application can't read environment variables
**Solution**:
- Verify variables are set in Render dashboard (not in `.env` file)
- Check variable names match exactly (case-sensitive)
- Redeploy after adding new variables

### File Uploads Don't Work

**Issue**: File upload endpoints fail
**Solution**:
- Render's free tier has ephemeral filesystem (uploads are lost on restart)
- For production, use cloud storage (AWS S3, Google Cloud Storage, etc.)
- Update upload service to use cloud storage

### Slow Cold Starts

**Issue**: First request after inactivity is slow
**Solution**:
- This is normal on Render free tier (service sleeps after inactivity)
- Upgrade to paid plan for always-on service
- Use a service like UptimeRobot to ping your service every 5 minutes

---

## Production Best Practices

### 1. Upgrade to Paid Plan
- **Starter Plan** ($7/month): Always-on, no cold starts
- **Standard Plan** ($25/month): Better performance, autoscaling

### 2. Use Environment-Specific Configs
- Keep `development` configs separate from `production`
- Use Render's environment variable groups

### 3. Database Security
- Restrict MongoDB Atlas network access to Render's IP ranges
- Use MongoDB Atlas built-in user authentication
- Enable MongoDB Atlas monitoring and alerts

### 4. Monitoring
- Set up Render's built-in monitoring
- Add logging service (Logtail, LogRocket, etc.)
- Monitor MongoDB Atlas metrics

### 5. Backup Strategy
- Enable MongoDB Atlas automated backups
- Set up regular database exports
- Document recovery procedures

### 6. Security
- Use strong JWT secrets (256-bit minimum)
- Rotate secrets periodically
- Enable HTTPS only (Render does this automatically)
- Keep dependencies updated (`npm audit`)

---

## Render Service Limits

### Free Tier Limits:
- ⏱️ Services sleep after 15 minutes of inactivity
- 💾 512 MB RAM
- ⚡ 0.1 CPU share
- 📦 100 GB bandwidth/month

### Paid Tier Benefits:
- ✅ Always-on service
- ✅ More RAM and CPU
- ✅ Auto-scaling
- ✅ Priority support

---

## Quick Reference

### Render Dashboard
- **URL**: https://dashboard.render.com
- **Documentation**: https://render.com/docs

### MongoDB Atlas
- **URL**: https://cloud.mongodb.com
- **Documentation**: https://docs.atlas.mongodb.com

### Environment Variables Template
See `env.template` file in repository

### Useful Commands

**Local build test:**
```bash
npm install
npm run build
npm run start:prod
```

**Check logs remotely:**
```bash
# View in Render dashboard under "Logs" tab
```

---

## Support

For issues:
1. Check Render build/deploy logs
2. Check MongoDB Atlas connection status
3. Verify all environment variables
4. Review this guide's troubleshooting section

For Render-specific issues:
- Render Docs: https://render.com/docs
- Render Support: support@render.com

For MongoDB Atlas issues:
- Atlas Docs: https://docs.atlas.mongodb.com
- MongoDB Support: https://www.mongodb.com/support

---

## Next Steps

After successful deployment:
1. ✅ Test all API endpoints
2. ✅ Verify database connectivity
3. ✅ Set up monitoring
4. ✅ Configure custom domain (if needed)
5. ✅ Document your production URLs
6. ✅ Set up backup strategy
7. ✅ Plan for scaling (if needed)

---

**Last Updated**: November 2025
**Version**: 1.0

