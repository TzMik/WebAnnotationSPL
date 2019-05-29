const _ = require('lodash')

class specificContentScript{

  init (callback) {
    window.abwa.specific = window.abwa.specific || {}
  }


  destroy(){
  }
}

module.exports = specificContentScript