// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";

const migration = readFileSync(new URL("../supabase/migrations/20261005000000_time_entries_integrity.sql", import.meta.url), "utf8");
const user1 = "11111111-1111-4111-8111-111111111111";
const user2 = "22222222-2222-4222-8222-222222222222";
let db: PGlite;

async function createDatabase() {
    const database = new PGlite();
    await database.exec(`
        create role anon;
        create role authenticated;
        create schema auth;
        create table auth.users (id uuid primary key);
        insert into auth.users values ('${user1}'), ('${user2}');
        create function auth.uid() returns uuid language sql stable as
            $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
        grant usage on schema auth, public to authenticated, anon;
    `);
    return database;
}

beforeAll(async () => {
    db = await createDatabase();
    // Model an existing installation with an overly broad permissive policy.
    await db.exec(`
        create table public.time_entries (
            id uuid primary key default gen_random_uuid(),
            user_id uuid references auth.users(id),
            started_at timestamptz,
            ended_at timestamptz,
            task_name text
        );
        alter table public.time_entries enable row level security;
        create policy legacy_allow_all on public.time_entries for all to public using (true) with check (true);
        grant all on public.time_entries to authenticated, anon;
        insert into public.time_entries (user_id, started_at, ended_at, task_name)
            values ('${user2}', '2026-10-01T12:00:00Z', '2026-10-01T13:00:00Z', 'Private task');
    `);
    await db.exec(migration);
}, 30000);

beforeEach(async () => { await db.exec(`begin; set role authenticated; set request.jwt.claim.sub = '${user1}';`); });
afterEach(async () => { await db.exec("rollback; reset role;"); });
afterAll(async () => { await db.close(); });

it("defaults ownership and enforces one active timer per user", async () => {
    const inserted = await db.query<{ user_id: string }>("insert into time_entries (started_at) values ('2026-10-05T10:00:00Z') returning user_id");
    expect(inserted.rows[0].user_id).toBe(user1);
    await expect(db.query("insert into time_entries (started_at) values ('2026-10-05T11:00:00Z')")).rejects.toMatchObject({ code: "23505" });
});

it("allows another active timer after the first is stopped", async () => {
    await db.exec("insert into time_entries (started_at) values ('2026-10-05T10:00:00Z'); update time_entries set ended_at = '2026-10-05T11:00:00Z';");
    await expect(db.query("insert into time_entries (started_at) values ('2026-10-05T12:00:00Z')")).resolves.toMatchObject({ affectedRows: 1 });
});

it("hides another user's rows even with an existing permissive policy", async () => {
    expect((await db.query("select * from time_entries")).rows).toEqual([]);
    expect((await db.query("update time_entries set task_name = 'Tampered' returning id")).rows).toEqual([]);
});

it("rejects inserts under another user's identity", async () => {
    await expect(db.query(`insert into time_entries (user_id, started_at) values ('${user2}', '2026-10-05T12:00:00Z')`)).rejects.toMatchObject({ code: "42501" });
});

it("rejects changing an owned row to another owner", async () => {
    await db.exec("insert into time_entries (started_at) values ('2026-10-05T12:00:00Z');");
    await expect(db.query(`update time_entries set user_id = '${user2}'`)).rejects.toMatchObject({ code: "42501" });
});

it("rejects reversed timestamps", async () => {
    await expect(db.query("insert into time_entries (started_at, ended_at) values ('2026-10-05T12:00:00Z', '2026-10-05T11:00:00Z')")).rejects.toMatchObject({ code: "23514" });
});

it("blocks anonymous access", async () => {
    await db.exec("set role anon;");
    await expect(db.query("select * from time_entries")).rejects.toMatchObject({ code: "42501" });
});

it("aborts a legacy migration without deleting ownerless records", async () => {
    const legacy = await createDatabase();
    try {
        await legacy.exec("create table time_entries (id int primary key, started_at timestamptz, ended_at timestamptz, task_name text); insert into time_entries values (1, '2026-10-05T10:00:00Z', null, 'Keep me');");
        await expect(legacy.exec(migration)).rejects.toThrow("Assign the correct user_id");
        await legacy.exec("rollback;");
        expect((await legacy.query("select id, task_name from time_entries")).rows).toEqual([{ id: 1, task_name: "Keep me" }]);
    } finally {
        await legacy.close();
    }
}, 30000);

it("requires an explicit timezone conversion for legacy naive timestamps", async () => {
    const legacy = await createDatabase();
    try {
        await legacy.exec("create table time_entries (id int primary key, user_id uuid, started_at timestamp, ended_at timestamp, task_name text);");
        await expect(legacy.exec(migration)).rejects.toThrow("Convert started_at and ended_at to timestamptz");
        await legacy.exec("rollback;");
    } finally {
        await legacy.close();
    }
}, 30000);
