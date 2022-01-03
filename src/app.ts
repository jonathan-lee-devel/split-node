import createError from "http-errors";
import express from "express";
import cookieParser from "cookie-parser";
import logger from "morgan";
import dotenv from "dotenv";
import cors from "cors";
import csrf from "csurf";
import helmet from "helmet";
import { connect, HydratedDocument } from "mongoose";
import { UsersRouter } from "./routes/users";

import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { User, UserModel } from "./models/User";
import bcrypt from "bcrypt";

import express_session from "express-session";
import { NextFunction, Request, Response } from "express-serve-static-core";

dotenv.config();

passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const foundUser: HydratedDocument<User> = await UserModel.findOne({
        email: username,
      });

      if (!foundUser) {
        return done(null, false, { message: "Invalid username" });
      }

      const validPassword = await bcrypt.compare(password, foundUser.password);
      if (!validPassword) {
        return done(null, false, { message: "Invalid password" });
      }

      return done(null, foundUser);
    } catch (err) {
      if (err) return done(err);
    }
  })
);

passport.serializeUser((user: HydratedDocument<User>, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  UserModel.findById(id, (err: any, user: User) => {
    done(err, user);
  });
});

const app = express();
app.use(
  express_session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(helmet.hidePoweredBy());
app.use(logger("dev"));
app.use(
  cors({
    origin: "http://localhost:4200",
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(
  csrf({
    cookie: { httpOnly: true },
    ignoreMethods: ["GET"],
  })
);
app.use((req, res, next) => {
  res.cookie("XSRF-TOKEN", req.csrfToken());
  next();
});

connect("mongodb://localhost:27017/test")
  .then((_) => {
    console.log("Connected to database");
  })
  .catch((err) => {
    console.error(err);
  });

const isLoggedIn = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res
    .status(401)
    .json({ message: "You must be logged in to view this resource" });
};

// TODO remove (used for debugging)
app.get("/", (req, res) => {
  return res.status(200).json({ user: req.user });
});

// TODO remove (used for debugging)
app.post("/", isLoggedIn, (req, res) => {
  return res.status(200).json({ user: req.user });
});

app.use("/api/users", UsersRouter);

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404));
});

// error handler
app.use(
  (
    err: { message: any; status: any },
    req: { app: { get: (arg0: string) => string } },
    res: {
      locals: { message: any; error: any };
      status: (arg0: any) => void;
      json: (arg0: { error: any }) => void;
    },
    _: any
  ) => {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get("env") === "development" ? err : {};

    res.status(err.status || 500);
    res.json({ error: err });
  }
);

export { app };
