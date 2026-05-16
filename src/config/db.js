const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on('error', (err) => console.error('[DB] Unexpected error', err));

function parseSelectString(table, selectStr) {
  if (!selectStr || selectStr === '*') {
    return { columns: `"${table}".*`, joins: [] };
  }
  if (!selectStr.includes('!')) {
    const cols = selectStr.split(',').map(c => c.trim()).join(', ');
    return { columns: cols === '*' ? `"${table}".*` : `"${table}".${cols.split(', ').join(`, "${table}".`)}`, joins: [] };
  }

  const parts = selectStr.split(/,(?![^(]*\))/g).map(s => s.trim());
  const mainCols = [];
  const joins = [];

  parts.forEach(part => {
    if (part === '*') {
      mainCols.push(`"${table}".*`);
    } else if (part.includes('!')) {
      const match = part.match(/^(\w+)!(\w+)\(([^)]+)\)$/);
      if (match) {
        const [, joinTable, fkCol, cols] = match;
        const colList = cols.split(',').map(c => {
          const col = c.trim();
          return `"${joinTable}"."${col}" AS "${joinTable}_${col}"`;
        });
        mainCols.push(...colList);
        joins.push({ joinTable, fkCol });
      }
    } else {
      mainCols.push(`"${table}"."${part}"`);
    }
  });

  return { columns: mainCols.join(', '), joins };
}

class QueryBuilder {
  constructor(table) {
    this._table = table;
    this._action = null;
    this._selectCols = '*';
    this._insertData = null;
    this._updateData = null;
    this._conditions = [];
    this._orderBy = null;
    this._returnData = false;
    this._isSingle = false;
  }

  select(cols) {
    if (!this._action) {
      this._action = 'select';
      this._selectCols = cols || '*';
    } else {
      this._returnData = true;
    }
    return this;
  }

  insert(data) {
    this._action = 'insert';
    this._insertData = Array.isArray(data) ? data : [data];
    return this;
  }

  update(data) {
    this._action = 'update';
    this._updateData = data;
    return this;
  }

  delete() {
    this._action = 'delete';
    return this;
  }

  eq(col, val) { this._conditions.push({ col, op: 'eq', val }); return this; }
  in(col, val) { this._conditions.push({ col, op: 'in', val }); return this; }
  overlaps(col, val) { this._conditions.push({ col, op: 'overlaps', val }); return this; }
  contains(col, val) { this._conditions.push({ col, op: 'contains', val }); return this; }
  gte(col, val) { this._conditions.push({ col, op: 'gte', val }); return this; }
  order(col, opts) { this._orderBy = { col, ascending: opts?.ascending !== false }; return this; }
  single() { this._isSingle = true; return this._execute(); }
  then(resolve, reject) { return this._execute().then(resolve, reject); }

  _buildWhere(params) {
    if (this._conditions.length === 0) return { sql: '', params };
    const clauses = this._conditions.map(({ col, op, val }) => {
      if (op === 'in') {
        const placeholders = val.map((_, i) => `$${params.length + i + 1}`).join(', ');
        params.push(...val);
        return `"${this._table}"."${col}" IN (${placeholders})`;
      } else if (op === 'overlaps') {
        params.push(val);
        return `"${this._table}"."${col}" && $${params.length}`;
      } else if (op === 'contains') {
        params.push(val);
        return `"${this._table}"."${col}" @> $${params.length}`;
      } else if (op === 'gte') {
        params.push(val);
        return `"${this._table}"."${col}" >= $${params.length}`;
      } else {
        if (val === null) return `"${this._table}"."${col}" IS NULL`;
        params.push(val);
        return `"${this._table}"."${col}" = $${params.length}`;
      }
    });
    return { sql: ' WHERE ' + clauses.join(' AND '), params };
  }

  async _execute() {
    const client = await pool.connect();
    try {
      if (this._action === 'select') {
        const { columns, joins } = parseSelectString(this._table, this._selectCols);
        const params = [];
        const { sql: where } = this._buildWhere(params);

        let joinSql = '';
        joins.forEach(({ joinTable, fkCol }) => {
          joinSql += ` LEFT JOIN "${joinTable}" ON "${this._table}"."${fkCol}" = "${joinTable}"."id"`;
        });

        let sql = `SELECT ${columns} FROM "${this._table}"${joinSql}${where}`;
        if (this._orderBy) {
          sql += ` ORDER BY "${this._table}"."${this._orderBy.col}" ${this._orderBy.ascending ? 'ASC' : 'DESC'}`;
        }

        const result = await client.query(sql, params);
        if (this._isSingle) {
          if (result.rows.length === 0) return { data: null, error: { message: 'Not found' } };
          return { data: result.rows[0], error: null };
        }
        return { data: result.rows, error: null };

      } else if (this._action === 'insert') {
        const results = [];
        for (const row of this._insertData) {
          const keys = Object.keys(row).filter(k => row[k] !== undefined);
          const vals = keys.map(k => row[k]);
          const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
          const cols = keys.map(k => `"${k}"`).join(', ');
          const sql = `INSERT INTO "${this._table}" (${cols}) VALUES (${placeholders}) RETURNING *`;
          const result = await client.query(sql, vals);
          results.push(result.rows[0]);
        }
        if (this._isSingle) return { data: results[0] || null, error: null };
        return { data: results, error: null };

      } else if (this._action === 'update') {
        const params = [];
        const setClauses = Object.entries(this._updateData)
          .filter(([, val]) => val !== undefined)
          .map(([key, val]) => {
            params.push(val);
            return `"${key}" = $${params.length}`;
          });

        if (setClauses.length === 0) return { data: null, error: { message: 'No fields to update' } };

        const { sql: where } = this._buildWhere(params);
        let sql = `UPDATE "${this._table}" SET ${setClauses.join(', ')}${where}`;
        if (this._returnData) sql += ' RETURNING *';

        const result = await client.query(sql, params);
        if (this._returnData) {
          if (this._isSingle) return { data: result.rows[0] || null, error: null };
          return { data: result.rows, error: null };
        }
        return { data: null, error: null };

      } else if (this._action === 'delete') {
        const params = [];
        const { sql: where } = this._buildWhere(params);
        await client.query(`DELETE FROM "${this._table}"${where}`, params);
        return { data: null, error: null };
      }

      return { data: null, error: { message: 'Unknown action' } };
    } catch (err) {
      console.error(`[DB] Query error on "${this._table}":`, err.message);
      return { data: null, error: { message: err.message } };
    } finally {
      client.release();
    }
  }
}

const db = {
  from(table) { return new QueryBuilder(table); },
  pool,
};

module.exports = db;
module.exports.admin = db;
