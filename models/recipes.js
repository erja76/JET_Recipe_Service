const mongoose = require('mongoose');

const recipeSchema = new mongoose.Schema({
    name: String,
    image: String,
    ingredients: [String],
    instruction: String,
    cuisineType: [String],
    mealType: [String],
    dishType: [String],
});

const Recipe = mongoose.model('Recipe', recipeSchema);

module.exports = Recipe;