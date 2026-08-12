const { Client } = require('pg');
const { BUCKET } = require('./config');

let setupPromise;

function postgresUrl() {
  return process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
}

function postgresConnectionConfig() {
  const connectionString = postgresUrl();
  if (!connectionString) return null;

  let normalizedConnectionString = connectionString;
  try {
    const url = new URL(connectionString);
    for (const key of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert']) {
      url.searchParams.delete(key);
    }
    normalizedConnectionString = url.toString();
  } catch {
    // Keep the original value if it is not a URL. The pg client will report
    // the actionable connection-string error when it tries to connect.
  }

  return {
    connectionString: normalizedConnectionString,
    ssl: { rejectUnauthorized: false }
  };
}

async function ensureStorageBucket(supabase) {
  const { error: getError } = await supabase.storage.getBucket(BUCKET);
  if (!getError) return;

  const options = {
    public: false,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  };
  const { error: createError } = await supabase.storage.createBucket(BUCKET, options);
  if (createError && !/already exists|duplicate/i.test(createError.message || '')) {
    throw new Error(`Storage bucket setup failed: ${createError.message}`);
  }
}

async function ensureDatabaseTables() {
  const config = postgresConnectionConfig();
  if (!config) {
    throw new Error('Missing POSTGRES_URL_NON_POOLING / POSTGRES_URL for automatic database setup.');
  }

  const client = new Client(config);

  await client.connect();
  try {
    await client.query('create extension if not exists pgcrypto');
    await client.query(`
      create table if not exists public.applications (
        id uuid primary key default gen_random_uuid(),
        reference_code text unique,
        status text not null default 'Pending' check (status in ('Pending','Under Review','Approved','Rejected')),
        sender_name text,
        txn_id text,
        full_name text not null,
        gender text,
        gender_other text,
        age integer check (age is null or age between 10 and 100),
        city text not null,
        phone text not null,
        email text not null,
        applicant_status text,
        applicant_status_other text,
        association text,
        association_other text,
        designation text,
        heard_from text,
        heard_from_other text,
        why_join text,
        want_learn text,
        main_goal text,
        skills text[] default '{}',
        skills_other text,
        interest_areas text[] default '{}',
        interest_areas_other text,
        willing_active text,
        time_available text,
        willing_tasks text,
        opportunity text,
        join_volunteer text,
        preferred_area text,
        why_volunteer text,
        willing_contribute text,
        expectations text,
        anything_else text,
        files jsonb not null default '[]'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `);

    const columns = [
      ['reference_code', 'text'], ['status', "text not null default 'Pending'"], ['sender_name', 'text'], ['txn_id', 'text'],
      ['full_name', 'text'], ['gender', 'text'], ['gender_other', 'text'], ['age', 'integer'], ['city', 'text'], ['phone', 'text'],
      ['email', 'text'], ['applicant_status', 'text'], ['applicant_status_other', 'text'], ['association', 'text'], ['association_other', 'text'],
      ['designation', 'text'], ['heard_from', 'text'], ['heard_from_other', 'text'], ['why_join', 'text'], ['want_learn', 'text'], ['main_goal', 'text'],
      ['skills', "text[] default '{}'"], ['skills_other', 'text'], ['interest_areas', "text[] default '{}'"], ['interest_areas_other', 'text'],
      ['willing_active', 'text'], ['time_available', 'text'], ['willing_tasks', 'text'], ['opportunity', 'text'], ['join_volunteer', 'text'],
      ['preferred_area', 'text'], ['why_volunteer', 'text'], ['willing_contribute', 'text'], ['expectations', 'text'], ['anything_else', 'text'],
      ['files', "jsonb not null default '[]'::jsonb"], ['created_at', 'timestamptz not null default now()'], ['updated_at', 'timestamptz not null default now()']
    ];
    for (const [name, type] of columns) {
      await client.query(`alter table public.applications add column if not exists ${name} ${type}`);
    }
    await client.query('create index if not exists applications_created_at_idx on public.applications (created_at desc)');
    await client.query('create index if not exists applications_status_idx on public.applications (status)');
    await client.query('create index if not exists applications_email_idx on public.applications (email)');
    await client.query('create index if not exists applications_phone_idx on public.applications (phone)');
    await client.query(`
      create or replace function public.set_updated_at()
      returns trigger language plpgsql as $$
      begin
        new.updated_at = now();
        return new;
      end;
      $$
    `);
    await client.query('drop trigger if exists applications_set_updated_at on public.applications');
    await client.query(`
      create trigger applications_set_updated_at
      before update on public.applications
      for each row execute function public.set_updated_at()
    `);
    await client.query('alter table public.applications enable row level security');
  } finally {
    await client.end();
  }
}

async function ensureApplicationStorageAndDatabase(supabase) {
  if (!setupPromise) {
    setupPromise = Promise.all([
      ensureDatabaseTables(),
      ensureStorageBucket(supabase)
    ]).catch(error => {
      setupPromise = undefined;
      throw error;
    });
  }
  await setupPromise;
}

async function insertApplicationWithPostgres(row) {
  await ensureDatabaseTables();
  const config = postgresConnectionConfig();
  if (!config) {
    throw new Error('Missing POSTGRES_URL_NON_POOLING / POSTGRES_URL for database insert fallback.');
  }

  const client = new Client(config);

  const columns = [
    'reference_code', 'status', 'sender_name', 'txn_id', 'full_name', 'gender', 'gender_other', 'age', 'city', 'phone', 'email',
    'applicant_status', 'applicant_status_other', 'association', 'association_other', 'designation', 'heard_from', 'heard_from_other',
    'why_join', 'want_learn', 'main_goal', 'skills', 'skills_other', 'interest_areas', 'interest_areas_other', 'willing_active',
    'time_available', 'willing_tasks', 'opportunity', 'join_volunteer', 'preferred_area', 'why_volunteer', 'willing_contribute',
    'expectations', 'anything_else', 'files'
  ];

  await client.connect();
  try {
    const values = columns.map(column => column === 'files' ? JSON.stringify(row[column] || []) : row[column]);
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    const { rows } = await client.query(
      `insert into public.applications (${columns.join(', ')}) values (${placeholders}) returning id`,
      values
    );
    return rows[0];
  } finally {
    await client.end();
  }
}

module.exports = { ensureApplicationStorageAndDatabase, ensureStorageBucket, insertApplicationWithPostgres };
