const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    recipeInterests: [String],
    receiveRecommendations: Boolean
});

const User = mongoose.model('User', userSchema);

module.exports = User;

