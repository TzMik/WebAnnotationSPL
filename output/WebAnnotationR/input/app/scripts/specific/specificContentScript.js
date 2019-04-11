const _ = require('lodash')
//
//
//
//
//
//
const ReviewGenerator = require('./ToolsetBar')
//
//

class specificContentScript{
  //

  init (callback) {
    window.abwa.specific = window.abwa.specific || {}
    //
    window.abwa.specific.reviewGenerator = new ReviewGenerator()
    window.abwa.specific.reviewGenerator.init(() => {

    })
    //
    //
    //
  }
}

module.exports = specificContentScript