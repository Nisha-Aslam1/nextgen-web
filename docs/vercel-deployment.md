# Vercel + Supabase Deployment

Use this project on Vercel when you want Supabase keys to be managed through Vercel Environment Variables or the official Supabase Integration.

## 1. Install Supabase integration in Vercel

1. Open Vercel Dashboard.
2. Open your project, or import this repository as a new project.
3. Go to **Integrations** and install/connect **Supabase**.
4. Select the same Supabase project used for this website.
5. Let Vercel add the Supabase environment variables to the project.

The code accepts these names:

- `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, or `SUPABASE_SERVICE_KEY`

If the integration does not add a privileged secret key automatically, add it manually from Supabase **Project Settings → API Keys → Secret keys**.

## 2. Add admin variables in Vercel

In **Vercel Project → Settings → Environment Variables**, add:

```env
ADMIN_USERNAME=your-admin-username
ADMIN_PASSWORD=your-strong-admin-password
SESSION_SECRET=generate-a-long-random-secret
```

Use `openssl rand -hex 32` to generate `SESSION_SECRET`.

## 3. Run Supabase SQL

In Supabase, open **SQL Editor** and run the full contents of `docs/supabase-setup.sql`.

## 4. Deploy

Deploy the project on Vercel. Public form submissions go to `/api/submit-application`, and the admin panel is available at `/admin/`.

## 5. Test

1. Submit the public form with a payment screenshot.
2. Confirm the row appears in Supabase `applications`.
3. Confirm the file appears in private Storage bucket `application-files`.
4. Open `/admin/`, log in, view the application, preview the uploaded file, change status, edit, and delete.
