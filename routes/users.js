var express = require('express');
var cors = require('cors');
var fs = require('fs');
const bcrypt = require('bcrypt');
let random = require('randomkey');

var router = express.Router();

router.use(cors());

const navBar = `
  <nav>
    <ul>
      <li><a href="/">Home</a></li>
      <li><a href="/books">View our selection!</a></li>
      <li><a href="/my-books">View your collection!</a></li>
      <li><a href="/donate">Donate a book!</a></li>
    </ul>
  </nav>`;

/*-------------- Admin Routes --------------------*/
/*-------- Content is rendered serverside --------*/

// Login for admin
router.post('/', function (req, res, next) {
  const enteredPassword = req.body.password;

  if (enteredPassword !== 'admin') {
    return res.send('Wrong password');
  } else {
    let adminHomePage = `
    <h1>Admin - Homepage</h1>
    <div class="admin-filter">
      <form action="/users/onlysubbed" method="post">
        <input type="submit" value="Only show subscribed users">
      </form>
      <form action="/users" method="post">
        <input type="submit" value="Show all users" disabled>
        <input type="text" value="admin" name="password" style="display: none;">
      </form>
    </div>
    <ul>
    `;
    fs.readFile('users.json', (err, data) => {
      let users = JSON.parse(data);

      // ONLY display info about user:
      // - email
      // - subscription-status
      let usersWithInfo = users.map((user) => {
        return (userInfo = {
          Email: user.email,
          Subscribed: user.subscribed,
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
      adminHomePage += '</ul>';

      adminHomePage += `
        <form action="/" method="get" >
          <input type="submit" value="Log out as admin">
        </form>`;

      res.send(adminHomePage);
    });
  }
});

router.post('/onlysubbed', function (req, res, next) {
  let adminHomePage = `
    <h1>Admin - Homepage</h1>
    <div class="admin-filter">
      <form action="/users/onlysubbed" method="post">
        <input type="submit" value="Only show subscribed users" disabled>
      </form>
      <form action="/users" method="post">
        <input type="submit" value="Show all users">
        <input type="text" value="admin" name="password" style="display: none;">
      </form>
    </div>
    <ul>
    `;
  fs.readFile('users.json', (err, data) => {
    let users = JSON.parse(data);

    // ONLY display info about user:
    // - email
    // - subscription-status
    let usersWithInfo = users
      .filter((user) => {
        return user.subscribed == true;
      })
      .map((user) => {
        return (userInfo = {
          Email: user.email,
          Subscribed: user.subscribed,
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
    adminHomePage += '</ul>';

    adminHomePage += `
        <form action="/" method="get" >
          <input type="submit" value="Log out as admin">
        </form>`;

    res.send(adminHomePage);
  });
});

/*-------------- Front End User Routes --------------------*/
/*-------- Content is rendered clientside --------*/

// Lets a user log in
// Uses middleware functions to check the following:
// - Email is registered in database
// - Entered password is correct
router.post('/login', makeSureEmailExistsInDb, authenticatePassword, (req, res, next) => {
  console.log(req.body);
  fs.readFile('users.json', (err, data) => {
    let users = JSON.parse(data);
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
  console.log(newUser);
  fs.readFile('users.json', (err, data) => {
    if (err) console.error(err);

    let users = JSON.parse(data);
    users.push(newUser);

    fs.writeFile('users.json', JSON.stringify(users, null, 2), (err) => {
      if (err) console.error(err);
    });
  });

  let returnData = {
    message: 'Successfully registered',
    id: newUser.id,
    email: newUser.email,
  };

  return res.json(returnData);
});

// Allows a logged-in user to change their subscription-status
// req.body contains userID and user subscription preference
router.post('/settings', (req, res) => {
  fs.readFile('users.json', (err, data) => {
    if (err) console.error(err);

    // Get list of users
    let users = JSON.parse(data);

    // Find currentuser using user ID
    let currentUser = users.find((user) => user.id == req.body.id);

    // Change subscription status for current user
    currentUser.subscribed = req.body.subscribed;

    // Replace users.json with updated settings for curretnuser
    fs.writeFile('users.json', JSON.stringify(users, null, 2), (err) => {
      if (err) console.error(err);
      return res.json(req.body);
    });
  });
});

// Middleware fuction
function authenticatePassword(req, res, next) {
  let enteredEmail = req.body.email;

  fs.readFile('users.json', async (err, data) => {
    if (err) console.error(err);

    let users = JSON.parse(data);
    let existingUser = users.find((acc) => acc.email == enteredEmail);

    if (await bcrypt.compare(req.body.password, existingUser.password)) return next();
    return res.json('Wrong password!');
  });
}

// Middleware fuction
function makeSureEmailIsNotAlreadyRegistered(req, res, next) {
  let newEmail = req.body.email;
  fs.readFile('users.json', (err, data) => {
    let users = JSON.parse(data);

    let found = users.find((acc) => acc.email == newEmail);
    if (found) return res.json('This email is already registered!');
    else return next();
  });
}

// Middleware fuction
function makeSureEmailExistsInDb(req, res, next) {
  let newEmail = req.body.email;
  fs.readFile('users.json', (err, data) => {
    let users = JSON.parse(data);

    let found = users.find((acc) => acc.email == newEmail);
    console.log(found);
    if (found !== undefined) return next();
    else return res.json('No account with this email found!');
  });
}

module.exports = router;
