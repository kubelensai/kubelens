# Kubelens Deployment Guide

Kubelens hỗ trợ **3 chế độ triển khai** khác nhau, tùy thuộc vào nền tảng và nhu cầu:

## 📊 So sánh các chế độ

| Feature | Web (Dev) | Web (Production) | Mobile (Capacitor) |
|---------|-----------|------------------|-------------------|
| **Platform** | Local development | Docker/Kubernetes | Android/iOS |
| **Proxy** | Vite dev server | Node.js Express | ❌ No proxy |
| **API Calls** | `/api/v1` (proxy) | `/api/v1` (proxy) | Direct to server URL |
| **Configuration** | Dev only | Runtime env vars | Build-time env vars |
| **Build** | `npm run dev` | `npm run build` | `npm run build:mobile` |
| **Server Required** | Go backend | Go backend | Go backend |

---

## 🌐 1. Web Development (Local)

### Cách hoạt động:
```
Browser → Vite Dev Server (5173) → Proxy → Backend Server (8080)
```

### Setup:

```bash
# Terminal 1: Start backend
cd src/server
go run cmd/server/main.go

# Terminal 2: Start frontend
cd src/app
npm install
npm run dev

# Access: http://localhost:5173
```

### Đặc điểm:
- ✅ Hot reload
- ✅ Vite proxy tự động forward `/api/*` → `http://localhost:8080`
- ✅ Phù hợp cho development

---

## 🐳 2. Web Production (Docker/Kubernetes)

### Cách hoạt động:
```
Browser → App Container (80) → Express Proxy → Server Container (8080)
```

### Setup với Docker Compose:

```bash
cd docker
docker-compose up -d

# Access: http://localhost:80
```

### Setup với Kubernetes (Helm):

```bash
# Install
helm install kubelens ./charts/kubelens

# With custom API server
helm install kubelens ./charts/kubelens \
  --set app.env.apiServer=http://my-backend:8080
```

### Đặc điểm:
- ✅ Node.js Express server làm proxy
- ✅ Environment variables runtime
- ✅ WebSocket support
- ✅ Production ready

### Environment Variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `80` | App server port |
| `API_SERVER` | `http://server:8080` | Backend API URL |
| `NODE_ENV` | `production` | Node environment |

---

## 📱 3. Mobile (Capacitor)

### Cách hoạt động:
```
Mobile App → Direct HTTP(S) → Backend Server API
```

### Setup:

#### Bước 1: Cấu hình API Server URL

Tạo file `.env.mobile`:

```bash
cd src/app

# For local testing (use your computer's LAN IP)
echo 'VITE_API_SERVER_URL=http://192.168.1.100:8080' > .env.mobile

# For production (use your actual API domain)
# echo 'VITE_API_SERVER_URL=https://api.kubelens.app' > .env.mobile
```

#### Bước 2: Install dependencies

```bash
npm install
```

#### Bước 3: Build & Deploy

**Cho Android:**
```bash
# Build mobile version
npm run build:mobile

# Add Android platform (first time only)
npm run cap:add:android

# Sync and open in Android Studio
npm run mobile:android

# In Android Studio:
# Build → Build Bundle(s) / APK(s) → Build APK(s)
```

**Cho iOS:**
```bash
# Build mobile version
npm run build:mobile

# Add iOS platform (first time only)
npm run cap:add:ios

# Sync and open in Xcode
npm run mobile:ios

# In Xcode:
# Product → Archive → Distribute App
```

### Đặc điểm:
- ✅ Pure static files (HTML/CSS/JS)
- ✅ Không cần Node.js server
- ✅ API URL configured tại build time
- ✅ Build thành APK (Android) hoặc IPA (iOS)
- ⚠️ Cần rebuild khi đổi API URL

### Chi tiết đầy đủ:
Xem **[src/app/MOBILE.md](src/app/MOBILE.md)** để biết hướng dẫn chi tiết.

---

## 🔄 Architecture Flow

### Web Mode (Production):

```
┌─────────┐      ┌──────────────┐      ┌──────────────┐
│ Browser │─────▶│ App (Nginx)  │─────▶│ Server (Go)  │
│         │      │ Port 80      │      │ Port 8080    │
│         │      │ + Proxy      │      │              │
└─────────┘      └──────────────┘      └──────────────┘
    ▲                    │                     │
    │                    │                     │
    └────────────────────┴─────────────────────┘
           HTTP Response (JSON/HTML)
```

### Mobile Mode:

```
┌──────────────┐                    ┌──────────────┐
│ Mobile App   │───────────────────▶│ Server (Go)  │
│ (Capacitor)  │  Direct HTTPS      │ API Server   │
│              │                    │              │
└──────────────┘                    └──────────────┘
     Static                             Remote
     Files                              8080/443
```

---

## 🚀 Quick Start Commands

### Development:
```bash
# Backend
cd src/server && go run cmd/server/main.go

# Frontend
cd src/app && npm run dev
```

### Production Web (Docker):
```bash
cd docker && docker-compose up -d
```

### Production Web (Kubernetes):
```bash
helm install kubelens ./charts/kubelens
```

### Mobile (Android):
```bash
cd src/app
npm run build:mobile
npm run mobile:android
```

### Mobile (iOS):
```bash
cd src/app
npm run build:mobile
npm run mobile:ios
```

---

## ⚙️ Configuration Summary

### Web Development:
- File: `src/app/vite.config.ts`
- Proxy: `http://localhost:8080`

### Web Production:
- File: `docker/app/Dockerfile`, `charts/kubelens/charts/app/values.yaml`
- Environment: `API_SERVER=http://server:8080`

### Mobile:
- File: `src/app/.env.mobile`
- Build-time: `VITE_API_SERVER_URL=https://api.kubelens.app`

---

## 🔍 Troubleshooting

### Web: "Cannot connect to API"
1. Check backend is running: `curl http://localhost:8080/health`
2. Check proxy config in `vite.config.ts` or `server.js`
3. Check CORS settings on backend

### Mobile: "Network request failed"
1. Verify `.env.mobile` has correct `VITE_API_SERVER_URL`
2. Use LAN IP for local testing (not `localhost`)
3. Check backend server is accessible from mobile device
4. Verify HTTPS certificate is valid (production)

### Docker: "App not loading"
1. Check containers: `docker-compose ps`
2. Check logs: `docker-compose logs app`
3. Verify environment variables: `docker-compose config`

---

## 📚 Additional Resources

- **Web Development**: [src/app/README.md](src/app/README.md)
- **Mobile Build**: [src/app/MOBILE.md](src/app/MOBILE.md)
- **Backend Server**: [src/server/README.md](src/server/README.md)
- **Helm Charts**: [charts/kubelens/README.md](charts/kubelens/README.md)

---

## 💡 Best Practices

1. **Development**: Dùng `npm run dev` với Vite proxy
2. **Production Web**: Deploy qua Docker hoặc Kubernetes
3. **Mobile**: Build với `.env.mobile`, test trên thiết bị thật
4. **Security**: Luôn dùng HTTPS cho production và mobile
5. **Testing**: Test trên nhiều devices và screen sizes
6. **Updates**: Maintain backward compatibility cho mobile apps cũ

---

**Lưu ý**: Nếu bạn thay đổi cách hoạt động của API, cần:
- ✅ Update web app (deploy ngay)
- ✅ Rebuild mobile app
- ⏰ Submit lên App Store/Play Store (review có thể mất vài ngày/tuần)
- 👥 Users phải update app manually

