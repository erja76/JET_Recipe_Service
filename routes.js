const express = require('express');
const { body, validationResult } = require('express-validator');
const passport = require('passport');
const bcrypt = require('bcrypt');
const User = require('./models/user');
const Recipe = require('./models/recipes');
const axios = require('axios');
const flash = require('connect-flash');
// const { path } = require('.');
const router = express.Router();
const mongoose = require('mongoose');


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

// Front page recipe search 
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

        // console.log("Constructed query:", query);
        const recipes = await Recipe.find(query).lean();
        res.render('partials/recipe_search_results', {
            user: req.user,
            recipes: recipes,
            currentURL: req.url,
            message: req.flash('info')
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error retrieving the recipes. Please try again.');
    }
});

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

// User dashboard 
router.get('/user_dashboard', ensureAuthenticated, (req, res) => {
    res.render('partials/user_dashboard', { user: req.user, message: req.flash('error') });
});

// Save a recipe 
router.post('/recipe_saved/:id', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user._id;
        const recipeId = req.params.id;
        const recipe = await Recipe.findOne({ _id: recipeId }).lean();

        // Check if the user has already saved a recipe 
        const user = await User.findById(userId).lean();
        // Convert all the user's saved recipes (ObjectIds) into strings so they can be compared
        const usersSavedRecipes = user.savedRecipes.map((arrayElement) => {
            return arrayElement.toString()
        })
        if (usersSavedRecipes.includes(recipeId)) {
            req.flash('info', 'You have already saved this recipe: "' + recipe.name + '".');
            // tallentaa muutokset JA pysyy samassa URL:ssa
            return res.redirect(req.body.currentURL);
        }
        // console.log(req.body.currentURL);

        // Add the recipe to user's saved recipes
        // $addToSet estää myös duplikaatit :)
        await User.findByIdAndUpdate(userId, { $addToSet: { savedRecipes: recipeId } });
        // storing flash message here for the time being:
        req.flash('info', 'Recipe "' + recipe.name + '" has been saved!');

        res.redirect(req.body.currentURL);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error saving the recipe. Please try again.');
    }
});

// Mark a recipe as favorite
router.post('/recipe_marked_favorite/:id', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user._id;
        const recipeId = req.params.id;
        const recipe = await Recipe.findOne({ _id: recipeId }).lean();

        // Check if the recipe has already been marked as favorite
        const user = await User.findById(userId).lean();
        // Convert all the user's favorite recipes (ObjectIds) into strings so they can be compared
        const usersFavoriteRecipes = user.favoriteRecipes.map((arrayElement) => {
            return arrayElement.toString()
        })

        if (usersFavoriteRecipes.includes(recipeId)) {
            req.flash('info', 'You have already marked the recipe "' + recipe.name + '" as a favorite.');
            return res.redirect(req.body.currentURL);
        }

        // Add the recipe to the user's favorite recipes
        await User.findByIdAndUpdate(userId, {
            $addToSet: {
                savedRecipes: recipeId,
                favoriteRecipes: recipeId
            }
        });

        req.flash('info', 'Recipe "' + recipe.name + '" has been marked as favorite!');
        res.redirect(req.body.currentURL);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error marking the recipe as favorite. Please try again.');
    }
});

// Viewing saved recipes
router.get('/saved_recipes', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId).lean();
        const savedRecipeIds = user.savedRecipes; // Array of ObjectId's

        // Promise-metodi käy läpi recipeIDt ja palauttaa niitä vastaavat tiedot tietokannasta
        const savedRecipesWithNulls = await Promise.all(savedRecipeIds.map(async (recipeId) => {
            const recipe = await Recipe.findById(recipeId).lean();
            return recipe;
        }));
        // Filter out nulls caused by recipes not found in database (ie deleted recipe)
        const savedRecipes = savedRecipesWithNulls.filter(element => {
            return element !== null
        });
        // tekee reseptien objectIDeistä stringejä (koska objectID:itä ei voi verrata edes keskenään)
        const favoriteRecipesIdsStrings = user.favoriteRecipes.map((arrayElement) => {
            return arrayElement.toString()
        })
        // console.log(savedRecipes);
        // lisää tallennetuille resepteille uuden kentän: 'isFavorite' tähtimerkintää varten
        const savedRecipesWithFavorites = savedRecipes.map((arrayElement) => {
            const recipeId = arrayElement._id.toString();
            if (favoriteRecipesIdsStrings.includes(recipeId)) {
                arrayElement.isFavorite = true;
            }
            else {
                arrayElement.isFavorite = false;
            }
            return arrayElement;
        })
        // console.log(savedRecipesWithFavorites);
        res.render('partials/saved_recipes', {
            user: req.user,
            recipeDisplay: savedRecipesWithFavorites
        });
    } catch (error) {
        console.error('Error displaying recipes:', error);
        res.status(500).json({ error: 'Error displaying the saved recipes' });
    }
});

// Viewing favorite recipes
router.get('/fave_recipes', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId).lean();
        const favoriteRecipeIds = user.favoriteRecipes; // Array of ObjectId's

        // Promise-metodi käy läpi recipeIDt ja palauttaa niitä vastaavat tiedot tietokannasta
        const favoriteRecipesWithNulls = await Promise.all(favoriteRecipeIds.map(async (recipeId) => {
            const recipe = await Recipe.findById(recipeId).lean();
            return recipe;
        }));
        // Filter out nulls caused by recipes not found in database (ie deleted recipe)
        const favoriteRecipes = favoriteRecipesWithNulls.filter(element => {
            return element !== null
        });

        res.render('partials/fave_recipes', { user: req.user, recipeDisplay: favoriteRecipes });
    } catch (error) {
        console.error('Error displaying favorite recipes:', error);
        res.status(500).json({ error: 'Error displaying the favorite recipes' });
    }
});

// Removing a saved recipe
router.post('/saved_recipes/delete/:id', ensureAuthenticated, async (req, res) => {
    const recipeId = req.params.id;
    try {
        const user = await User.findById(req.user._id);
        // $pull on käänteinen $addToSet, poistaa taulukosta sen mitä pyydetään
        await User.findByIdAndUpdate(req.user._id, {
            $pull: {
                savedRecipes: recipeId,
                favoriteRecipes: recipeId
            }
        });

        const recipe = await Recipe.findById(recipeId).lean();
        const templateData = {
            user: req.user,
            deletedRecipeName: recipe.name
        };
        res.render('partials/user_saved_removed', templateData);
    } catch (error) {
        console.error('Error removing saved recipe:', error);
        res.status(500).send('Error removing saved recipe. Please try again.');
    }
});

// Removing a favorite recipe
router.post('/favorite_recipes/delete/:id', ensureAuthenticated, async (req, res) => {
    const recipeId = req.params.id;
    const removeFromSaved = req.body.removeFromSaved === 'true'; // Check if user wants to remove from saved
    try {
        const user = await User.findById(req.user._id);
        // Remove the recipe from saved recipes if requested
        if (removeFromSaved) {
            await User.findByIdAndUpdate(req.user._id, {
                $pull: {
                    savedRecipes: recipeId,
                    favoriteRecipes: recipeId
                }
            });
        }
        // Remove the recipe from favorites
        else {
            await User.findByIdAndUpdate(req.user._id, {
                $pull: {
                    favoriteRecipes: recipeId
                }
            });
        }

        const recipe = await Recipe.findById(recipeId).lean();
        const templateData = {
            user: req.user,
            deletedRecipeName: recipe.name,
        };
        res.render('partials/user_fave_removed', templateData);
    } catch (error) {
        console.error('Error removing favorite recipe:', error);
        res.status(500).send('Error removing favorite recipe. Please try again.');
    }
});

// Mark a recipe as favorite from the user's saved recipes list
router.post('/favorite_marked/:id', ensureAuthenticated, async (req, res) => {
    const recipeId = req.params.id;
    try {
        const user = await User.findById(req.user._id);
        // Check if the recipe is already a favorite
        if (!user.favoriteRecipes.includes(recipeId)) {
            user.favoriteRecipes.push(recipeId); // Add recipe to favoriteRecipes array
            await user.save();
        }
        const recipe = await Recipe.findById(recipeId).lean(); // Fetch the details of the newly marked recipe
        res.render('partials/favorite_marked', { newFaveRecipeName: recipe.name });
    } catch (error) {
        console.error('Error marking recipe as favorite:', error);
        res.status(500).send('Error marking recipe as favorite. Please try again.');
    }
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
//express valdation added to name, email and password
router.post('/register', [
    body('name').notEmpty().withMessage('Name is required').trim().escape(),
    body('email').isEmail().withMessage('Invalid email').normalizeEmail(),
    body('password').isLength({ min: 5 }).withMessage('Password must be at least 5 characters long').trim().escape()
],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('partials/register', { errors: errors.array() });
        }

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
    res.render('partials/update_user', { user: req.user, userToBeUpdated: req.user });
});

// Update user details (client-side)
// purkkakoodia tähän väliin paremman puutteessa: 
// :notNeeded lisätty tähän koska admin-puolen update_user -lomakeessa :id on välttämätön
// express validation password
router.post('/update_user/:notNeeded', ensureAuthenticated, [
    body('password')
        .isLength({ min: 5 })
        .withMessage('Password must be at least 5 characters long')
        .trim()
        .escape()
        .optional({ values: 'falsy' }) // jos olemassaoleva password on jo hyvä, ei tarvi muuttaa
],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('partials/update_user', {
                user: req.user,
                userToBeUpdated: req.user,
                errors: errors.array()
            });
        }
        const userId = req.user._id;
        const formData = req.body;
        const updateFields = {
            recipeInterests: formData.recipePreferences,
            receiveRecommendations: formData.receiveRecommendations === 'true',
        };

        // Check if the password has been updated
        if (formData.password && formData.password !== "") {
            const hashedPassword = await bcrypt.hash(formData.password, 10);
            updateFields.password = hashedPassword;
        }

        User.findByIdAndUpdate(userId, updateFields)
            .then(() => {
                res.redirect('/user_dashboard');
            })
            .catch((err) => {
                console.error('Error updating user:', err);
                res.status(500).send('Error updating user. Please try again.');
            });
    });

module.exports = router;
