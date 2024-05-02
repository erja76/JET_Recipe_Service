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


// Middleware to ensure user is registered AND is admin user
const ensureAdmin = (req, res, next) => {
    if (req.user !== undefined && req.user.adminRights === true) {
        return next();
    }
    res.status(403).render('partials/index', { user: req.user, message: "You don't seem to have admin rights." });
}

// Recipes fetched from Api
router.get('/retrievedRecipes', (req, res) => {
    res.render('partials/retrievedRecipes', { searchedRecipes: searchedRecipes });
});

// Admin 
router.get('/admin', ensureAdmin, (req, res) => {
    res.render('partials/admin', { user: req.user });
});

// User database - list all users (server-side)
router.get('/admin/users', ensureAdmin, async (req, res) => {
    try {
        // lean() palauttaa JavaScript objectin, find() palauttaa Mongoose objectin
        // Handlebars osaa käsitellä vain tavallisia JavaScript objecteja 
        // https://stackoverflow.com/questions/59690923/handlebars-access-has-been-denied-to-resolve-the-property-from-because-it-is
        const users = await User.find().lean();
        res.render('partials/userDB', { user: req.user, users: users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Error fetching users' });
    }
});

// User database - delete a user (server-side)
router.post('/admin/users/delete/:id', ensureAdmin, async (req, res) => {
    const userId = req.params.id;
    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).send('User not found');
        }
        const userName = user.name;
        await User.findByIdAndDelete(userId);
        res.render('partials/user_deleted', { user: req.user, deletedUserName: userName });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).send('Error deleting user. Please try again.');
    }
});

// User database - update a user (server-side)
router.get('/admin_update_user/:id', ensureAdmin, async (req, res) => {
    const userId = req.params.id;
    try {
        const userToBeUpdated = await User.findById(userId).lean();
        res.render('partials/admin_update_user', { user: req.user, userToBeUpdated });
    } catch (error) {
        console.error('Error fetching user for update:', error);
        res.status(500).send('Error fetching user for update. Please try again.');
    }
});

// Update user details in the user database (server-side)
// express validation added to name, email and password
router.post('/admin_update_user/:id', ensureAdmin, [
    body('name').notEmpty().withMessage('Name is required').trim().escape(), //Escape poistaa HTML ja Javascript koodin
    body('email').isEmail().withMessage('Invalid email').normalizeEmail(),  //muuttaa emailin kirjaimet pieniksi ja poistaa ylimääräiset välilyonnit
    body('password')
        .isLength({ min: 5 })
        .withMessage('Password must be at least 5 characters long')
        .trim()
        .escape()
        .optional({ values: 'falsy' }) // jos olemassaoleva password on jo hyvä, ei tarvi muuttaa 
],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                const userId = req.params.id;
                const userToBeUpdated = await User.findById(userId).lean(); //Fetching the details of the user to be updated
                return res.render('partials/admin_update_user', {
                    user: req.user,
                    userToBeUpdated: userToBeUpdated,
                    errors: errors.array()
                });
            }

            const userId = req.params.id;
            const formData = req.body;

            const updateFields = {
                name: formData.name,
                email: formData.email,
                adminRights: formData.adminRights === 'true',
                recipeInterests: formData.recipePreferences,
                receiveRecommendations: formData.receiveRecommendations === 'true',
            };

            // Check if the password has been updated
            if (formData.password && formData.password !== "") {
                const hashedPassword = await bcrypt.hash(formData.password, 10);
                updateFields.password = hashedPassword;
            }

            const updatedUser = await User.findByIdAndUpdate(userId, updateFields, { new: true });

            console.log('User updated successfully:', updatedUser);
            res.redirect('/admin/users');
        } catch (error) {
            console.error('Error updating user:', error);
            res.status(500).send('Error updating user. Please try again.');
        }
    });

// User database - add a new user (server-side)
router.get('/admin_add_user', ensureAdmin, (req, res) => {
    res.render('partials/admin_add_user', { user: req.user });
});
//express valdation added to name, email and password
router.post('/admin_add_user', ensureAdmin, [
    body('name').notEmpty().withMessage('Name is required').trim().escape(),
    body('email').isEmail().withMessage('Invalid email').normalizeEmail(),
    body('password').isLength({ min: 5 }).withMessage('Password must be at least 5 characters long').trim().escape(),],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.render('partials/admin_add_user', { user: req.user, errors: errors.array() });
            }
            const formData = req.body;
            const newUser = new User({
                name: formData.name,
                email: formData.email,
                adminRights: formData.adminRights === 'true',
            });
            await newUser.save();

            console.log('User added successfully:', newUser);
            res.render('partials/user_added', { user: req.user, addedUserName: formData.name });
        } catch (error) {
            console.error('Error adding user:', error);
            res.status(500).send('Error adding user. Please try again.');
        }
    });

// User database - search for a user by name (server-side)
router.get('/admin/users/search', ensureAdmin, async (req, res) => {
    const searchQuery = req.query.searchQuery;
    try {
        // $regex finds the match; i ensures a case-insensitive search
        const users = await User.find({ name: { $regex: new RegExp(searchQuery, 'i') } }).lean();
        res.render('partials/userDB', { user: req.user, users: users, searchQuery: searchQuery });
    } catch (error) {
        console.error('Error searching for user:', error);
        res.status(500).send('Error searching for user. Please try again.');
    }
});

// Recipe database - list all recipes (server-side)
router.get('/admin/recipes', ensureAdmin, async (req, res) => {
    try {
        const recipes = await Recipe.find().lean();
        res.render('partials/recipeDB', { user: req.user, recipes: recipes });
    } catch (error) {
        console.error('Error fetching recipes:', error);
        res.status(500).json({ error: 'Error fetching recipes' });
    }
});

// Recipe database - delete a recipe (server-side)
router.post('/admin/recipes/delete/:id', ensureAdmin, async (req, res) => {
    const recipeId = req.params.id;
    try {
        const recipe = await Recipe.findById(recipeId);
        if (!recipe) {
            return res.status(404).send('Recipe not found');
        }
        const thisRecipeName = recipe.name;
        await Recipe.findByIdAndDelete(recipeId);
        res.render('partials/recipe_deleted', { user: req.user, deletedRecipeName: thisRecipeName });
    } catch (error) {
        console.error('Error deleting recipe:', error);
        res.status(500).send('Error deleting recipe. Please try again.');
    }
});

// Recipe database -update recipe
router.get('/admin_update_recipe/:id', ensureAdmin, async (req, res) => {
    const recipeId = req.params.id;
    try {
        const recipeToBeUpdated = await Recipe.findById(recipeId).lean();
        res.render('partials/admin_update_recipe', { user: req.user, recipeToBeUpdated });
    } catch (error) {
        console.error('Error fetching recipe for update:', error);
        res.status(500).send('Error fetching recipe for update. Please try again.');
    }
});

// Save updated recipe to db
router.post('/admin_update_recipe/:id', ensureAdmin, [
    body('name').notEmpty().withMessage('Recipe name is required').trim().escape(),
    body('image').notEmpty().withMessage('Recipe image URL is required').trim().escape(),
    body('ingredients').notEmpty().withMessage('Recipe ingredients are required').trim().escape(),
    body('instruction').notEmpty().withMessage('Recipe instruction is required').trim().escape(),
    body('cuisineType').notEmpty().withMessage('Cuisine type is required').trim().escape(),
    body('mealType').notEmpty().withMessage('Meal type is required').trim().escape(),
    body('dishType').notEmpty().withMessage('Dish type is required').trim().escape()],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                const recipeId = req.params.id;
                const formData = req.body;
                const recipeToBeUpdated = {
                    _id: recipeId,
                    name: formData.name,
                    image: formData.image,
                    ingredients: formData.ingredients,
                    instruction: formData.instruction,
                    cuisineType: formData.cuisineType,
                    mealType: formData.mealType,
                    dishType: formData.dishType,
                };
                return res.render('partials/admin_update_recipe', { user: req.user, recipeToBeUpdated, errors: errors.array() });
            }

            const recipeId = req.params.id;
            const formData = req.body;

            const updatedFields = {
                name: formData.name,
                image: formData.image,
                ingredients: formData.ingredients,
                instruction: formData.instruction,
                cuisineType: formData.cuisineType,
                mealType: formData.mealType,
                dishType: formData.dishType,
            };

            const updatedRecipe = await Recipe.findByIdAndUpdate(recipeId, updatedFields, { new: true });

            console.log('Recipe updated successfully:', updatedRecipe);
            res.redirect('/admin/recipes');
        } catch (error) {
            console.error('Error updating recipe:', error);
            res.status(500).send('Error updating recipe. Please try again.');
        }
    });

//Search chosen recipes from db
router.post('/searchRecipesDB', ensureAdmin, async (req, res) => {
    try {
        // Initializing an empty query object
        let query = {};

        // RegExp = a pattern used to match certain character combinations in strings
        if (req.body.name) {
            query.name = new RegExp(req.body.name, 'i');
        }
        if (req.body.ingredients) {
            query.ingredients = new RegExp(req.body.ingredients, 'i')
        }
        if (req.body.cuisineType) {
            query.cuisineType = new RegExp(req.body.cuisineType, 'i');
        }
        if (req.body.mealType) {
            query.mealType = new RegExp(req.body.mealType, 'i');
        }
        if (req.body.dishType) {
            query.dishType = new RegExp(req.body.dishType, 'i');
        }

        console.log("Constructed query:", query);
        const recipes = await Recipe.find(query).lean();

        res.json({ recipes: recipes });
    }
    catch (error) {
        console.error('Error searching for recipes:', error);
        res.status(500).json({ error: 'Error searching for recipes' });
    }
});

let searchedRecipes = [];

// Fetching recipe from Edamem api
router.post('/searchrecipe', ensureAdmin, async (req, res) => {
    try {
        const { recipeName, numberOfRecipes } = req.body;

        // Check that numberOfRecipes is a valid number between 1 and 10.
        const num = parseInt(numberOfRecipes);
        if (isNaN(num) || num < 1 || num > 10) {
            return res.status(400).send('Number of recipes must be a valid number between 1 and 10.');
        }

        const response = await axios.get('https://api.edamam.com/search', {
            params: {
                q: recipeName,
                app_id: process.env.EDAMAM_API_ID,
                app_key: process.env.EDAMAM_API_KEY,
                to: num //number of recipes
            }
        });

        const recipesFromApi = response.data.hits.map(hit => ({
            name: hit.recipe.label,
            image: hit.recipe.image,
            ingredients: hit.recipe.ingredientLines,
            instruction: hit.recipe.shareAs,
            cuisineType: hit.recipe.cuisineType,
            mealType: hit.recipe.mealType,
            dishType: hit.recipe.dishType
        }));

        // Save the retrieved recipes into the searchedRecipes variable
        searchedRecipes = recipesFromApi;

        res.render('partials/retrievedRecipes', { user: req.user, searchedRecipes: recipesFromApi });
    }
    catch (error) {
        console.error('Error fetching recipe', error);
        res.status(500).json({ error: 'Error fetching recipe' });
    }
});

// Save the recipe to the database
router.post('/saverecipe', ensureAdmin, async (req, res) => {
    try {
        const { name, image, ingredients, instruction, cuisineType, mealType, dishType } = req.body;

        // Check if the recipe is already saved in the database
        const existingRecipe = await Recipe.findOne({ name: name });
        if (existingRecipe) {
            return res.render('partials/retrievedRecipes', {
                user: req.user,
                errorMessage: 'Recipe already exists in the database.',
                searchedRecipes: searchedRecipes
            });
        }

        const savedRecipe = await Recipe.create({
            name: name,
            image: image,
            ingredients: ingredients,
            instruction: instruction,
            cuisineType: cuisineType,
            mealType: mealType,
            dishType: dishType,
        });

        // Render same page with success message and saved recipe name
        res.render('partials/retrievedRecipes', {
            user: req.user,
            searchedRecipes: searchedRecipes,
            successMessage: `Recipe "${savedRecipe.name}" saved successfully!`
        });

    } catch (error) {
        console.error('Error saving recipe', error);
        res.status(500).json({ error: 'Error saving recipe' });
    }
});
 
module.exports = router;
