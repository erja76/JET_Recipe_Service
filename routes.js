const express = require('express');
const passport = require('passport');
const bcrypt = require('bcrypt');
const User = require('./models/user');
const Recipe = require('./models/recipes');
const axios = require('axios');
const flash = require('connect-flash');
// const { path } = require('.');
const router = express.Router();


// Middleware to ensure user is authenticated 
// isAuthenticated = passport.js-kirjaston oma työkalu
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).render('partials/login', { message: 'Please log in to view this resource!' });
}

// Front page
router.get('/', (req, res) => {
    res.render('partials/index', { user: req.user });
});

////////////////////////////////////////////////////////////////////////////////////////
// Front page recipe search for unregistered users
router.get('/search', async (req, res) => {
    try {
        // Initializing an empty query object
        let query = {};

        // RegExp = a pattern used to match certain character combinations in strings
        if (req.query.name) {
            query.name = new RegExp(req.query.name, 'i');
            // eli query = { name: RegExp(...) }
        }
        if (req.query.ingredients) {
            query.ingredients = new RegExp(req.query.ingredients, 'i')
        }
        if (req.query.cuisineType) {
            query.cuisineType = new RegExp(req.query.cuisineType, 'i');
        }
        if (req.query.mealType) {
            query.mealType = new RegExp(req.query.mealType, 'i');
        }
        if (req.query.dishType) {
            query.dishType = new RegExp(req.query.dishType, 'i');
        }

        console.log("Constructed query:", query);
        const recipes = await Recipe.find(query).lean();
        //       console.log(recipes);
        res.render('partials/recipe_search_results', { user: req.user, recipes: recipes });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error retrieving the recipes. Please try again.');
    }
});
////////////////////////////////////////////////////////////////////////////////////////

// Login 
router.get('/login', (req, res) => {
    res.render('partials/login', { user: req.user, message: req.flash('error') });
});

router.post('/login', passport.authenticate('local', {
    successRedirect: '/login_redirect',
    failureRedirect: '/login',
    failureFlash: true
}));

router.get('/login_redirect', (req, res) => {
    if (req.user.adminRights == true) {
        res.redirect('/admin');
    }
    else {
        res.redirect('/user_dashboard');
    }
});

async function getRecipes(params = "") {
    try {
        await Recipe.find()
            .then(result => {
                const recipes = result.map(recipe => recipe.toJSON())
                return recipes
            }
            )
        //const recipes = result.map(recipe => recipe.toJSON())

    }
    catch (error) {
        console.log(error);
    }
}

// User dashboard - SIMPLE 
router.get('/user_dashboard', ensureAuthenticated, (req, res) => {
    res.render('partials/user_dashboard', { user: req.user, message: req.flash('error') });
});

// Save a recipe 
router.get('/recipe_saved/:id', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user._id;
        const recipeId = req.params.id;
        const recipe = await Recipe.findOne({ _id: recipeId }).lean()
        console.log(recipe.name);
        // Add the recipe ID to the user's saved recipes
        await User.findByIdAndUpdate(userId, { $addToSet: { savedRecipes: recipeId } });

        res.render('partials/recipe_saved', { user: req.user, recipeName: recipe.name });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error saving the recipe. Please try again.');
    }
});

// Mark a recipe as favorite
router.get('/recipe_marked_favorite/:id', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user._id;
        const recipeId = req.params.id;
        const recipe = await Recipe.findOne({ _id: recipeId }).lean()
        // Add the recipe ID to the user's favorite recipes
        await User.findByIdAndUpdate(userId, {
            $addToSet: {
                savedRecipes: recipeId,
                favoriteRecipes: recipeId
            }
        });

        res.render('partials/recipe_marked_favorite', { user: req.user, recipeName: recipe.name });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error saving the recipe. Please try again.');
    }
});


// User dashboard
router.get('/user_dashboard', ensureAuthenticated, async (req, res) => {
    try {
        const recipes = await Recipe.find().lean()
        console.log(recipes)
        res.render("partials/user_dashboard",
            {
                user: req.user,
                //                recipes: recipes
            }
        )
    }
    catch (error) {
        console.log(error)
    }
})

router.get('/search', async (req, res) => {
    const q = {}
    q = req.query.map(item => {
        if (item.length) {
            return item
        }
    })
    console.log(req.query)
    try {
        const recipes = await Recipe.find({
            cuisineType: { $in: q.cuisineType },
            mealType: { $in: q.mealType },
            dishType: { $in: q.dishType },
            ingredients: { $in: q.ingredients },
            name: q.name

        })
            .lean()

        res.render("partials/user_dashboard",
            {
                user: req.user,
                recipes: recipes
            }
        )
    }
    catch (error) {
        console.log(error)
    }
})

// Recipes fetched from Api
router.get('/retrievedRecipes', (req, res) => {
    res.render('partials/retrievedRecipes', { searchedRecipes: searchedRecipes });
});

// Register 
router.get('/register', (req, res) => {
    res.render('partials/register');
});

router.get('/register_success', (req, res) => {
    res.render('partials/register_success');
});

// passport.js vaatii että logoutille passataan callback!
// https://stackoverflow.com/questions/72336177/error-reqlogout-requires-a-callback-function
router.post('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.render('partials/logout');
    });
});

// Registering a new user (client-side)
router.post('/register', (req, res) => {
    const formData = req.body;
    const password = formData.password;

    // Create a new user (client-side)
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

            // Save the new user to the database (client-side)
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

// Update (client-side)
router.get('/update_user', ensureAuthenticated, (req, res) => {
    //    console.log(req.user);
    res.render('partials/update_user', { user: req.user, userToBeUpdated: req.user });
});

// Update user details (client-side)
// purkkakoodia tähän väliin paremman puutteessa: 
// :notNeeded lisätty tähän koska admin-puolen update_user -lomakeessa :id on välttämätön
router.post('/update_user/:notNeeded', ensureAuthenticated, (req, res) => {
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

module.exports = router;
