// agenda.js
const Agenda = require("agenda");
const Message = require("./models/Message");

// Use the same MongoDB connection as the main app
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/policy_management';

const agenda = new Agenda({
  db: { address: mongoUri, collection: 'agendaJobs' }
});

agenda.define("insert scheduled message", async (job) => {
  try {
    const { message, scheduledAt } = job.attrs.data;

    await Message.create({
      message,
      scheduledAt
    });

    console.log(`Message inserted at: ${scheduledAt}`);
    console.log(`   Message: ${message}`);
  } catch (error) {
    console.error('Error inserting scheduled message:', error);
    throw error;
  }
});

(async function () {
  try {
    await agenda.start();
    console.log('Agenda scheduler started');
  } catch (error) {
    console.error('Error starting agenda:', error);
  }
})();

module.exports = agenda;
