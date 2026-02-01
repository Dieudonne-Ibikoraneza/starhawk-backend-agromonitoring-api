# Deployment Checklist

Use this checklist to ensure successful deployment to Render.com

## Pre-Deployment Checklist

### Repository Setup
- [ ] Code is pushed to GitHub
- [ ] `.gitignore` excludes `.env`, `node_modules`, `dist/`
- [ ] All required files are in repository (`package.json`, `tsconfig.json`, `nest-cli.json`)
- [ ] No sensitive data (passwords, API keys) in repository

### MongoDB Atlas Setup
- [ ] MongoDB Atlas account created
- [ ] Cluster created and running
- [ ] Database user created with read/write permissions
- [ ] Network access configured (Allow from anywhere: 0.0.0.0/0)
- [ ] Connection string copied and formatted correctly

### Environment Variables Prepared
- [ ] `MONGODB_URI` - MongoDB Atlas connection string (with credentials)
- [ ] `JWT_SECRET` - Generated secure base64 secret (256 bits minimum)
- [ ] `EOSDA_API_KEY` - Your EOSDA API key
- [ ] `MAIL_HOST` - SMTP server hostname
- [ ] `MAIL_USER` - SMTP username
- [ ] `MAIL_PASSWORD` - SMTP app password (not regular password)
- [ ] `ADMIN_EMAIL` - Admin user email
- [ ] `ADMIN_PHONE` - Admin user phone
- [ ] `ADMIN_NATIONAL_ID` - Admin user national ID
- [ ] `ADMIN_PASSWORD` - Admin user password (strong password)

### Local Testing
- [ ] Application builds successfully: `npm run build`
- [ ] Application starts successfully: `npm run start:prod`
- [ ] All environment variables tested locally
- [ ] Database connection tested
- [ ] Health endpoint working: `/api/v1/health`

## Render Deployment Checklist

### Service Configuration
- [ ] Service created on Render
- [ ] GitHub repository connected
- [ ] Build Command: `npm install && npm run build`
- [ ] Start Command: `npm run start:prod`
- [ ] Runtime: `Node`
- [ ] Plan selected (Free or Paid)

### Environment Variables
- [ ] All required environment variables added
- [ ] `NODE_ENV` set to `production`
- [ ] `PORT` set to `10000` (Render sets automatically, but good to have default)
- [ ] `MONGODB_URI` set with correct connection string
- [ ] `JWT_SECRET` set with secure secret
- [ ] All API keys configured
- [ ] SMTP settings configured
- [ ] Admin credentials configured (changed from defaults!)

### Deployment
- [ ] Initial deployment triggered
- [ ] Build logs reviewed (no errors)
- [ ] Deployment status: **Live**
- [ ] Service URL accessible

## Post-Deployment Checklist

### Verification
- [ ] Service is accessible: `https://your-app.onrender.com`
- [ ] Health endpoint working: `https://your-app.onrender.com/api/v1/health`
- [ ] Swagger docs accessible: `https://your-app.onrender.com/api`
- [ ] Database connection successful
- [ ] Admin user created (test login)

### Testing
- [ ] Login endpoint working
- [ ] Registration endpoint working
- [ ] Farm creation working (if using EOSDA)
- [ ] Assessment creation working
- [ ] All critical endpoints tested

### Security
- [ ] Admin password changed from default
- [ ] JWT_SECRET is strong and unique
- [ ] MongoDB connection string uses strong credentials
- [ ] CORS_ORIGIN configured correctly
- [ ] No sensitive data in logs

### Monitoring
- [ ] Render logs monitoring configured
- [ ] MongoDB Atlas monitoring enabled
- [ ] Error alerts set up (if available)

### Documentation
- [ ] Production URL documented
- [ ] Environment variables documented
- [ ] Deployment process documented
- [ ] Rollback procedure documented

## Production Best Practices

- [ ] Upgraded to paid plan (avoid cold starts)
- [ ] Custom domain configured (if needed)
- [ ] HTTPS enforced (Render does this automatically)
- [ ] Regular backups configured (MongoDB Atlas)
- [ ] Monitoring and alerts set up
- [ ] Log retention configured
- [ ] Scaling plan documented

## Troubleshooting Reference

### Common Issues
- [ ] Build fails → Check build logs, verify `package.json` scripts
- [ ] Service crashes → Check logs, verify environment variables
- [ ] Database connection fails → Verify MongoDB Atlas network access
- [ ] Environment variables not loading → Check variable names (case-sensitive)
- [ ] File uploads fail → Use cloud storage (Render has ephemeral filesystem)

### Useful Commands

**Local Build Test:**
```bash
npm install
npm run build
npm run start:prod
```

**Check Environment Variables:**
```bash
# In Render dashboard → Environment tab
```

**View Logs:**
```bash
# In Render dashboard → Logs tab
```

## Quick Reference Links

- **Render Dashboard**: https://dashboard.render.com
- **MongoDB Atlas**: https://cloud.mongodb.com
- **Render Docs**: https://render.com/docs
- **MongoDB Atlas Docs**: https://docs.atlas.mongodb.com

---

**Status**: ⬜ Not Started | 🟡 In Progress | ✅ Complete

