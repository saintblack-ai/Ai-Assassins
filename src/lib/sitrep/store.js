import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sqlite3 from "sqlite3";

const SQLITE_PATH = path.resolve(process.cwd(), "data", "sitrep.db");

function ensureDataDir() {
  fs.mkdirSync(path.dirname(SQLITE_PATH), { recursive: true });
}

function toRow(event) {
  return {
    id: crypto.randomUUID(),
    ts: event.ts,
    source: event.source,
    type: event.type,
    app: event.app,
    severity: event.severity,
    message: event.message || "",
    tags: JSON.stringify(event.tags || {}),
    meta: JSON.stringify(event.meta || {}),
  };
}

function parseRow(row) {
  return {
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : {},
    meta: row.meta ? JSON.parse(row.meta) : {},
  };
}

function openSqlite() {
  ensureDataDir();
  const db = new sqlite3.Database(SQLITE_PATH);
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS sitrep_events (
        id TEXT PRIMARY KEY,
        ts TEXT NOT NULL,
        source TEXT NOT NULL,
        type TEXT NOT NULL,
        app TEXT NOT NULL,
        severity TEXT NOT NULL,
        message TEXT,
        tags TEXT,
        meta TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    db.run(`CREATE INDEX IF NOT EXISTS idx_sitrep_ts ON sitrep_events(ts DESC)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_sitrep_type ON sitrep_events(type)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_sitrep_app ON sitrep_events(app)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_sitrep_severity ON sitrep_events(severity)`);
  });
  return db;
}

function sqliteRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function sqliteAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function supabaseHeaders(serviceRole) {
  return {
    apikey: serviceRole,
    Authorization: `Bearer ${serviceRole}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

function getEnvConfig(env = process.env) {
  return {
    supabaseUrl: String(env.SUPABASE_URL || "").trim().replace(/\/+$/, ""),
    serviceRoleKey: String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
  };
}

export async function createSitrepStore(env = process.env) {
  const cfg = getEnvConfig(env);
  if (cfg.supabaseUrl && cfg.serviceRoleKey) {
    return createSupabaseStore(cfg);
  }
  return createSqliteStore();
}

function createSqliteStore() {
  const db = openSqlite();
  return {
    mode: "sqlite",
    async insertEvent(event) {
      const row = toRow(event);
      await sqliteRun(
        db,
        `INSERT INTO sitrep_events (id, ts, source, type, app, severity, message, tags, meta)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.ts, row.source, row.type, row.app, row.severity, row.message, row.tags, row.meta]
      );
      return row.id;
    },
    async listEventsSince(sinceIso, limit = 1000) {
      const rows = await sqliteAll(
        db,
        `SELECT * FROM sitrep_events WHERE ts >= ? ORDER BY ts DESC LIMIT ?`,
        [sinceIso, limit]
      );
      return rows.map(parseRow);
    },
    async listLatestErrors(limit = 20) {
      const rows = await sqliteAll(
        db,
        `SELECT * FROM sitrep_events WHERE severity = 'error' ORDER BY ts DESC LIMIT ?`,
        [limit]
      );
      return rows.map(parseRow);
    },
    async close() {
      return new Promise((resolve, reject) => {
        db.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}

function supabaseQuery(baseUrl, serviceRoleKey, query) {
  return fetch(`${baseUrl}/rest/v1/sitrep_events${query}`, {
    method: "GET",
    headers: supabaseHeaders(serviceRoleKey),
  });
}

function createSupabaseStore({ supabaseUrl, serviceRoleKey }) {
  return {
    mode: "supabase",
    async insertEvent(event) {
      const payload = {
        ts: event.ts,
        source: event.source,
        type: event.type,
        app: event.app,
        severity: event.severity,
        message: event.message || "",
        tags: event.tags || {},
        meta: event.meta || {},
      };
      const r = await fetch(`${supabaseUrl}/rest/v1/sitrep_events`, {
        method: "POST",
        headers: supabaseHeaders(serviceRoleKey),
        body: JSON.stringify([payload]),
      });
      if (!r.ok) throw new Error(`supabase_insert_failed:${r.status}`);
      const rows = await r.json().catch(() => []);
      return rows?.[0]?.id || null;
    },
    async listEventsSince(sinceIso, limit = 1000) {
      const query =
        `?select=id,ts,source,type,app,severity,message,tags,meta,created_at` +
        `&ts=gte.${encodeURIComponent(sinceIso)}` +
        `&order=ts.desc` +
        `&limit=${Math.min(Math.max(limit, 1), 5000)}`;
      const r = await supabaseQuery(supabaseUrl, serviceRoleKey, query);
      if (!r.ok) throw new Error(`supabase_query_failed:${r.status}`);
      return r.json();
    },
    async listLatestErrors(limit = 20) {
      const query =
        `?select=id,ts,source,type,app,severity,message,tags,meta,created_at` +
        `&severity=eq.error` +
        `&order=ts.desc` +
        `&limit=${Math.min(Math.max(limit, 1), 100)}`;
      const r = await supabaseQuery(supabaseUrl, serviceRoleKey, query);
      if (!r.ok) throw new Error(`supabase_query_failed:${r.status}`);
      return r.json();
    },
    async close() {},
  };
}
