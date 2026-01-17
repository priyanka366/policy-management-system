const { Worker } = require('worker_threads');
const path = require('path');
const Policy = require('../models/Policy');
const User = require('../models/User');
const Account = require('../models/Account');
const LOB = require('../models/LOB');
const Carrier = require('../models/Carrier');
const Agent = require('../models/Agent');

// Upload XLSX/CSV file using worker threads
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/policy_management';

    // Create worker thread
    const worker = new Worker(path.join(__dirname, '../workers/fileProcessor.js'), {
      workerData: { filePath, mongoUri }
    });

    let progressMessages = [];

    worker.on('message', (message) => {
      if (message.type === 'progress') {
        progressMessages.push(message.message);
        console.log(message.message);
      } else if (message.type === 'complete') {
        res.json({
          success: true,
          message: 'File processed successfully',
          processed: message.processed,
          total: message.total,
          errors: message.errors,
          progress: progressMessages
        });
      } else if (message.type === 'error') {
        res.status(500).json({
          success: false,
          error: message.error
        });
      }
    });

    worker.on('error', (error) => {
      console.error('Worker error:', error);
      res.status(500).json({
        success: false,
        error: 'Worker thread error: ' + error.message
      });
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Worker stopped with exit code ${code}`);
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Search policy info by username (first name)
exports.searchPolicyByUsername = async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({ error: 'Username (first name) is required' });
    }

    // Find user by first name
    const users = await User.find({
      firstName: { $regex: username, $options: 'i' }
    });

    if (users.length === 0) {
      return res.status(404).json({ message: 'No user found with this name' });
    }

    // Get all policies for these users
    const userIds = users.map(user => user._id);
    const policies = await Policy.find({ userId: { $in: userIds } })
      .populate('userId', 'firstName email phoneNumber')
      .populate('policyCategory', 'categoryName')
      .populate('company', 'companyName')
      .exec();

    res.json({
      success: true,
      count: policies.length,
      users: users.map(user => ({
        id: user._id,
        firstName: user.firstName,
        email: user.email,
        phoneNumber: user.phoneNumber
      })),
      policies: policies.map(policy => ({
        policyNumber: policy.policyNumber,
        policyStartDate: policy.policyStartDate,
        policyEndDate: policy.policyEndDate,
        policyCategory: policy.policyCategory?.categoryName,
        company: policy.company?.companyName,
        user: {
          firstName: policy.userId?.firstName,
          email: policy.userId?.email
        }
      }))
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get aggregated policy by each user
exports.getAggregatedPoliciesByUser = async (req, res) => {
  try {
    // First check if there are any policies
    const policyCount = await Policy.countDocuments();
    
    if (policyCount === 0) {
      return res.json({
        success: true,
        totalUsers: 0,
        data: [],
        message: 'No policies found in database. Please upload a file first using POST /api/policy/upload'
      });
    }

    const aggregation = await Policy.aggregate([
      {
        $group: {
          _id: '$userId',
          totalPolicies: { $sum: 1 },
          policyNumbers: { $push: '$policyNumber' },
          policies: {
            $push: {
              policyNumber: '$policyNumber',
              policyStartDate: '$policyStartDate',
              policyEndDate: '$policyEndDate',
              policyCategory: '$policyCategory',
              company: '$company'
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $unwind: {
          path: '$userInfo',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'lobs',
          localField: 'policies.policyCategory',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      {
        $lookup: {
          from: 'carriers',
          localField: 'policies.company',
          foreignField: '_id',
          as: 'companyInfo'
        }
      },
      {
        $project: {
          userId: '$_id',
          userFirstName: '$userInfo.firstName',
          userEmail: '$userInfo.email',
          userPhone: '$userInfo.phoneNumber',
          totalPolicies: 1,
          policies: {
            $map: {
              input: '$policies',
              as: 'policy',
              in: {
                policyNumber: '$$policy.policyNumber',
                policyStartDate: '$$policy.policyStartDate',
                policyEndDate: '$$policy.policyEndDate',
                policyCategory: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$categoryInfo',
                        as: 'cat',
                        cond: { $eq: ['$$cat._id', '$$policy.policyCategory'] }
                      }
                    },
                    0
                  ]
                },
                company: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$companyInfo',
                        as: 'comp',
                        cond: { $eq: ['$$comp._id', '$$policy.company'] }
                      }
                    },
                    0
                  ]
                }
              }
            }
          }
        }
      },
      {
        $project: {
          userId: 1,
          userFirstName: 1,
          userEmail: 1,
          userPhone: 1,
          totalPolicies: 1,
          policies: {
            $map: {
              input: '$policies',
              as: 'policy',
              in: {
                policyNumber: '$$policy.policyNumber',
                policyStartDate: '$$policy.policyStartDate',
                policyEndDate: '$$policy.policyEndDate',
                policyCategory: '$$policy.policyCategory.categoryName',
                company: '$$policy.company.companyName'
              }
            }
          }
        }
      }
    ]);

    res.json({
      success: true,
      totalUsers: aggregation.length,
      data: aggregation
    });
  } catch (error) {
    console.error('Aggregation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Diagnostic endpoint to check database status
exports.getDatabaseStatus = async (req, res) => {
  try {
    const counts = {
      agents: await Agent.countDocuments(),
      users: await User.countDocuments(),
      accounts: await Account.countDocuments(),
      lobs: await LOB.countDocuments(),
      carriers: await Carrier.countDocuments(),
      policies: await Policy.countDocuments()
    };

    // Get sample data
    const samplePolicy = await Policy.findOne().populate('userId', 'firstName email').populate('policyCategory', 'categoryName').populate('company', 'companyName');
    const sampleUser = await User.findOne();

    res.json({
      success: true,
      counts,
      sample: {
        user: sampleUser ? {
          firstName: sampleUser.firstName,
          email: sampleUser.email
        } : null,
        policy: samplePolicy ? {
          policyNumber: samplePolicy.policyNumber,
          user: samplePolicy.userId?.firstName,
          category: samplePolicy.policyCategory?.categoryName,
          company: samplePolicy.company?.companyName
        } : null
      },
      message: counts.policies === 0 
        ? 'No data found. Please upload a file using POST /api/policy/upload'
        : 'Data found in database'
    });
  } catch (error) {
    console.error('Database status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
