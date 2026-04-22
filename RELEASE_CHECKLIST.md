# Release Checklist

## 1. Env và secrets

- Copy `.env.example` thành `.env.local` khi chạy local.
- Copy `.dev.vars.example` thành `.dev.vars` nếu muốn chạy `wrangler pages dev`.
- Giữ `VITE_DEPLOYMENT_MODE=free` cho bản thi miễn phí.
- Điền tối thiểu:
  - `VITE_DEPLOYMENT_MODE`
  - `VITE_PUBLIC_APP_URL`
  - `PUBLIC_APP_URL`
  - `ALLOWED_ORIGINS`
  - `PUBLIC_SECURITY_CONTACT`
- Chỉ điền thêm nếu muốn chuyển sang `managed` và mở cloud/email/CRM:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`
  - `CRM_RECIPIENT_EMAIL`
- Chạy `npm run release:check-env -- --strict` trước khi chốt bản phát hành.
  - `free`: chỉ bắt buộc core env
  - `managed`: bắt buộc thêm Supabase + Resend + CRM env
- Nếu muốn đẩy secrets/variables tự động từ máy local:
  - `npm run release:bootstrap-config -- --repo Rindio2/my-team-project --project-name packet-opt-control-tower`

## 2. Backend và security gate

- Đảm bảo Cloudflare Pages Functions có `PUBLIC_APP_URL` hoặc `ALLOWED_ORIGINS`.
- Xác nhận `GET /api/status` trả về:
  - `status = ok`
  - `version = release-mvp`
  - `release.ready = true`
- Xác nhận các API `POST` chặn origin ngoài domain phát hành.

## 3. Supabase

- Bỏ qua toàn bộ mục này nếu đang phát hành bản thi `free mode`.
- Bật magic link trong Supabase Auth.
- `Site URL` và `Redirect URLs` phải trùng với `VITE_PUBLIC_APP_URL`.
- Chạy `supabase/schema.sql`.
- Kiểm tra RLS cho `saved_plans`.

## 4. CRM và email

- Bỏ qua toàn bộ mục này nếu đang phát hành bản thi `free mode`.
- Kiểm tra `CRM_RECIPIENT_EMAIL` là mailbox thật của sales/ops.
- Gửi thử một executive report từ môi trường staging.
- Xác minh `crm_leads` và `report_deliveries` ghi log đúng.

## 5. Kiểm tra kỹ thuật trước phát hành

- `npm run lint`
- `npm run smoke`
- `npm run test:e2e`
- `npm run build`

## 6. Deploy

- Kiểm tra GitHub secrets:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
  - `VITE_DEPLOYMENT_MODE` không cần là secret; repo đang mặc định `free` trong workflow
  - `VITE_PUBLIC_APP_URL`
  - `PUBLIC_APP_URL`
  - `ALLOWED_ORIGINS`
  - `PUBLIC_SECURITY_CONTACT`
- Chỉ cần GitHub runtime capability secrets nếu chuyển sang `managed`:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`
  - `CRM_RECIPIENT_EMAIL`
- Kiểm tra GitHub repo variables:
  - `CLOUDFLARE_PAGES_PROJECT_NAME`
  - `CLOUDFLARE_PAGES_BRANCH`
- Nếu cần sync tay sang Pages trước khi deploy, chạy:
  - `npm run cloudflare:sync-secrets -- --project-name packet-opt-control-tower`
- Nếu cần sync tay GitHub Actions secrets/variables, chạy:
  - `npm run github:sync-actions-config -- --repo Rindio2/my-team-project`
- Chạy workflow deploy hoặc `npm run deploy:cloudflare`.

## 7. Sau deploy

- Mở `/api/status` trên domain public.
- Mở app public và kiểm tra:
  - `AI Pro`, `Tối ưu`, `Preflight`, `Save scene`, `Load scene`, `Export JSON`, `Export HTML` dùng được
  - cloud auth đang bị khóa đúng nếu phát hành ở `free mode`
  - lead capture và executive report đang bị khóa đúng nếu phát hành ở `free mode`
- Kiểm tra `robots.txt`, `sitemap.xml`, `/.well-known/security.txt`.
