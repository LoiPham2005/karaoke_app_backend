# 🎤 Karaoke Backend (NestJS + Prisma)

Backend cho ứng dụng karaoke kiểu "YouTube wrapper" — search bài từ YouTube + lyrics đồng bộ từ LRCLIB.

## 📦 Stack

- **NestJS 10** (TypeScript) — framework
- **Prisma 5** — ORM cho PostgreSQL
- **PostgreSQL 16** — database chính
- **Redis 7** — cache + session
- **JWT + Passport** — authentication
- **Socket.IO** — realtime (queue sync, room hát chung)
- **Swagger** — auto API docs
- **BullMQ** — background jobs
- **class-validator** — DTO validation

## 🚀 Cách chạy project

### Yêu cầu
- Node.js >= 20
- Docker + Docker Compose (cho Postgres + Redis)
- npm hoặc pnpm

### Bước 1: Cài dependencies

```bash
npm install
```

### Bước 2: Setup environment

```bash
cp .env.example .env
```

Mở file `.env` và điền các giá trị:
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`: chuỗi ngẫu nhiên >= 32 ký tự
- `YOUTUBE_API_KEY`: lấy ở [Google Cloud Console](https://console.cloud.google.com) → Enable YouTube Data API v3
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: tạo OAuth credentials (nếu cần login Google)

### Bước 3: Khởi động Postgres + Redis (Docker)

```bash
docker compose up -d
```

Kiểm tra:
- Postgres: `localhost:5432` (user: `karaoke`, pass: `karaoke`, db: `karaoke_db`)
- Redis: `localhost:6379`
- pgAdmin: `http://localhost:5050` (admin@karaoke.local / admin)

### Bước 4: Chạy Prisma migration

```bash
npm run prisma:generate
npm run prisma:migrate
```

### Bước 5: Seed dữ liệu mẫu

```bash
npm run prisma:seed
```

Tài khoản demo sau khi seed:
- Admin: `admin@karaoke.local` / `Admin@12345`
- User: `demo@karaoke.local` / `User@12345`

### Bước 6: Chạy server

```bash
npm run start:dev
```

Mở các URL sau:
- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/docs`

## 📁 Cấu trúc thư mục

```
backend/
├── prisma/
│   ├── schema.prisma       # Database schema
│   ├── migrations/         # Migration files
│   └── seed.ts             # Seed data
├── src/
│   ├── main.ts             # Entry point
│   ├── app.module.ts       # Root module
│   ├── common/             # Decorators, guards, filters, interceptors
│   ├── config/             # Env config + validation
│   ├── prisma/             # PrismaService (global)
│   ├── redis/              # RedisService (global)
│   └── modules/            # Các module nghiệp vụ
│       ├── auth/
│       ├── users/
│       ├── songs/
│       ├── lyrics/
│       ├── playlists/
│       ├── queue/
│       ├── favorites/
│       ├── history/
│       ├── reports/
│       └── admin/
├── docker-compose.yml
├── .env.example
└── package.json
```

## 🛠️ Scripts hữu ích

| Lệnh | Mô tả |
|------|-------|
| `npm run start:dev` | Chạy dev mode (watch) |
| `npm run build` | Build production |
| `npm run start:prod` | Chạy production |
| `npm run lint` | Lint code |
| `npm run format` | Format Prettier |
| `npm test` | Chạy unit test |
| `npm run test:e2e` | Chạy e2e test |
| `npm run prisma:migrate` | Tạo migration mới (dev) |
| `npm run prisma:studio` | Mở Prisma Studio (GUI DB) |
| `npm run db:reset` | Reset DB (xóa hết + migrate + seed lại) |

## 📚 Roadmap module (theo PLAN.md)

- [x] Setup project + Prisma + Postgres + Redis
- [ ] **AuthModule** — register/login/JWT/Google OAuth
- [ ] **UsersModule** — profile, đổi mật khẩu
- [ ] **SongsModule** — search YouTube + cache
- [ ] **LyricsModule** — lấy LRC từ LRCLIB
- [ ] **PlaylistsModule** — CRUD playlist
- [ ] **QueueModule** — hàng chờ phát
- [ ] **FavoritesModule** — yêu thích
- [ ] **HistoryModule** — lịch sử
- [ ] **ReportsModule** — báo cáo bài lỗi
- [ ] **AdminModule** — dashboard, duyệt nội dung
- [ ] **WebSocket Gateway** — sync realtime

Xem chi tiết kế hoạch tại [../PLAN.md](../PLAN.md).

## 🔐 Bảo mật

- Mật khẩu hash bằng **Argon2** (mạnh hơn bcrypt)
- JWT access token TTL ngắn (15m), refresh token TTL dài (7d) + revoke được
- Helmet headers + CORS strict
- Rate limit toàn cục (Throttler)
- Validation chặt với class-validator
- Không log thông tin nhạy cảm

## 📝 Quy ước code

- Mỗi feature = 1 module: `module.ts`, `controller.ts`, `service.ts`, `dto/`
- DTO dùng `class-validator` + `@ApiProperty` cho Swagger
- Service trả về domain object, không expose Prisma model trực tiếp ra controller
- Mọi endpoint có Swagger annotation
- Test unit cho service, e2e cho flow chính

## 🪪 License

MIT
