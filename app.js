require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const app = express();
app.use(
  cors({
    origin: ["https://diary-anvu.onrender.com", "http://localhost:3000"],
    credentials: true,
  })
);
app.use(bodyParser.json());
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", function () {
  console.log("Connected to MongoDB");
});
const userSchema = new mongoose.Schema({
  fname: { type: String, required: true },
  lname: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  notifications: [String],
  friends: [String],
  friendRequests: [String],
  blogs: [String],
});
const blogSchema = new mongoose.Schema({
  title: String,
  content: String,
  userid: String,
  comments: [String],
  createdDate: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
});
userSchema.pre("save", function (next) {
  const user = this;
  if (!user.isModified("password")) return next();
  bcrypt.hash(user.password, 10, (err, hash) => {
    if (err) return next(err);
    user.password = hash;
    next();
  });
});
const User = mongoose.model("User", userSchema);
const Blog = mongoose.model("Blog", blogSchema);
app.use(cookieParser());
app.use(
  session({
    secret: "secret",
    resave: false,
    saveUninitialized: true,
  })
);
app.post("/create", (request, response) => {
  const blog = new Blog(request.body);
  blog
    .save()
    .then((blog) => {
      User.findByIdAndUpdate(
        { _id: blog.userid },
        { $push: { blogs: blog._id } },
        { new: true }
      )
        .then(() => {
          console.log("here");
        })
        .catch((err) => {
          return res.status(500).send({ error: "Error updating the user" });
        });
      console.log("here2");
      response.send({ message: "Input saved successfully" });
    })
    .catch((error) => {
      console.log("here3");
      response.status(400).send({ error: "Error in creating blog" });
    });
});

app.put("/update/:id", (req, res) => {
  const { id } = req.params;
  const updatedBlogData = req.body;

  Blog.findByIdAndUpdate(id, { $set: updatedBlogData }, { new: true })
    .then((updatedBlog) => {
      if (updatedBlog) {
        res.json({ success: true, message: "Blog updated successfully." });
      } else {
        res.status(404).json({ success: false, message: "Blog not found." });
      }
    })
    .catch((error) =>
      res.status(500).json({ success: false, message: "Internal Server Error" })
    );
});

app.delete("/delete/:id", function (req, res) {
  Blog.findByIdAndDelete(req.params.id)
    .then((deletedBlog) => {
      if (deletedBlog) {
        res.json({ success: true, message: "Blog deleted successfully." });
      } else {
        res.status(404).json({ success: false, message: "Blog not found." });
      }
    })
    .catch((error) =>
      res.status(500).json({ success: false, message: "Internal Server Error" })
    );
});

app.get("/blog/:id", (req, res) => {
  let id = req.params.id;
  Blog.findOne({ _id: id })
    .then((result) => {
      res.json(result);
    })
    .catch((err) => {
      console.log(err);
    });
});
app.get("/myblogs/:userId", (req, res) => {
  const userId = req.params.userId;
  User.findById(userId)
    .then((user) => {
      if (!user) {
        return res.status(404).send("User not found");
      }
      const blogIDs = user.blogs;
      Blog.find({
        _id: { $in: blogIDs },
      })
        .then((blogs) => {
          res.send(blogs);
        })
        .catch((err) => {
          res.status(500).send(err.message);
        });
    })
    .catch((err) => {
      res.status(500).send(err.message);
    });
});

app.get("/friendrequests/:userId", (req, res) => {
  const userId = req.params.userId;
  User.findById(userId)
    .then((user) => {
      if (!user) {
        return res.status(404).send("User not found");
      }
      const friendRequestIDs = user.friendRequests;
      User.find({
        _id: { $in: friendRequestIDs },
      })
        .then((friendRequests) => {
          res.send(friendRequests);
        })
        .catch((err) => {
          res.status(500).send(err.message);
        });
    })
    .catch((err) => {
      res.status(500).send(err.message);
    });
});

app.get("/friends/:userId", (req, res) => {
  const userId = req.params.userId;
  User.findById(userId)
    .then((user) => {
      if (!user) {
        return res.status(404).send("User not found");
      }
      const friendIDs = user.friends;
      User.find({
        _id: { $in: friendIDs },
      })
        .then((friends) => {
          res.send(friends);
        })
        .catch((err) => {
          res.status(500).send(err.message);
        });
    })
    .catch((err) => {
      res.status(500).send(err.message);
    });
});

app.delete("/blogs/:id", function (req, res) {
  Blog.findByIdAndDelete(req.params.id)
    .then((blog) => {
      if (!blog) {
        return res.status(404).send({ error: "Card not found" });
      }
      res.send(blog);
    })
    .catch((err) => {
      return res.status(500).send({ error: "Error deleting resume" });
    });
});

// Send Friend Request
app.post("/send-request/:userId", (req, res) => {
  const { userId } = req.params;
  const { senderId } = req.body;

  User.findByIdAndUpdate(userId, { $push: { friendRequests: senderId } })
    .then(() =>
      res.status(200).json({ message: "Friend request sent successfully" })
    )
    .catch((error) => res.status(500).json({ error: "Internal Server Error" }));
});

// Accept Friend Request
app.post("/accept-request/:userId", (req, res) => {
  const { userId } = req.params;
  const { senderId } = req.body;

  Promise.all([
    User.findByIdAndUpdate(userId, {
      $pull: { friendRequests: senderId },
      $push: { friends: senderId },
    }),
    User.findByIdAndUpdate(senderId, { $push: { friends: userId } }),
  ])
    .then(() =>
      res.status(200).json({ message: "Friend request accepted successfully" })
    )
    .catch((error) => res.status(500).json({ error: "Internal Server Error" }));
});

app.get("/allusers", (req, res) => {
  User.find({})
    .then((users) => res.status(200).json(users))
    .catch((error) => res.status(500).json({ error: "Internal Server Error" }));
});

app.post("/register", (req, res) => {
  const { fname, lname, email, password } = req.body;
  const user = new User({ fname, lname, email, password });
  user
    .save()
    .then((user) => {
      req.session.user = user;
      res.cookie("user", user, {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });
      res.json({ msg: "User created successfully", isLoggedIn: true, user });
    })
    .catch((err) => {
      return res.status(400).json({ msg: "Email already exists" });
    });
});
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  User.findOne({ email }).then((user) => {
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    bcrypt.compare(password, user.password).then((isMatch) => {
      if (!isMatch) {
        return res.status(400).json({ error: "Invalid credentials" });
      }
      req.session.user = user;
      res.cookie("user", user, {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });
      res.json({ isLoggedIn: true, user });
    });
  });
});

app.post("/logout", (req, res) => {
  res.clearCookie("user");
  req.session.destroy(() => {
    res.send({ success: true });
  });
});
app.get("/check-login", (req, res) => {
  const user = req.cookies.user;
  if (!user) {
    return res.json({ isLoggedIn: false });
  }
  res.json({ isLoggedIn: true, user });
});
app.get("*", (req, res) => {
  res.status(404).send("Page not found");
});

app.listen(process.env.PORT || 5000, () =>
  console.log("Listening on port 5000")
);
