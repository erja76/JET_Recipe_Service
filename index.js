const express = require('express');
const exphbs = require('express-handlebars');
const app = express();
const mongoose = require('mongoose');
require('dotenv').config();

app.engine('handlebars', exphbs.engine());
app.set('view engine', 'handlebars');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(express.static('public'));


app.get('/', (req, res) => {
    res.render('index');
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`App listening on port ${PORT}`));
