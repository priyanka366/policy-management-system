const express = require('express');
const router = express.Router();
const policyController = require('../controllers/policyController');
const upload = require('../middlewares/upload');

// upload file endpoint
router.post('/upload', upload.single('file'), policyController.uploadFile);

// search by username
router.get('/search', policyController.searchPolicyByUsername);

// get aggregated data
router.get('/aggregate', policyController.getAggregatedPoliciesByUser);

// check db status (useful for debugging)
router.get('/status', policyController.getDatabaseStatus);

module.exports = router;

