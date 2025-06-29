const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

router.get('/', productController.getCheapestProducts);

module.exports = router;
