# 🚀 Quick Start Guide

## ✅ Current Status

**All services are running and healthy!**

```
✅ kubelens-app     (port 80)   - Frontend UI
✅ kubelens-server  (port 8080) - Backend API
✅ kubelens-dex     (port 5556) - OAuth2 Provider
```

---

## 🎯 What's New

### 1. Simplified Integration Page ✨

**Before**: Manual service account JSON key input  
**Now**: One-click OAuth2 with Google

**How to use:**
1. Open http://localhost/integrations
2. Click toggle on GCP card
3. Sign in with Google
4. Done! Status shows "Connected"

### 2. GCP Cluster Import 🌐

**Before**: Manual kubeconfig paste  
**Now**: Auto-discover GKE clusters

**How to use:**
1. Enable GCP integration (see above)
2. Go to Cluster Management
3. Click "Import Cluster"
4. Click "From GCP" tab
5. Enter GCP project ID
6. Select clusters
7. Click "Import"

### 3. Helm Chart with Dex ☸️

**Before**: No Helm chart for Dex  
**Now**: Complete sub-chart included

**How to deploy:**
```bash
helm install kubelens ./charts/kubelens \
  --set dex.googleCredentials.clientId=YOUR_ID \
  --set dex.googleCredentials.clientSecret=YOUR_SECRET
```

---

## 🔧 Setup (First Time)

### Step 1: Get Google OAuth2 Credentials

1. Go to https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Add redirect URI: `http://localhost/auth/callback`
4. Copy Client ID and Secret

### Step 2: Configure Environment

```bash
cd kubelensai/kubelens

# Create .env file
cp env.example .env

# Edit with your credentials
nano .env
```

Add:
```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

### Step 3: Restart Services

```bash
docker-compose down
docker-compose up -d

# Verify
docker-compose ps
```

---

## 🧪 Test the Flow

### Test 1: Enable GCP Integration

```bash
# 1. Open Integrations page
open http://localhost/integrations

# 2. Click toggle on GCP card
# → Redirects to Google sign-in

# 3. Sign in with Google
# → Redirects back to /integrations

# 4. Verify
# Toggle: ON
# Status: "Connected"
```

### Test 2: Import GKE Clusters

```bash
# 1. Open Cluster Management
open http://localhost/clusters

# 2. Click "Import Cluster"

# 3. Click "From GCP" tab

# 4. Enter your GCP project ID
# e.g., "my-project-123"

# 5. Wait for clusters to load

# 6. Select clusters to import

# 7. Click "Import X Cluster(s)"

# 8. Verify clusters appear in list
```

---

## 📊 API Endpoints

### New Endpoints:

```bash
# List integrations
curl http://localhost:8080/api/v1/integrations | jq

# Start OAuth2 flow
curl http://localhost:8080/api/v1/integrations/gcp/oauth/start | jq

# List modules
curl http://localhost:8080/api/v1/modules | jq

# List GCP clusters
curl -X POST http://localhost:8080/api/v1/modules/gcp/clusters \
  -H "Content-Type: application/json" \
  -d '{"integration_id": 1, "project_id": "my-project"}' | jq
```

---

## 🐛 Troubleshooting

### Issue: "redirect_uri_mismatch"

**Solution**: Check Google Console redirect URI matches:
```
http://localhost/auth/callback
```

### Issue: "invalid_client"

**Solution**: Check `.env` file has correct credentials:
```bash
cat .env | grep GOOGLE
```

### Issue: Services not starting

**Solution**: Rebuild without cache:
```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### Issue: "From GCP" tab disabled

**Solution**: Enable GCP integration first:
1. Go to /integrations
2. Toggle GCP ON
3. Sign in with Google
4. Go back to Import Cluster modal

---

## 📚 Documentation

- **`OAUTH2_REVIEW_COMPLETE.md`** - Complete review summary
- **`OAUTH2_IMPLEMENTATION.md`** - Technical architecture
- **`OAUTH2_SETUP_GUIDE.md`** - Detailed setup guide
- **`MODULE_ARCHITECTURE.md`** - Module system design

---

## 🎉 Summary

### What You Have Now:

✅ **Simplified UX**: One-click OAuth2 (no more JSON keys)  
✅ **Auto-Discovery**: GKE clusters discovered automatically  
✅ **Batch Import**: Import multiple clusters at once  
✅ **Production-Ready**: Helm chart with Dex included  
✅ **Secure**: OAuth2 with automatic token refresh  
✅ **Extensible**: Easy to add AWS, Azure modules  

### Next Steps:

1. ✅ Get Google OAuth2 credentials
2. ✅ Update `.env` file
3. ✅ Restart services
4. ✅ Test OAuth2 flow
5. ✅ Import GKE clusters

---

**Ready to use!** 🚀

Open http://localhost/integrations and start connecting your GCP account!


