const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    recipeInterests: [String],
    receiveRecommendations: Boolean,
    adminRights: Boolean,
    savedRecipes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Recipe' }],
    favoriteRecipes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Recipe' }]
});

const User = mongoose.model('User', userSchema);

module.exports = User;

