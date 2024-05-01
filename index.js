const express = require('express');
const exphbs = require('express-handlebars');
const Handlebars = require('handlebars');
const mongoose = require('mongoose');
const axios = require('axios');
const User = require('./models/user');
const Recipe = require('./models/recipes');
require('dotenv').config();
const bcrypt = require('bcrypt');
const passport = require('passport')
const session = require('express-session')
const LocalStrategy = require('passport-local').Strategy
const flash = require('connect-flash');
const routes = require('./routes');
const adminRoutes = require('./admin_routes');
const nodemailer = require("nodemailer");

const app = express();

app.use(session({
    secret: "secret",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60 * 60 * 1000 } // Session length: 1 hour
}))

// Middleware
app.engine('handlebars', exphbs.engine());
app.set('view engine', 'handlebars');
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));
app.use(passport.initialize())
app.use(passport.session())
app.use(flash())

// Custom Handlebars helper
Handlebars.registerHelper('ifEqual', function (arg1, arg2, options) {
    return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});

// must add to list "= []", otherwise error: indexOf undefined 
Handlebars.registerHelper('ifIn', function (elem, list = [], options) {
    if (list.indexOf(elem) > -1) {
        return options.fn(this);
    }
    return options.inverse(this);
});

// Passport Configuration
authUser = async (username, password, done) => {
    const user = await User.findOne({ email: username });
    // console.log(user);
    // 1. If the user not found, done (null, false)
    if (user === null) {
        return done(null, false, { message: 'Incorrect email.' });
    }
    bcrypt.compare(password, user.password, (err, res) => {
        if (err) { return done(err); }
        if (res) {
            // 3. If user found and password match, done (null, user)        
            return done(null, user);
        } else {
            // 2. If the password does not match, done (null, false)
            return done(null, false, { message: 'Incorrect password.' });
        }
    });
}

// Local authentication verifies credentials (username & password) against local database
passport.use(new LocalStrategy({ usernameField: 'email' }, authUser));
// käyttäjäobjekti muunnetaan tiettyyn muotoon (yleensä ID) joka tallennetaan sessiokeksiin
passport.serializeUser((user, done) => {
    done(null, user.id);
});
// tallennettu käyttäjätunniste muunnetaan takaisin käyttäjäobjektiksi
passport.deserializeUser(async (id, done) => {
    const user = await User.findById(id).lean();
    done(null, user);
});

// Routes
app.use('/', routes);
app.use('/', adminRoutes);

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



// Create e-mail transporter    
const transporter = nodemailer.createTransport({
    host: 'smtp.zoho.eu',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL, 
        pass: process.env.EMAIL_PASS 
    }
});



//Send email when new is added to db, that match user interests
const sendEmail = (recipeItem, targetEmail) => {
    const mailOptions = {
        from: process.env.EMAIL,
        to: targetEmail,
        subject: 'New Recipe added to our service!',
        text: `A new recipe has been added! \n${recipeItem.name}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error occurred while sending email:', error);
        } else {
            console.log('Email sent:', info.response);
        }
    });
}

// Listen to recipe additions    
const db = mongoose.connection;
db.once('open', () => {
    const changeStream = Recipe.watch()

    changeStream.on('change', async (change) => {
        if (change.operationType === 'insert') {
            const newItem = change.fullDocument
            const users = await User.find().lean()
            for (let [key, user] of Object.entries(users)) {
                if(newItem.dishType.some(item => user.recipeInterests.includes(item)) && user.receiveRecommendations) {
                    
                    //sendEmail(newItem, user.email)
                    sendEmail(newItem, 'jenna21013@student.hamk.fi')
                }
            };

        }
    })
})



module.exports = app;

