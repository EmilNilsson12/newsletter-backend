var express = require('express');
var cors = require('cors');
var fs = require('fs');
const bcrypt = require('bcrypt');
let random = require('randomkey');

var router = express.Router();

router.use(cors());

const head = `
  <head>
    <title>Admin - Nyhetsbrevtjänsten</title>
    <link rel="stylesheet" href="/stylesheets/style.css" />
  </head>`;

const headerElement = `
  <header>
    <h1>Admin - Homepage</h1>
  </header>`;

const footerElement = `
  <footer>
    <h4>Powered by</h4>
    <p>
      <a href="https://github.com/EmilNilsson12/newsletter-backend"><img width="100" src="/images/heroku-logo_200pxh.png"></a>
    </p>
    <p>
      <a href="https://github.com/EmilNilsson12/newsletter-backend"><img width="100" src="/images/mongoDB_Logo_200pxh.png"></a>
    </p>
  </footer>`;
/*-------------- Admin Routes --------------------*/
/*-------- Content is rendered serverside --------*/

// Login for admin
// Renders all users if pw is correct
router.post('/', function (req, res, next) {
  let adminHomePage = head;

  const enteredPassword = req.body.password;
  if (enteredPassword !== 'admin') {
    adminHomePage += `
      <header>
        <h1>Nice try</h1>
      </header>
      `;

    adminHomePage += `
      <main id="login-main">
        <form id="admin-form" action="/users" method="POST">
          <label for="password">WRONG PASSWORD<br /> TRY AGAIN</label>
          <div>
            <input type="password" id="admin-password" name="password" />
          </div>
          <div>
            <input type="submit" value="Login" />
          </div>
        </form>
      </main>
      `;

    adminHomePage += footerElement;
    return res.send(adminHomePage);
  } else {
    adminHomePage += headerElement;
    adminHomePage += `
    <main id="settings-main">
      <div>
        <div class="admin-filter">
          <form action="/users/onlysubbed" method="post">
          <input type="submit" value="Only show subscribed users">
          </form>
          <form action="/users" method="post">
          <input type="submit" value="Show all users" disabled>
            <input type="text" value="admin" name="password" style="display: none;">
          </form>
          </div>
        <h2>Currently showing: all users</h2>
        <ul class="overflow-YES">
        `;

    req.app.locals.db
      .collection('Users')
      .find()
      .toArray()
      .then((users) => {
        // ONLY display info about user:
        // - email
        // - subscription-status
        let usersWithInfo = users.map((user) => {
          return (userInfo = {
            Email: user.email,
            'Subscribed to newsletter': user.subscribed,
          });
        });

        // Create <li> for each user
        for (const user of usersWithInfo) {
          adminHomePage += '<li>';

          // Display email and subscription-status for each user
          for (const prop in user) {
            adminHomePage += `
              <div>
              ${prop}: ${user[prop]}
              </div>
              `;
          }
          adminHomePage += '</li>';
        }
        adminHomePage += '</ul></div>';

        adminHomePage += `
            <form action="/" method="get" >
            <input type="submit" value="Log out as admin">
            </form>
          </main>`;

        adminHomePage += footerElement;

        return res.send(adminHomePage);
      });
  }
});

// Renders only subscribed users
router.post('/onlysubbed', function (req, res, next) {
  let adminHomePage =
    head +
    headerElement +
    `
    <main id="settings-main">
      <div>
        <div class="admin-filter">
          <form action="/users/onlysubbed" method="post">
            <input type="submit" value="Only show subscribed users" disabled>
          </form>
          <form action="/users" method="post">
            <input type="submit" value="Show all users">
            <input type="text" value="admin" name="password" style="display: none;">
          </form>
        </div>
        <h2>Currently showing: subscribed users</h2>
        <ul class="overflow-YES">
    `;
  req.app.locals.db
    .collection('Users')
    .find()
    .toArray()
    .then((users) => {
      // ONLY display info about user:
      // - email
      let usersWithInfo = users
        .filter((user) => {
          return user.subscribed == true;
        })
        .map((user) => {
          return (userInfo = {
            Email: user.email,
          });
        });

      // Create <li> for each user
      for (const user of usersWithInfo) {
        adminHomePage += '<li>';

        // Display email and subscription-status for each user
        for (const prop in user) {
          adminHomePage += `
        <div>
          ${user[prop]}
          </div>
          `;
        }
        adminHomePage += '</li>';
      }
      adminHomePage += '</ul></div>';

      adminHomePage += `
        <form action="/" method="get" >
        <input type="submit" value="Log out as admin">
        </form>
      </main>`;

      adminHomePage += footerElement;

      res.send(adminHomePage);
    });
});

/*-------Redirects to login page when trying to bypass admin-login ---*/
router.get('/', function (req, res) {
  res.redirect('../');
});

/*-------Redirects to login page when trying to bypass admin-login ---*/
router.get('/onlysubbed', function (req, res) {
  res.redirect('../');
});

/*-------------- Front End User Routes --------------------*/
/*-------- Content is rendered clientside --------*/

// Lets a user log in
// Uses middleware functions to check the following:
// - Email is registered in database
// - Entered password is correct
router.post('/login', makeSureEmailExistsInDb, authenticatePassword, (req, res, next) => {
  req.app.locals.db
    .collection('Users')
    .find()
    .toArray()
    .then((users) => {
      const loggedInUser = users.find((user) => user.email == req.body.email);
      res.json(loggedInUser);
    });
});

// Adds user to db
// Uses a middleware function to check the following:
// - Unique email for new user
router.post('/register', makeSureEmailIsNotAlreadyRegistered, async (req, res) => {
  // Add user to the database
  const hashedPassword = await bcrypt.hash(req.body.password, 10);
  const newUser = {
    id: random(8),
    email: req.body.email,
    password: hashedPassword,
    subscribed: req.body.subscribed,
  };

  req.app.locals.db
    .collection('Users')
    .insertOne(newUser)
    .then(() => {
      let returnData = {
        message: 'Successfully registered',
        id: newUser.id,
        email: newUser.email,
      };

      return res.json(returnData);
    });
});

// Allows a logged-in user to change their subscription-status
// req.body contains userID and user subscription preference
router.post('/settings', (req, res) => {
  req.app.locals.db
    .collection('Users')
    .updateOne(
      { id: req.body.id },
      {
        $set: { subscribed: req.body.subscribed },
      }
    )
    .then((results) => {
      return res.json(req.body);
    });
});

// Middleware fuction
function authenticatePassword(req, res, next) {
  let enteredEmail = req.body.email;

  req.app.locals.db
    .collection('Users')
    .find()
    .toArray()
    .then(async (users) => {
      let existingUser = users.find((acc) => acc.email == enteredEmail);
      if (await bcrypt.compare(req.body.password, existingUser.password)) {
        return next();
      } else {
        return res.json('Wrong password!');
      }
    });
}

// Middleware fuction
function makeSureEmailIsNotAlreadyRegistered(req, res, next) {
  let newEmail = req.body.email;

  req.app.locals.db
    .collection('Users')
    .find()
    .toArray()
    .then((users) => {
      let found = users.find((acc) => acc.email == newEmail);
      if (found) return res.json('This email is already registered!');
      else return next();
    });
}

// Middleware fuction
function makeSureEmailExistsInDb(req, res, next) {
  let newEmail = req.body.email;

  req.app.locals.db
    .collection('Users')
    .find()
    .toArray()
    .then((users) => {
      let found = users.find((acc) => acc.email == newEmail);
      console.log(found);
      if (found !== undefined) return next();
      else return res.json('No account with this email found!');
    });
}

module.exports = router;
