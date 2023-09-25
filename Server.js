const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection
mongoose.connect('mongodb://0.0.0.0/DriverList', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

db.once('open', () => {
  console.log('Connected to MongoDB');
});

// Created Event and Alert schemas and models
const DrivingEventModel = mongoose.model('DrivingEvent', {
  timestamp: Date,
  isSafeDriving: Boolean,
  vehicleID: String,
  locationType: String,
});

const AlertModel = mongoose.model('Alert', {
  timestamp: Date,
  locationType: String,
});

app.use(bodyParser.json());

// POST /event endpoint to add driving events
app.post('/event', async (req, res) => {
  try {
    const drivingEvent = new DrivingEventModel(req.body);
    await drivingEvent.save();
    res.status(201).json({ message: 'Driving event added successfully' });

    // Call to the rule evaluation function when a driving event is added
    evaluateDrivingRules();
  } catch (error) {
    console.error('Error adding driving event:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Added a new route to retrieve alerts by ID
app.get('/alerts/:alertId', async (req, res) => {
  const alertId = req.params.alertId;

  try {
    const alert = await AlertModel.findById(alertId);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(alert);
  } catch (error) {
    console.error('Error retrieving alert:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Rule engine: Evaluate rules and generate alerts
const evaluateDrivingRules = async () => {
  const currentTime = new Date();

  const ruleThresholds = {
    highway: 4,
    cityCenter: 3,
    commercial: 2,
    residential: 1,
  };

  for (const locationType in ruleThresholds) {
    const startTime = new Date(currentTime - 5 * 60 * 1000);

    try {
      const count = await DrivingEventModel.countDocuments({
        locationType: locationType,
        isSafeDriving: false,
        timestamp: { $gte: startTime, $lte: currentTime },
      });

      if (count >= ruleThresholds[locationType]) {
        const existingAlert = await AlertModel.findOne({
          locationType: locationType,
          timestamp: { $gte: startTime, $lte: currentTime },
        });

        if (!existingAlert) {
          const alert = new AlertModel({
            timestamp: currentTime,
            locationType: locationType,
          });
          await alert.save();
          console.log(`Generated alert for ${locationType}`);
        }
      }
    } catch (error) {
      console.error(`Error evaluating rule for ${locationType}:`, error);
    }
  }
};

// Scheduled rule evaluation every 5 minutes
setInterval(evaluateDrivingRules, 5 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
