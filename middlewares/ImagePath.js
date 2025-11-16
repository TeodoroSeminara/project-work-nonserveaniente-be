function setImagePath(req, res, next) {
    req.imagePath = `${req.protocol}://${req.get('host')}/images/`;
    next()
}


module.exports = setImagePath;