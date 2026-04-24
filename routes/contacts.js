const express = require('express');
const router = express.Router();
const { db, uuidv4 } = require('../database');

// List all contacts with property address
router.get('/', (req, res) => {
  try {
    const contacts = db.prepare(`
      SELECT c.id, c.name, c.email, c.phone, c.share_token, c.created_at, c.updated_at,
             co.property_address
      FROM contacts c
      LEFT JOIN contracts co ON c.id = co.contact_id
      ORDER BY c.created_at DESC
    `).all();
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single contact with full contract details
router.get('/:id', (req, res) => {
  try {
    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    const contract = db.prepare('SELECT * FROM contracts WHERE contact_id = ?').get(req.params.id);
    res.json({ ...contact, contract: contract || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create contact
router.post('/', (req, res) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const id = uuidv4();
    const share_token = uuidv4();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO contacts (id, name, email, phone, share_token, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name.trim(), email || '', phone || '', share_token, now, now);
    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
    res.status(201).json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update contact info
router.put('/:id', (req, res) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const now = new Date().toISOString();
    const result = db.prepare(`
      UPDATE contacts SET name = ?, email = ?, phone = ?, updated_at = ? WHERE id = ?
    `).run(name.trim(), email || '', phone || '', now, req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Contact not found' });
    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
    res.json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete contact (cascades to contract)
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Contact not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save or update contract for a contact
router.post('/:id/contract', (req, res) => {
  try {
    const contactId = req.params.id;
    const contact = db.prepare('SELECT id FROM contacts WHERE id = ?').get(contactId);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    const contractFields = [
      'property_address', 'purchase_price', 'earnest_money_deposit', 'down_payment',
      'loan_amount', 'lender_name', 'escrow_company', 'escrow_officer',
      'offer_date', 'acceptance_date', 'close_of_escrow_date',
      'loan_contingency_date', 'appraisal_contingency_date',
      'investigation_contingency_date', 'insurance_contingency_date',
      'loan_contingency_removed', 'appraisal_contingency_removed',
      'investigation_contingency_removed', 'insurance_contingency_removed',
      'additional_notes'
    ];

    const existing = db.prepare('SELECT * FROM contracts WHERE contact_id = ?').get(contactId);
    const now = new Date().toISOString();
    const data = {};
    for (const field of contractFields) {
      if (req.body[field] !== undefined) {
        data[field] = req.body[field];
      } else {
        data[field] = existing ? existing[field] : '';
      }
    }

    const boolFields = [
      'loan_contingency_removed', 'appraisal_contingency_removed',
      'investigation_contingency_removed', 'insurance_contingency_removed'
    ];
    for (const f of boolFields) {
      data[f] = data[f] ? 1 : 0;
    }

    if (existing) {
      db.prepare(`
        UPDATE contracts SET
          property_address=?, purchase_price=?, earnest_money_deposit=?, down_payment=?,
          loan_amount=?, lender_name=?, escrow_company=?, escrow_officer=?,
          offer_date=?, acceptance_date=?, close_of_escrow_date=?,
          loan_contingency_date=?, appraisal_contingency_date=?,
          investigation_contingency_date=?, insurance_contingency_date=?,
          loan_contingency_removed=?, appraisal_contingency_removed=?,
          investigation_contingency_removed=?, insurance_contingency_removed=?,
          additional_notes=?, updated_at=?
        WHERE contact_id=?
      `).run(
        data.property_address, data.purchase_price, data.earnest_money_deposit, data.down_payment,
        data.loan_amount, data.lender_name, data.escrow_company, data.escrow_officer,
        data.offer_date, data.acceptance_date, data.close_of_escrow_date,
        data.loan_contingency_date, data.appraisal_contingency_date,
        data.investigation_contingency_date, data.insurance_contingency_date,
        data.loan_contingency_removed, data.appraisal_contingency_removed,
        data.investigation_contingency_removed, data.insurance_contingency_removed,
        data.additional_notes, now, contactId
      );
    } else {
      db.prepare(`
        INSERT INTO contracts (
          id, contact_id, property_address, purchase_price, earnest_money_deposit, down_payment,
          loan_amount, lender_name, escrow_company, escrow_officer,
          offer_date, acceptance_date, close_of_escrow_date,
          loan_contingency_date, appraisal_contingency_date,
          investigation_contingency_date, insurance_contingency_date,
          loan_contingency_removed, appraisal_contingency_removed,
          investigation_contingency_removed, insurance_contingency_removed,
          additional_notes, created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        uuidv4(), contactId,
        data.property_address, data.purchase_price, data.earnest_money_deposit, data.down_payment,
        data.loan_amount, data.lender_name, data.escrow_company, data.escrow_officer,
        data.offer_date, data.acceptance_date, data.close_of_escrow_date,
        data.loan_contingency_date, data.appraisal_contingency_date,
        data.investigation_contingency_date, data.insurance_contingency_date,
        data.loan_contingency_removed, data.appraisal_contingency_removed,
        data.investigation_contingency_removed, data.insurance_contingency_removed,
        data.additional_notes, now, now
      );
    }

    const contract = db.prepare('SELECT * FROM contracts WHERE contact_id = ?').get(contactId);
    res.json(contract);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public: get contact + contract by share token
router.get('/share/:token', (req, res) => {
  try {
    const contact = db.prepare('SELECT * FROM contacts WHERE share_token = ?').get(req.params.token);
    if (!contact) return res.status(404).json({ error: 'Not found' });
    const contract = db.prepare('SELECT * FROM contracts WHERE contact_id = ?').get(contact.id);
    const { id, share_token, ...publicContact } = contact;
    res.json({ contact: publicContact, contract: contract || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
