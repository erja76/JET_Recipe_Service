const express = require('express');
const passport = require('passport');
const bcrypt = require('bcrypt');
const User = require('./models/user');
const Recipe = require('./models/recipes');
const axios = require('axios');
const flash = require('connect-flash');
const router = express.Router();



// Front page
router.get('/', (req, res) => {
    res.render('index');
});

// Login 
router.get('/login', (req, res) => {
    res.render('partials/login', { message: req.flash('error') });
});

router.post('/login', passport.authenticate('local', {
    successRedirect: '/login_redirect',
    failureRedirect: '/login',
    failureFlash: true
}));

router.get('/login_redirect', (req, res) => {
    console.log(req.user);
    if (req.user.adminRights == true) {
        res.redirect('/admin');
    }
    else {
        res.redirect('/user_dashboard');
    }
});

// User dashboard
router.get('/user_dashboard', ensureAuthenticated, (req, res) => {
    res.render('partials/user_dashboard', { user: req.user })
});

// Middleware to ensure user is authenticated
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.render('partials/login', { message: 'Please log in to view this resource!' });
}

// Admin 
router.get('/admin', (req, res) => {
    if (req.user == null || req.user.adminRights === false) {
        return res.redirect('/');
    }
    res.render('partials/admin', { user: req.user });
});

// Register 
router.get('/register', (req, res) => {
    res.render('partials/register');
});

router.get('/register_success', (req, res) => {
    res.render('partials/register_success');
});

// Update
router.get('/update', ensureAuthenticated, (req, res) => {
    console.log(req.user);
    res.render('partials/update', { user: req.user });
});

router.post('/logout', function (req, res, next) {
    req.logout(function (err) {
        if (err) { return next(err); }
        res.render('partials/logout');
    });
});

// Registering a new user
router.post('/register', (req, res) => {
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
                    res.redirect('/register_success');
                })
                .catch((err) => {
                    console.error('Error registering user:', err);
                    res.status(500).send('Error registering user. Please try again.');
                });
        }
    });
});

// Update user details
router.post('/update', (req, res) => {
    const userId = req.user._id;
    const formData = req.body;

    User.findByIdAndUpdate(userId, {
        recipeInterests: formData.recipePreferences || [],
        receiveRecommendations: formData.receiveRecommendations === 'true',
    }, { new: true })
        .then((updatedUser) => {
            console.log('User updated successfully:', updatedUser);
            res.redirect('/user_dashboard');
        })
        .catch((err) => {
            console.error('Error updating user:', err);
            res.status(500).send('Error updating user. Please try again.');
        });
});

// Fetching recipe from Edamem api
router.post('/saverecipe', async (req, res) => {
    try {
        const { recipeName, recipeNumber } = req.body;

        const response = await axios.get('https://api.edamam.com/search', {
            params: {
                q: recipeName,
                app_id: process.env.EDAMAM_API_ID,
                app_key: process.env.EDAMAM_API_KEY
            }
        });
        //        console.log(response.data.hits);
        if (response.data.hits[recipeNumber] === undefined) {
            res.status(400).send('No recipe found with given search terms.');
        }
        else {
            const recipeFromApi = response.data.hits[recipeNumber].recipe;
            console.log('Response from Edamam API:', response.data);
            //            console.log(response.data.hits.length);

            // Save the recipe to the database
            const savedRecipe = await Recipe.create({
                name: recipeFromApi.label,
                image: recipeFromApi.image,
                ingredients: recipeFromApi.ingredientLines,
                instruction: recipeFromApi.shareAs,
                cuisinetype: recipeFromApi.cuisineType,
                mealtype: recipeFromApi.mealType,
                dishtype: recipeFromApi.dishType,
            });

            res.json(savedRecipe);
        }
    } catch (error) {
        console.error('Error fetching and saving recipe', error);
        res.status(500).json({ error: 'Error fetching and saving recipe' });
    }
});

module.exports = router;

