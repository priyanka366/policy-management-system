const express = require("express");
const router = express.Router();
const agenda = require("../agenda");

router.post("/schedule-message", async (req, res) => {
  const { message, day, time } = req.body;

  // day format: "2026-01-20"
  // time format: "18:30"

  const scheduledAt = new Date(`${day}T${time}:00`);

  if (scheduledAt <= new Date()) {
    return res.status(400).json({ error: "Scheduled time must be in future" });
  }

  await agenda.schedule(scheduledAt, "insert scheduled message", {
    message,
    scheduledAt
  });

  res.json({
    status: "Scheduled successfully",
    runAt: scheduledAt
  });
});

module.exports = router;
