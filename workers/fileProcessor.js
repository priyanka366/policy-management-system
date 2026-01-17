const { parentPort, workerData } = require('worker_threads');
const XLSX = require('xlsx');
const fs = require('fs');
const csv = require('csv-parser');
const mongoose = require('mongoose');

// Import models
const Agent = require('../models/Agent');
const User = require('../models/User');
const Account = require('../models/Account');
const LOB = require('../models/LOB');
const Carrier = require('../models/Carrier');
const Policy = require('../models/Policy');

// Connect to MongoDB
mongoose.connect(workerData.mongoUri || 'mongodb://localhost:27017/policy_management', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function processFile(filePath) {
  try {
    const fileExtension = filePath.split('.').pop().toLowerCase();
    let data = [];

    if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      // Process XLSX file
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      data = XLSX.utils.sheet_to_json(worksheet);
    } else if (fileExtension === 'csv') {
      // Process CSV file
      data = await new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (row) => results.push(row))
          .on('end', () => resolve(results))
          .on('error', reject);
      });
    } else {
      throw new Error('Unsupported file format. Only XLSX and CSV are supported.');
    }

    parentPort.postMessage({ type: 'progress', message: `Processing ${data.length} records...` });

    // Process each row
    let processed = 0;
    let errors = [];

    for (let i = 0; i < data.length; i++) {
      try {
        const row = data[i];
        
        // Normalize column names (handle different case variations)
        const normalizeKey = (obj, keys) => {
          for (const key of keys) {
            const found = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
            if (found) return obj[found];
          }
          return null;
        };

        // Extract and process Agent
        let agentId = null;
        const agentName = normalizeKey(row, ['agent', 'agent name', 'agentname']);
        if (agentName) {
          let agent = await Agent.findOne({ agentName: agentName.trim() });
          if (!agent) {
            agent = await Agent.create({ agentName: agentName.trim() });
          }
          agentId = agent._id;
        }

        // Extract and process User
        const firstName = normalizeKey(row, ['firstname', 'first name', 'user first name']);
        const dob = normalizeKey(row, ['dob', 'date of birth', 'birthdate']);
        const address = normalizeKey(row, ['address']);
        const phoneNumber = normalizeKey(row, ['phone', 'phone number', 'phonenumber']);
        const state = normalizeKey(row, ['state']);
        const zipCode = normalizeKey(row, ['zip', 'zip code', 'zipcode']);
        const email = normalizeKey(row, ['email', 'email address']);
        const gender = normalizeKey(row, ['gender', 'sex']);
        const userType = normalizeKey(row, ['usertype', 'user type', 'type', 'userType']);

        let userId = null;
        if (email) {
          let user = await User.findOne({ email: email.toLowerCase().trim() });
          // Create user if email exists and we have minimum required fields
          if (!user && firstName && dob && phoneNumber && email && userType) {
            // Address, state, zipCode, and gender are optional - provide defaults if missing
            user = await User.create({
              firstName: firstName.trim(),
              dob: new Date(dob),
              address: address ? address.trim() : 'N/A', // Default if empty
              phoneNumber: phoneNumber.trim(),
              state: state ? state.trim() : 'N/A', // Default if empty
              zipCode: zipCode ? zipCode.trim() : 'N/A', // Default if empty
              email: email.toLowerCase().trim(),
              gender: gender ? gender.trim() : 'Other', // Default if empty
              userType: userType.trim()
            });
          }
          if (user) userId = user._id;
        }

        // Extract and process Account
        const accountName = normalizeKey(row, ['account_name', 'account name', 'accountname', 'account']);
        if (accountName && userId) {
          await Account.findOneAndUpdate(
            { userId, accountName: accountName.trim() },
            { userId, accountName: accountName.trim() },
            { upsert: true, new: true }
          );
        }

        // Extract and process LOB (Policy Category)
        let lobId = null;
        const categoryName = normalizeKey(row, ['category_name', 'category name', 'category', 'lob', 'policy category']);
        if (categoryName) {
          let lob = await LOB.findOne({ categoryName: categoryName.trim() });
          if (!lob) {
            lob = await LOB.create({ categoryName: categoryName.trim() });
          }
          lobId = lob._id;
        }

        // Extract and process Carrier
        let carrierId = null;
        const companyName = normalizeKey(row, ['company_name', 'company name', 'company', 'carrier', 'companyname']);
        if (companyName) {
          let carrier = await Carrier.findOne({ companyName: companyName.trim() });
          if (!carrier) {
            carrier = await Carrier.create({ companyName: companyName.trim() });
          }
          carrierId = carrier._id;
        }

        // Extract and process Policy
        const policyNumber = normalizeKey(row, ['policy_number', 'policy number', 'policynumber', 'policy no']);
        const policyStartDate = normalizeKey(row, ['policy_start_date', 'policy start date', 'start date', 'policystartdate']);
        const policyEndDate = normalizeKey(row, ['policy_end_date', 'policy end date', 'end date', 'policyenddate']);

        if (policyNumber && policyStartDate && policyEndDate && lobId && carrierId && userId) {
          await Policy.findOneAndUpdate(
            { policyNumber: policyNumber.trim() },
            {
              policyNumber: policyNumber.trim(),
              policyStartDate: new Date(policyStartDate),
              policyEndDate: new Date(policyEndDate),
              policyCategory: lobId,
              company: carrierId,
              userId: userId
            },
            { upsert: true, new: true }
          );
        } else {
          // Log missing fields for debugging (only once per row)
          const missingFields = [];
          if (!policyNumber) missingFields.push('policy_number');
          if (!policyStartDate) missingFields.push('policy_start_date');
          if (!policyEndDate) missingFields.push('policy_end_date');
          if (!lobId) missingFields.push('category_name');
          if (!carrierId) missingFields.push('company_name');
          if (!userId) missingFields.push('user (email required)');
          
          if (missingFields.length > 0) {
            errors.push({ 
              row: i + 1, 
              error: `Missing required fields: ${missingFields.join(', ')}` 
            });
          }
        }

        processed++;
        if (processed % 100 === 0) {
          parentPort.postMessage({ 
            type: 'progress', 
            message: `Processed ${processed}/${data.length} records...` 
          });
        }
      } catch (error) {
        errors.push({ row: i + 1, error: error.message });
      }
    }

    // Clean up file
    fs.unlinkSync(filePath);

    parentPort.postMessage({
      type: 'complete',
      processed,
      total: data.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    parentPort.postMessage({
      type: 'error',
      error: error.message
    });
  } finally {
    await mongoose.connection.close();
  }
}

// Start processing
processFile(workerData.filePath);

