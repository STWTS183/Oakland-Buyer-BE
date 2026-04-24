const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'realestate.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    share_token TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS contracts (
    id TEXT PRIMARY KEY,
    contact_id TEXT NOT NULL UNIQUE,
    property_address TEXT DEFAULT '',
    purchase_price TEXT DEFAULT '',
    earnest_money_deposit TEXT DEFAULT '',
    down_payment TEXT DEFAULT '',
    loan_amount TEXT DEFAULT '',
    lender_name TEXT DEFAULT '',
    escrow_company TEXT DEFAULT '',
    escrow_officer TEXT DEFAULT '',
    offer_date TEXT DEFAULT '',
    acceptance_date TEXT DEFAULT '',
    close_of_escrow_date TEXT DEFAULT '',
    loan_contingency_date TEXT DEFAULT '',
    appraisal_contingency_date TEXT DEFAULT '',
    investigation_contingency_date TEXT DEFAULT '',
    insurance_contingency_date TEXT DEFAULT '',
    loan_contingency_removed INTEGER DEFAULT 0,
    appraisal_contingency_removed INTEGER DEFAULT 0,
    investigation_contingency_removed INTEGER DEFAULT 0,
    insurance_contingency_removed INTEGER DEFAULT 0,
    additional_notes TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
  );
`);

module.exports = { db, uuidv4 };
