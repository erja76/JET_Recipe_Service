const express = require('express');
const exphbs = require('express-handlebars');
const mongoose = require('mongoose');
const User = require('./models/user');
require('dotenv').config();
const bcrypt = require('bcrypt');

const app = express();

// Middleware
app.engine('handlebars', exphbs.engine());
app.set('view engine', 'handlebars');
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

// Database Connection
const dbURI = `mongodb+srv://${process.env.DBUSERNAME}:${process.env.DBPASSWORD}@${process.env.CLUSTER}.mongodb.net/${process.env.DB}?retryWrites=true&w=majority&appName=Cluster0`;

mongoose.connect(dbURI)
    .then(() => {
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
        console.log('Connected to DB');
    })
    .catch((err) => {
        console.error('Error connecting to DB:', err);
    });

// Routes
app.get('/', (req, res) => {
    res.render('index');
});
// Tämä on tällä hetkellä turha lisäys: 
app.get('/login', (req, res) => {
    res.render('partials/login');
});

app.get('/register', (req, res) => {
    res.render('partials/login'); // Render the login form
});

app.post('/login', (req, res) => {
    // Assuming login is successful, redirect the user to the recipe page
    res.redirect('/recipe');
});


app.get('/recipe', (req, res) => {
    res.render('recipe');
});


app.post('/register', (req, res) => {
    const formData = req.body;
    const password = formData.password;

    // Create a new user
    // Generating salt for hashing passwords
    const saltRounds = 10; // The complexity of the hashing algorithm
    bcrypt.hash(password, saltRounds, function (err, hash) {
        if (err) {
            console.error('Error hashing password:', err);
            res.status(500).send('Error registering user. Please try again.');
        } else {
            const newUser = new User({
                name: formData.name,
                email: formData.email,
                password: hash,
                recipeInterests: formData.recipePreferences || [],
                receiveRecommendations: formData.receiveRecommendations === 'true',
                adminRights: false
            });

            // Save the new user to the database
            newUser.save()
                .then(() => {
                    console.log('User registered successfully:', newUser);
                    res.redirect('/register');
                })
                .catch((err) => {
                    console.error('Error registering user:', err);
                    res.status(500).send('Error registering user. Please try again.');
                });
        }
    });
});

module.exports = app;

