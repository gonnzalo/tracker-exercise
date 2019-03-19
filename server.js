const express = require("express");

const app = express();

const bodyParser = require("body-parser");

const shortid = require("shortid");

const cors = require("cors");

const mongoose = require("mongoose");

const { Schema } = mongoose;

require("dotenv").config();

mongoose.connect(process.env.MLAB_URI, {
  useNewUrlParser: true,
  useFindAndModify: false
});
mongoose.Promise = global.Promise;
const db = mongoose.connection;
db.once("open", () => {
  console.log("connected");
});
db.on("error", console.error.bind(console, "connection error:"));

app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(`${__dirname}/views/index.html`);
});

// create Schema

const userSchema = new Schema({
  username: {
    type: String,
    required: true
  },
  _id: {
    type: String,
    default: shortid.generate
  }
});

const UserCreate = mongoose.model("UserCreate", userSchema);

// create user
app.post("/api/exercise/new-user", (req, res) => {
  UserCreate.findOne({ username: req.body.username })
    .then(data => {
      if (data) res.send("username already taken");
      else
        UserCreate.create({ username: req.body.username })
          .then(name => {
            res.json({ username: name.username, _id: name.id });
          })
          .catch(err => res.send(err));
    })
    .catch(err => res.send(err));
});

app.get("/api/exercise/users", (req, res) => {
  UserCreate.find({}).then(data => res.send(data));
});

// ExerciseSchema

const exerciseSchema = new Schema({
  username: String,
  _id: String,
  log: [
    {
      description: { type: String, required: true },
      duration: { type: Number, required: true },
      date: { type: String }
    }
  ]
});

const ExerciseCreate = mongoose.model("ExerciseCreate", exerciseSchema);

app.post("/api/exercise/add", (req, res) => {
  const { userId, description, duration, date } = req.body;
  const defaultDate = new Date().toDateString();

  UserCreate.findById(userId, (err, data) => {
    if (!data) res.send("unknown _id");
    ExerciseCreate.findByIdAndUpdate(
      data.id,
      {
        $set: {
          username: data.username
        },
        $push: {
          log: {
            description,
            duration,
            date: date ? new Date(date).toDateString() : defaultDate
          }
        }
      },
      { upsert: true, new: true }
    )
      .then(result => {
        res.json({
          username: result.username,
          description: result.log[result.log.length - 1].description,
          duration: result.log[result.log.length - 1].duration,
          data: result.log[result.log.length - 1].date,
          _id: result.id
        });
      })
      .catch(error => res.send(error));
  });
});

app.get("/api/exercise/log", (req, res) => {
  const { userId, from, to, limit } = req.query;

  const desde = new Date(from).getTime();
  const hasta = new Date(to).getTime();

  if (!userId) {
    res.send("unknown userId");
  }

  ExerciseCreate.findById(userId, {
    log: { $slice: Number(limit) }
  }).then(result => {
    const logFilter = result.log.filter(
      val =>
        new Date(val.date).getTime() >=
          (desde || new Date(val.date).getTime()) &&
        new Date(val.date).getTime() <= (hasta || new Date(val.date).getTime())
    );

    res.json({
      _id: result.id,
      username: result.username,
      count: logFilter.length,
      log: logFilter
    });
  });
});

// Not found middleware
app.use((req, res, next) => {
  return next({ status: 404, message: "not found" });
});

// Error Handling middleware
app.use((err, req, res) => {
  let errCode;
  let errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || "Internal Server Error";
  }
  res
    .status(errCode)
    .type("txt")
    .send(errMessage);
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log(`Your app is listening on port ${listener.address().port}`);
});
