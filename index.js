const express = require('express');
const exphbs = require('express-handlebars');
const mongoose = require('mongoose');
const axios = require('axios');
const User = require('./models/user');
const Recipe = require('./models/recipes');
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

app.get('/admin', (req, res) => {
    res.render('admin');
});

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


// Fetching recipe from Edamem api
app.post('/saverecipe', async (req, res) => {
    try {
        const { recipeName, recipeNumber } = req.body;

        const response = await axios.get('https://api.edamam.com/search', {
            params: {
                q: recipeName,
                app_id: process.env.EDAMAM_API_ID,
                app_key: process.env.EDAMAM_API_KEY
            }
        });

        const recipeFromApi = response.data.hits[recipeNumber].recipe;
        //console.log('Response from Edamam API:', response.data);

        // Save the recipe to the database
        const savedRecipe = await Recipe.create({
            name: recipeFromApi.label,
            image: recipeFromApi.image,
            ingredients: recipeFromApi.ingredientLines,
            instruction: recipeFromApi.shareAs,
            cusinetype: recipeFromApi.cuisineType,
            mealtype: recipeFromApi.mealType,
            dishtype: recipeFromApi.dishType,
        });

        res.json(savedRecipe);
    } catch (error) {
        console.error('Error fetching and saving recipe', error);
        res.status(500).json({ error: 'Error fetching and saving recipe' });
    }
});




module.exports = app;

