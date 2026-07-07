# 📺 Quảng cáo (Ads) — Tài liệu & Bảng DB (để dành tích hợp sau)

> **Trạng thái: ĐÃ TẠM GỠ khỏi `schema.prisma`.** Hiện app chưa bật ads.
> Khi nào muốn tích hợp ads → đọc file này, **paste lại các bảng bên dưới** vào `schema.prisma`, rồi `npx prisma db push` (hoặc tạo migration).
>
> Ngày tạo: 2026-06-17 · Áp dụng cho: **B2C** (app người dùng web + mobile). B2B (tiệm) thường KHÔNG hiện ads.

---

## 1. Mô hình doanh thu ads (tóm tắt)

Tiền ads tính theo **eCPM = doanh thu / 1.000 lượt hiển thị** (không tính lẻ từng lượt).

| Loại ads | eCPM ở VN (ước lượng) | ≈ mỗi lượt | Khi nào dùng |
|---|---|---|---|
| **Rewarded** (xem để nhận thưởng) | ~75.000 – 250.000đ | ~75–250đ | 💰 Cao nhất. "Xem 1 ad để hát thêm / mở khoá tính năng" |
| **Interstitial** (full màn) | ~12.000 – 75.000đ | ~12–75đ | Giữa các bài, sau N lần hành động (tần suất vừa phải) |
| **Native** (chèn trong list) | giữa banner ↔ interstitial | | Chèn vào danh sách kết quả search / trending |
| **Banner** (dải nhỏ) | ~1.250 – 12.500đ | ~1–12đ | Thấp nhất, để phụ. Dưới mini-player / cuối list |

**Ghi nhớ:**
- VN là thị trường eCPM **thấp** → cần **scale lớn** (chục nghìn+ DAU) ads mới đáng kể.
- Click (CPC) trả cao hơn nhưng tỉ lệ click chỉ ~0.5–2%.
- Yếu tố ảnh hưởng: vùng (VN thấp), **fill rate**, mùa (Q4/Tết cao), độ tương tác, nhu cầu nhà QC.

### ⚠️ 2 điều TỐI QUAN TRỌNG với app "YouTube-wrapper"
1. **Quảng cáo CHẠY BÊN TRONG video YouTube = tiền của YouTube/chủ kênh, KHÔNG phải của bạn.**
   Tiền ads của bạn = **các đơn vị AdMob/AdSense bạn TỰ đặt trong UI app** (banner/interstitial/rewarded ở màn search, giữa bài…). Đừng nhầm 2 cái này.
2. iOS cần **App Tracking Transparency (ATT)** xin phép trước khi cá nhân hoá ads (đã có dep `app_tracking_transparency` ở mobile).

---

## 2. Bảng DB cần thêm lại (PASTE-READY)

Khi tích hợp ads, dán lại các khối Prisma sau vào `schema.prisma`.

### 2.1. `AdConfig` — cấu hình bật/tắt + tần suất ads (KV)
```prisma
// Cấu hình quảng cáo B2C (bật/tắt + tần suất). KHÔNG lưu từng impression (dùng
// analytics ngoài). shopId null = global; có = override theo tiệm.
model AdConfig {
  id        String   @id @default(cuid())
  key       String // "interstitial_enabled", "ad_frequency_songs"...
  value     String // parse ở app (vd "true" / "3")
  shopId    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  shop Shop? @relation(fields: [shopId], references: [id], onDelete: Cascade)

  @@unique([shopId, key])
  @@index([shopId])
}
```
**Và** thêm lại dòng quan hệ vào model `Shop` (khối relations):
```prisma
  adConfigs     AdConfig[]
```

### 2.2. (TUỲ CHỌN) `AdEvent` — đo lường tối giản
> ⚠️ KHÔNG khuyến nghị lưu **từng impression** vào Postgres ở production (hàng triệu dòng → phình DB). Ưu tiên analytics ngoài (Firebase Analytics / AdMob report). Chỉ thêm nếu cần debug/đối soát thủ công.
```prisma
model AdEvent {
  id        String   @id @default(cuid())
  userId    String? // null nếu khách chưa đăng nhập
  placement String // "before_song", "queue_banner", "rewarded_extra"...
  type      String // "impression" | "click" | "reward_granted"
  createdAt DateTime @default(now())

  @@index([placement, createdAt])
  @@index([userId])
}
```

### 2.3. Đã CÓ SẴN trong schema (không cần thêm) — liên quan ads
| Thành phần | Vai trò |
|---|---|
| `User.isPremium` + `User.premiumUntil` | Premium = **ẩn toàn bộ ads** |
| enum `UserPlan { FREE, PREMIUM_MONTHLY, PREMIUM_YEARLY }` | `FREE` = có ads; `PREMIUM_*` = không ads |
| `AnnouncementAudience.FREE` | Target user free để up-sell Premium ("Nâng cấp để bỏ ads") |
| `Subscription` / `Payment` | Bán gói Premium (bỏ ads) |

→ Logic chặn ads: **nếu `user.isPremium && premiumUntil > now` → KHÔNG hiện ads.**

---

## 3. Chiến lược đặt ads (placement) cho app karaoke

| Vị trí | Format gợi ý | Ghi chú |
|---|---|---|
| Giữa các bài hát (sau khi hát xong 1 bài) | **Interstitial** | Tần suất: mỗi 2–3 bài (đừng spam) |
| "Hát thêm / mở khoá chất lượng cao / bỏ giới hạn" | **Rewarded** | Doanh thu cao nhất + UX thiện cảm (user tự chọn xem) |
| Danh sách kết quả search / trending | **Native** (chèn mỗi 6–8 item) | Hoà vào list, ít khó chịu |
| Dưới mini-player / cuối màn | **Banner** | Phụ, eCPM thấp |
| Splash / mở app | **App Open ad** (tần suất thấp) | Cẩn thận, dễ gây khó chịu |

**Nguyên tắc UX:** ưu tiên Rewarded + Interstitial tần suất hợp lý; tránh ép ads liên tục (rớt retention → giảm cả ads lẫn premium).

---

## 4. Catalog `AdConfig.key` gợi ý

| key | value mẫu | Ý nghĩa |
|---|---|---|
| `ads_enabled` | `"true"` | Công tắc tổng bật/tắt ads |
| `interstitial_enabled` | `"true"` | Bật interstitial |
| `interstitial_frequency_songs` | `"3"` | Cứ 3 bài hiện 1 interstitial |
| `rewarded_enabled` | `"true"` | Bật rewarded |
| `banner_enabled` | `"false"` | Bật/tắt banner |
| `app_open_enabled` | `"false"` | Bật App Open ad |
| `native_every_n_items` | `"7"` | Chèn native mỗi 7 item list |

→ Đọc config này lúc app khởi động (cache) để bật/tắt + chỉnh tần suất **không cần update app**.

---

## 5. Tích hợp kỹ thuật (khi bật ads)

### Mobile (Flutter) — đã có sẵn hạ tầng
- Dep: **`google_mobile_ads`** (AdMob) + **`app_tracking_transparency`** (ATT iOS) đã có trong `mobilev2/pubspec.yaml`.
- Module: `mobilev2/lib/modules/ads/` (AdMob handlers banner/interstitial/rewarded) — kế thừa từ flutter_base2, **chỉ cần bật + cắm ad unit id**.
- Bước: tạo app trên **AdMob Console** → lấy `App ID` + `Ad Unit IDs` → đặt vào config theo flavor → wrap chỗ hiện ads + check `isPremium`.

### Web (Next.js)
- **Google AdSense** (cần duyệt site) hoặc Google Ad Manager. Đặt `<ins class="adsbygoogle">` ở các placement.
- Check `isPremium` trước khi render slot ads.

### Backend
- Endpoint `GET /ad-config` (public) trả các `AdConfig` (global) → app đọc để bật/tắt + tần suất.
- (Nếu dùng `AdEvent`) endpoint `POST /ad-event` ghi nhận — nhưng ưu tiên Firebase Analytics.

---

## 6. Checklist bật ads sau này
- [ ] Paste lại `model AdConfig` + `Shop.adConfigs` (và `AdEvent` nếu cần) vào `schema.prisma`
- [ ] `npx prisma format && npx prisma validate && npx prisma db push`
- [ ] Seed vài `AdConfig` mặc định (`ads_enabled=false` ban đầu để tắt an toàn)
- [ ] Backend: endpoint `GET /ad-config`
- [ ] Mobile: bật module `modules/ads`, cắm AdMob ad unit id theo flavor, check `isPremium`
- [ ] Web: tích hợp AdSense, check `isPremium`
- [ ] iOS: xin ATT trước khi load ads cá nhân hoá
- [ ] Đặt placement theo mục 3, tần suất qua `AdConfig`
- [ ] Test: user Premium KHÔNG thấy ads

---

## 7. Liên hệ chiến lược doanh thu
- **Ads cần scale lớn** mới đáng kể (VN eCPM thấp) → đừng kỳ vọng tiền sớm khi ít user.
- **Premium (bỏ ads)** thường ra tiền/đầu user tốt hơn ads thuần.
- **B2B (bán cho tiệm)** ra tiền chắc & nhanh hơn nhiều B2C ads — ưu tiên nếu cần doanh thu sớm.
- Kết hợp tối ưu B2C: **Rewarded + Interstitial (tần suất vừa) + bán Premium**, Banner để phụ.
