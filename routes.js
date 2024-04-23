const express = require('express');
const passport = require('passport');
const bcrypt = require('bcrypt');
const User = require('./models/user');
const Recipe = require('./models/recipes');
const axios = require('axios');
const flash = require('connect-flash');
const router = express.Router();

let recipeTest = [{
    name: "Nimi",
    cuisineType: ["Meal"],
    mealType: ["main"],
    dishType: ["dish"],
    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRo_Hx9Ia-7_kc_EuexOf6N7uWDK_a4IChlTIZeWsuB9A&s",
    ingredients: ["fish", "rice", "carrot"],
    instruction: "Stir and cook!"
},
{
    name: "Nimi",
    cuisineType: ["Meal"],
    mealType: ["main"],
    dishType: ["dish"],
    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRo_Hx9Ia-7_kc_EuexOf6N7uWDK_a4IChlTIZeWsuB9A&s",
    ingredients: ["fish", "rice", "carrot"],
    instruction: "Stir and cook!"
}]


// Front page
router.get('/', (req, res) => {
    res.render('partials/index', { user: req.user });
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
    res.render('partials/user_dashboard',
        {
            user: req.user,
            recipes: recipeTest

        /*,
    recipes: */})
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
        //        return res.redirect('/');
        res.render('partials/index', {
            user: req.user,
            message: "You don't seem to have admin rights."
        });
    }
    res.render('partials/admin', { user: req.user });
});

// Recipes fetched from Api
router.get('/retrievedRecipes', (req, res) => {
    res.render('partials/retrievedRecipes', { searchedRecipes: searchedRecipes });
});

// User database
router.get('/admin/users', async (req, res) => {
    if (req.user == null || req.user.adminRights === false) {
        return res.redirect('/');
    }
    try {
        const users = await User.find();
        res.render('partials/userDB', { users: users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Error fetching users' });
    }
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

let searchedRecipes = [];

// Fetching recipe from Edamem api
router.post('/searchrecipe', async (req, res) => {
    try {
        const { recipeName, numberOfRecipes } = req.body;

        // Tarkistetaan, että numberOfRecipes on kelvollinen luku välillä 1-10
        const num = parseInt(numberOfRecipes);
        if (isNaN(num) || num < 1 || num > 10) {
            return res.status(400).send('Number of recipes must be a valid number between 1 and 10.');
        }

        const response = await axios.get('https://api.edamam.com/search', {
            params: {
                q: recipeName,
                app_id: process.env.EDAMAM_API_ID,
                app_key: process.env.EDAMAM_API_KEY,
                to: num // Määritellään hakua varten API:n to-parametrin arvoksi numberOfRecipes
            }
        });

        if (response.data.hits.length === 0) {
            return res.status(400).send('No recipes found with given search terms.');
        } else {
            const recipesFromApi = response.data.hits.map(hit => ({
                name: hit.recipe.label,
                image: hit.recipe.image,
                ingredients: hit.recipe.ingredientLines,
                instruction: hit.recipe.shareAs,
                cuisineType: hit.recipe.cuisineType,
                mealType: hit.recipe.mealType,
                dishType: hit.recipe.dishType
            }));

            res.render('partials/retrievedRecipes', { searchedRecipes: recipesFromApi });
        }
    } catch (error) {
        console.error('Error fetching recipe', error);
        res.status(500).json({ error: 'Error fetching recipe' });
    }
});

// Save the recipe to the database
router.post('/saverecipe', async (req, res) => {
    try {
        const { name, image, ingredients, instruction, cuisineType, mealType, dishType } = req.body;

        const savedRecipe = await Recipe.create({
            name: name,
            image: image,
            ingredients: ingredients,
            instruction: instruction,
            cuisineType: cuisineType,
            mealType: mealType,
            dishType: dishType,
        });

        res.json(savedRecipe);

    } catch (error) {
        console.error('Error saving recipe', error);
        res.status(500).json({ error: 'Error saving recipe' });
    }
});

module.exports = router;
