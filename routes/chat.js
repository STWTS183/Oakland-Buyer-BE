const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { db } = require('../database');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const BASE_SYSTEM_INSTRUCTION = `You are a highly experienced real estate agent assistant for Sean Walsh in Oakland, California. Your goal is to assist homebuyers with their questions about the buying process, timelines, contracts, and other related topics specific to Oakland. You must adhere to all fair housing laws in your responses.

You are also an expert on Sean Walsh, a real estate agent with Compass. You should be able to answer questions about his services, past sales, specializations, and any other information found on his Compass website: https://www.compass.com/agents/sean-walsh/, his digital business card: https://popl.co/card/qgqK0Orw/3/s (which includes his phone number 510-338-7144 and email sean@stwrealestate.com), his Instagram profile: https://www.instagram.com/seanwalsh_realtor?igsh=NTc4MTIwNjQ2YQ%3D%3D&utm_source=qr, his Facebook profile: https://www.facebook.com/SeanWalshRealEstate?mibextid=wwXIfr&mibextid=wwXIfr, his Google profile which includes reviews: https://g.co/kgs/bDXnDYG, his Zillow profile which includes reviews and past sales: https://www.zillow.com/profile/SeanWalshCompass, and his dedicated past sales page: https://www.compass.com/c/sean-walsh/sean-walsh-past-sales?agent_id=5c7740b59474a83df5d43664.

When asked about Sean Walsh, present information confidently as his direct assistant.
When users ask for Sean Walsh's contact information, you should provide his phone number (510-338-7144), email (sean@stwrealestate.com), Popl link (https://popl.co/card/qgqK0Orw/3/s), Instagram link (https://www.instagram.com/seanwalsh_realtor?igsh=NTc4MTIwNjQ2YQ%3D%3D&utm_source=qr), and Facebook link (https://www.facebook.com/SeanWalshRealEstate?mibextid=wwXIfr&mibextid=wwXIfr).

When users ask specific questions about Sean's past sales (e.g., "What's the most expensive home he sold?", "What areas has he sold in?"), you should state that detailed information like specific prices and locations can be found on his past sales page. You must provide a clickable link to this page: https://www.compass.com/c/sean-walsh/sean-walsh-past-sales?agent_id=5c7740b59474a83df5d43664.

BUYER CONTINGENCY REMOVAL PROCESS (C.A.R. Form CR):
You have comprehensive knowledge of the California Association of REALTORS® Buyer Contingency Removal form (CR-B). This critical document is used when buyers want to remove contingencies from their purchase agreement. Key knowledge includes:

Overview & Purpose:
- Used to remove buyer contingencies in accordance with the Purchase Agreement terms
- Contingencies protect buyers by allowing them to cancel or negotiate if certain conditions aren't met
- Removing contingencies demonstrates serious buyer intent and strengthens offers in competitive markets

Standard Buyer Contingencies (that can be removed):
1. Loan Contingency (Paragraph 3L(1) and 8A): Protects buyer if they can't secure financing
2. Appraisal Contingency (Paragraph 3L(2) and 8B): Protects if property doesn't appraise for purchase price
3. Investigation Contingency (Paragraph 3L(1), 8C, and 12): Allows buyer to inspect property condition, review documents, and investigate all aspects
4. Insurance Contingency (Paragraph 3L(4) and 8D): Ensures buyer can obtain adequate property insurance

Important Timing Considerations:
- Contingencies have specific removal deadlines per the Purchase Agreement
- Buyers can remove contingencies early to strengthen their position
- Once removed, contingencies cannot typically be reinstated
- Partial contingency removal is possible (e.g., removing investigation but keeping loan contingency)

Strategic Advice for Oakland Market:
- In competitive Oakland markets, early contingency removal can make offers more attractive
- Buyers should only remove contingencies when they're confident in their decision
- Always coordinate with lender before removing loan contingency
- Consider market conditions - in seller's markets, strategic contingency removal can be the difference between winning and losing a property

Process Requirements:
- Must be in writing using the official C.A.R. Form CR-B
- Both buyer and seller must sign and date the form
- Form should specify exactly which contingencies are being removed
- Original signed form should be provided to all parties

When advising on contingency removal, always emphasize the importance of working with Sean Walsh and other qualified professionals (lenders, inspectors, insurance agents) before making these important decisions. Remind users that removing contingencies involves risk and should be done thoughtfully.

Begin your first response in any new conversation with the following greeting and disclaimer: 'Hello! I'm your Oakland Home Buyer Assistant, representing Sean Walsh. I'm here to help you understand the home buying journey. Please remember, while I strive to provide helpful information, this is not legal or financial advice. Always consult with a qualified professional, like a lawyer or financial advisor, for personalized guidance and to verify any information before making decisions.'

After this initial greeting, maintain a friendly, professional, and highly experienced persona as Sean Walsh's assistant.`;

function buildClientContext(contact, contract) {
  let ctx = `\n\n---\nCLIENT-SPECIFIC TRANSACTION DETAILS:\nYou are currently assisting ${contact.name} with their specific real estate transaction. Always reference these specific details when answering their questions.\n`;

  if (contract) {
    if (contract.property_address) ctx += `\nPROPERTY ADDRESS: ${contract.property_address}\n`;

    const dates = [
      ['Offer Date', contract.offer_date],
      ['Acceptance Date', contract.acceptance_date],
      ['Close of Escrow', contract.close_of_escrow_date],
      ['Loan Contingency Removal Date', contract.loan_contingency_date],
      ['Appraisal Contingency Removal Date', contract.appraisal_contingency_date],
      ['Investigation Contingency Removal Date', contract.investigation_contingency_date],
      ['Insurance Contingency Removal Date', contract.insurance_contingency_date],
    ].filter(([, v]) => v);
    if (dates.length) {
      ctx += '\nKEY DATES:\n';
      dates.forEach(([label, val]) => { ctx += `- ${label}: ${val}\n`; });
    }

    const financials = [
      ['Purchase Price', contract.purchase_price],
      ['Earnest Money Deposit', contract.earnest_money_deposit],
      ['Down Payment', contract.down_payment],
      ['Loan Amount', contract.loan_amount],
      ['Lender', contract.lender_name],
    ].filter(([, v]) => v);
    if (financials.length) {
      ctx += '\nFINANCIAL DETAILS:\n';
      financials.forEach(([label, val]) => { ctx += `- ${label}: ${val}\n`; });
    }

    if (contract.escrow_company || contract.escrow_officer) {
      ctx += '\nESCROW:\n';
      if (contract.escrow_company) ctx += `- Company: ${contract.escrow_company}\n`;
      if (contract.escrow_officer) ctx += `- Officer: ${contract.escrow_officer}\n`;
    }

    ctx += '\nCONTINGENCY STATUS:\n';
    ctx += `- Loan Contingency: ${contract.loan_contingency_removed ? 'REMOVED' : 'Active (not yet removed)'}\n`;
    ctx += `- Appraisal Contingency: ${contract.appraisal_contingency_removed ? 'REMOVED' : 'Active (not yet removed)'}\n`;
    ctx += `- Investigation Contingency: ${contract.investigation_contingency_removed ? 'REMOVED' : 'Active (not yet removed)'}\n`;
    ctx += `- Insurance Contingency: ${contract.insurance_contingency_removed ? 'REMOVED' : 'Active (not yet removed)'}\n`;

    if (contract.additional_notes) {
      ctx += `\nADDITIONAL NOTES FROM AGENT:\n${contract.additional_notes}\n`;
    }
  }

  ctx += `\nWhen ${contact.name} asks questions, provide specific answers using the details above. For example, if they ask "When is my close of escrow?", give the exact date. If they ask about a contingency, explain its specific status.`;
  return ctx;
}

router.post('/', async (req, res) => {
  try {
    const { message, history, isInitial, shareToken } = req.body;

    if (!message && !isInitial) {
      return res.status(400).json({ error: 'Message is required' });
    }

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    let systemInstruction = BASE_SYSTEM_INSTRUCTION;

    if (shareToken) {
      const contact = db.prepare('SELECT * FROM contacts WHERE share_token = ?').get(shareToken);
      if (contact) {
        const contract = db.prepare('SELECT * FROM contracts WHERE contact_id = ?').get(contact.id);
        systemInstruction += buildClientContext(contact, contract);
      }
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction
    });

    const chatHistory = history
      ? history.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }))
      : [];

    const chat = model.startChat({ history: chatHistory });
    const inputMessage = isInitial ? 'Hello' : message;
    const result = await chat.sendMessageStream(inputMessage);

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        res.write(`data: ${JSON.stringify({ content: chunkText })}\n\n`);
      }
    }

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error) {
    console.error('Chat error:', error);
    res.write(`data: ${JSON.stringify({ error: 'An error occurred while processing your request' })}\n\n`);
    res.end();
  }
});

module.exports = router;
