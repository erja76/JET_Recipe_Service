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
    //    console.log(req.user);
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

// User dashboard
router.get('/user_dashboard', ensureAuthenticated, (req, res) => {
    

})









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
        res.render('partials/index', {
            user: req.user,
            message: "You don't seem to have admin rights."
        });
    }
    res.render('partials/admin', { user: req.user });
});

// User database - list all users (server-side)
router.get('/admin/users', async (req, res) => {
    if (req.user == null || req.user.adminRights === false) {
        return res.render('partials/index', {
            user: req.user,
            message: "You don't seem to have admin rights."
        });
    }
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
router.post('/admin/users/delete/:id', async (req, res) => {
    const userId = req.params.id;
    try {
        await User.findByIdAndDelete(userId);
        res.redirect('/admin/users');
        //res.render('admin/user-deleted');
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).send('Error deleting user. Please try again.');
    }
});

// User database - update a user (server-side)
router.get('/admin_update_user/:id', async (req, res) => {
    const userId = req.params.id;
    try {
        const user = await User.findById(userId).lean();
        res.render('partials/admin_update_user', { user });
    } catch (error) {
        console.error('Error fetching user for update:', error);
        res.status(500).send('Error fetching user for update. Please try again.');
    }
});

// Update user details in the user database (server-side)
router.post('/admin_update_user', async (req, res) => {
    try {
        const userId = req.body.userId;
        const formData = req.body;

        let updateFields = {
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

///////////////////////////////////////////////////////////////////////////////////////////
// TÄMÄ ON VIELÄ HYVIN KESKEN.....
// User database - list all recipes (server-side)
router.get('/admin/recipes', async (req, res) => {
    if (req.user == null || req.user.adminRights === false) {
        return res.render('partials/index', {
            user: req.user,
            message: "You don't seem to have admin rights."
        });
    }
    try {
        const recipes = await Recipe.find().lean();
        res.render('partials/recipeDB', { user: req.user, recipes: recipes });
    } catch (error) {
        console.error('Error fetching recipes:', error);
        res.status(500).json({ error: 'Error fetching recipes' });
    }
});

///////////////////////////////////////////////////////////////////////////////////////////
// Register 
router.get('/register', (req, res) => {
    res.render('partials/register');
});

router.get('/register_success', (req, res) => {
    res.render('partials/register_success');
});

// Update (client-side)
router.get('/update_user', ensureAuthenticated, (req, res) => {
    //    console.log(req.user);
    res.render('partials/update_user', { user: req.user });
});

router.post('/logout', function (req, res, next) {
    req.logout(function (err) {
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

// Update user details (client-side)
router.post('/update_user', (req, res) => {
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
        // console.log(response.data.hits);
        if (response.data.hits[recipeNumber] === undefined) {
            res.status(400).send('No recipe found with given search terms.');
        }
        else {
            const recipeFromApi = response.data.hits[recipeNumber].recipe;
            console.log('Response from Edamam API:', response.data);
            // console.log(response.data.hits.length);

            // Save the recipe to the database
            const savedRecipe = await Recipe.create({
                name: recipeFromApi.label,
                image: recipeFromApi.image,
                ingredients: recipeFromApi.ingredientLines,
                instruction: recipeFromApi.shareAs,
                cuisineType: recipeFromApi.cuisineType,
                mealType: recipeFromApi.mealType,
                dishType: recipeFromApi.dishType,
            });

            res.json(savedRecipe);
        }
    } catch (error) {
        console.error('Error fetching and saving recipe', error);
        res.status(500).json({ error: 'Error fetching and saving recipe' });
    }
});

module.exports = router;

