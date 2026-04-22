# Packet Opt Control Tower

Ứng dụng React + Three.js để mô phỏng xếp hàng vào container, review phương án load planning và dựng dashboard thương mại để demo như một phần mềm vận hành thật.

## Những gì đã có

- Dựng container 3D và preview item theo danh sách SKU.
- Chạy `AI Cơ bản`, `AI Pro` và heuristic `Sắp xếp tối ưu`.
- Kiểm tra tải trọng, `noStack`, `noTilt`, xoay hướng, tải sàn, cân bằng tải, `deliveryZone`, `stackLimit`, `maxLoadAbove`.
- Chỉnh tay box trong scene, undo/redo, lưu và khôi phục scene.
- Tính sức chứa, dựng layout từ sức chứa và hiển thị chống sốc.
- Nạp preset demo, nhập manifest hàng loạt từ CSV/JSON, xuất JSON và nhập lại phương án.
- Có `Commercial Control` để khai báo shipment, SLA, giá trị lô hàng, cước container và target vận hành.
- Có `Preflight` để audit manifest trước khi pack.
- `AI Pro` và `Tối ưu` chạy nền bằng worker để UI không bị đứng trong lúc heuristic xử lý.
- Xuất báo cáo HTML kiểu executive/report bàn giao cho đội vận hành hoặc khách hàng review.
- Có bảng `Tóm tắt vận hành` để đọc nhanh KPI của phương án hiện tại.
- Có `Cloud Workspace` với `Supabase Auth` bằng magic link và lưu/nạp snapshot phương án từ cloud.
- Có `CRM & Report Ops` để capture lead, gửi executive report qua email và log workflow thương mại.
- Có `CI` + `Cloudflare Pages auto deploy` bằng GitHub Actions.
- Public assets (`robots`, `sitemap`, `security.txt`) được đồng bộ theo `VITE_PUBLIC_APP_URL` khi build.

## Chạy local

```bash
npm install
npm run dev
```

Build production:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

Release env check:

```bash
npm run release:check-env
```

Sync GitHub Actions secrets + variables:

```bash
npm run github:sync-actions-config
```

Bootstrap full release config:

```bash
npm run release:bootstrap-config
```

E2E release check:

```bash
npm run test:e2e
```

Đồng bộ asset public theo domain hiện tại:

```bash
npm run prepare:public
```

Preview trên Cloudflare Pages local:

```bash
npm run preview:cloudflare
```

Nếu muốn chạy local với đúng runtime env của Pages Functions:

```bash
copy .dev.vars.example .dev.vars
npm run build
npx wrangler pages dev dist --env-file .dev.vars
```

## Luồng demo nhanh

1. Chọn một preset trong `MVP Hub`.
2. Bấm `Nạp preset`.
3. Chạy `Preflight` để audit manifest và readiness.
4. Chạy `AI Pro` hoặc `Sắp xếp tối ưu`.
5. Xem KPI trong `Tóm tắt vận hành` và `Commercial Control`.
6. Nếu có dữ liệu thực, dán `manifest CSV / JSON` rồi bấm `Áp manifest`.
7. Xuất `JSON` hoặc `report HTML` nếu muốn chia sẻ hoặc lưu lại phương án.

## Manifest mẫu

App hỗ trợ thêm các cột:

```csv
label,w,h,d,weight,qty,allowRotate,noStack,noTilt,priorityGroup,deliveryZone,stackLimit,maxLoadAbove
TV 43 inch,68,14,108,15,36,true,true,true,3,door,1,0
Soundbar,18,16,105,8,28,true,false,true,2,middle,2,24
```

## Free server đã chốt

Repo này hiện đã được chuẩn bị theo hướng `Cloudflare Pages`:

- Static frontend chạy từ `dist`.
- Có `Pages Functions` miễn phí tại:
  - `GET /api/status`
  - `POST /api/preflight`
- Có sẵn `wrangler.toml`, `site.webmanifest`, `robots.txt`, `security.txt`, `_headers`.

Deploy nhanh:

```bash
npm install
npm run build
npx wrangler login
npm run cloudflare:sync-secrets -- --project-name packet-opt-control-tower
npm run deploy:cloudflare
```

Sau khi tạo project lần đầu trên Cloudflare Pages, có thể gắn custom domain riêng để chạy như bản public thương mại.

## Stack thương mại đã nối

- Hosting + serverless: `Cloudflare Pages` + `Pages Functions`
- Auth + cloud save: `Supabase Auth` + bảng `saved_plans`
- CRM logging: bảng `crm_leads`
- Email workflow: `Resend`
- CI/CD: `GitHub Actions`

## Env cần có

Sao chép `.env.example` và điền:

```bash
VITE_PUBLIC_APP_URL=https://app.your-domain.com
PUBLIC_APP_URL=https://app.your-domain.com
ALLOWED_ORIGINS=https://app.your-domain.com
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=...
PUBLIC_SECURITY_CONTACT=mailto:security@your-domain.com
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
RESEND_FROM_EMAIL=Packet Opt <noreply@your-domain.com>
CRM_RECIPIENT_EMAIL=salesops@your-domain.com
```

Ghi chú:

- `VITE_*` được dùng ở frontend/browser.
- `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CRM_RECIPIENT_EMAIL` chỉ để ở Cloudflare Pages secrets/env vars.
- `VITE_PUBLIC_APP_URL` là URL public chính thức để build `robots.txt`, `sitemap.xml` và làm redirect cho magic link auth.
- `PUBLIC_APP_URL` hoặc `ALLOWED_ORIGINS` dùng để khóa origin cho các Pages Functions ở bản phát hành.
- `npm run release:check-env -- --strict` sẽ fail nếu thiếu config cần cho full release MVP.
- Copy `.dev.vars.example` thành `.dev.vars` nếu muốn `wrangler pages dev` đọc đúng runtime secrets local.

## Supabase setup

1. Tạo project Supabase.
2. Bật `Email OTP / Magic Link` trong `Authentication`.
3. Thêm `Site URL` và `Redirect URLs` trùng với `VITE_PUBLIC_APP_URL`.
4. Chạy SQL trong `supabase/schema.sql`.
5. Lấy `Project URL`, `Anon Key`, `Service Role Key` để điền env.

Các bảng chính:

- `saved_plans`: người dùng đã login tự đọc/ghi plan của chính họ bằng RLS.
- `crm_leads`: API serverless ghi lead nội bộ.
- `report_deliveries`: log mỗi lần gửi executive report.

## CRM và email workflow

Endpoint mới:

- `POST /api/leads`
- `POST /api/report-email`

Luồng hiện tại:

1. User điền lead trong `CRM & Report Ops`.
2. API ghi lead vào `crm_leads` nếu có `SUPABASE_SERVICE_ROLE_KEY`.
3. API gửi email notify tới `CRM_RECIPIENT_EMAIL` nếu có `Resend`.
4. User có thể gửi executive report HTML hiện tại tới email đích.
5. Mỗi lần gửi report sẽ được log vào `report_deliveries` nếu Supabase service đã bật.

## CI và auto deploy

Repo có sẵn:

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-cloudflare.yml`

Secrets cần thêm trên GitHub:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `VITE_PUBLIC_APP_URL`
- `PUBLIC_APP_URL`
- `ALLOWED_ORIGINS`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `PUBLIC_SECURITY_CONTACT`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `CRM_RECIPIENT_EMAIL`

Repo variables nên thêm trên GitHub:

- `CLOUDFLARE_PAGES_PROJECT_NAME`
- `CLOUDFLARE_PAGES_BRANCH`

Workflow deploy hiện tự sync runtime secrets từ GitHub sang Cloudflare Pages trước khi deploy bằng:

```bash
npm run cloudflare:sync-secrets -- --project-name packet-opt-control-tower
```

Để sync cả GitHub Actions config lẫn Cloudflare runtime secrets từ local env files:

```bash
npm run release:bootstrap-config -- --repo Rindio2/my-team-project --project-name packet-opt-control-tower
```

Mapping runtime hiện tại:

- `PUBLIC_APP_URL` -> `PUBLIC_APP_URL`
- `ALLOWED_ORIGINS` -> `ALLOWED_ORIGINS`
- `PUBLIC_SECURITY_CONTACT` -> `PUBLIC_SECURITY_CONTACT`
- `SUPABASE_URL` -> `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` -> `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY` -> `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` -> `RESEND_FROM_EMAIL`
- `CRM_RECIPIENT_EMAIL` -> `CRM_RECIPIENT_EMAIL`

Nếu không set `ALLOWED_ORIGINS`, script sync sẽ fallback sang `PUBLIC_APP_URL`.

## Release MVP gate

Từ vòng hardening này, app có thêm gate phát hành:

- Frontend tự đọc `GET /api/status` để biết CRM/report capability nào đang mở.
- Nếu backend chưa đủ env, các nút `CRM` và `Executive report` sẽ bị khóa ngay từ UI thay vì để người dùng bấm rồi fail.
- Pages Functions chỉ nhận `POST` từ origin hợp lệ theo `PUBLIC_APP_URL` hoặc `ALLOWED_ORIGINS`.
- Workflow deploy không còn phụ thuộc side effect từ `test:e2e`; nó build artifact riêng và sync runtime secrets trước khi đẩy lên Pages.
- Có thêm checklist phát hành ở [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md).

## Custom domain

Repo này đã sẵn cho custom domain, nhưng bước bind domain thật vẫn phải làm trên tài khoản Cloudflare của bạn:

1. Tạo hoặc deploy project `packet-opt-control-tower` lên Pages.
2. Vào `Custom domains` trong Cloudflare Pages.
3. Add domain/subdomain muốn dùng, ví dụ `app.your-domain.com`.
4. Cập nhật `VITE_PUBLIC_APP_URL` trên local và trong GitHub secrets thành domain mới đó.
5. Chạy lại build/deploy để `robots.txt`, `sitemap.xml`, `security.txt` và magic link redirect dùng đúng domain.

## API mẫu

`POST /api/preflight`

```json
{
  "container": { "w": 235, "h": 269, "d": 1203 },
  "maxWeight": 29500,
  "floorLoadLimit": 1650,
  "settings": {
    "projectName": "Spring Launch",
    "customerName": "Pacific Retail Group",
    "routeName": "Ho Chi Minh City -> Los Angeles",
    "serviceLevel": "priority"
  },
  "items": [
    {
      "label": "TV 43 inch",
      "w": 68,
      "h": 14,
      "d": 108,
      "weight": 15,
      "qty": 36,
      "allowRotate": true,
      "noStack": true,
      "noTilt": true,
      "priorityGroup": 3,
      "deliveryZone": "door",
      "stackLimit": 1,
      "maxLoadAbove": 0
    }
  ]
}
```
