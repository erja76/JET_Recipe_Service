const express = require('express');
const exphbs = require('express-handlebars');
const mongoose = require('mongoose');
const User = require('./models/user');
require('dotenv').config();

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

app.get('/login', (req, res) => {
    res.render('partials/login');
});

app.post('/register', (req, res) => {
    const formData = req.body;

    // Create a new user
    const recipeInterests = req.body.recipePreferences || [];
    const newUser = new User({
        name: formData.name,
        email: formData.email,
        recipeInterests: recipeInterests,
        receiveRecommendations: formData.receiveRecommendations === 'true'
    });

    // Save the new user to the database
    newUser.save()
        .then(() => {
            console.log('User registered successfully:', newUser);
            res.send('Registration successful!');
        })
        .catch((err) => {
            console.error('Error registering user:', err);
            res.status(500).send('Error registering user. Please try again.');
        });
});

module.exports = app;

