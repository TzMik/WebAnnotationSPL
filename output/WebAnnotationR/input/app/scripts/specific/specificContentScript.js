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
const CustomCriteriasManager = require('./CustomCriteriasManager')
//

class specificContentScript{
  //
  constructor () {
    this.events = {}
    this.status = ContentScriptManager.status.notInitialized
  }
  //

  init (callback) {
    window.abwa.specific = window.abwa.specific || {}
    //
    window.abwa.specific.reviewGenerator = new ReviewGenerator()
    window.abwa.specific.reviewGenerator.init(() => {

    })
    //
    //
    window.abwa.specific.customCriteriasManager = new CustomCriteriasManager()
    window.abwa.specific.customCriteriasManager.init(() => {

    })
    //
    //
  }
}

module.exports = specificContentScript