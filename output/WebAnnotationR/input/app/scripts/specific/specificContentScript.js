const _ = require('lodash')
//
//
//
//
//
//
const Toolset = require('./ToolsetBar')
//
//
const CustomCriteriasManager = require('./CustomCriteriasManager')
//

class specificContentScript{
  //

  init (callback) {
    window.abwa.specific = window.abwa.specific || {}
    //
    window.abwa.toolset = new Toolset()
    window.abwa.toolset.init(() => {
    	
    })
    //
    //
    window.abwa.specific.customCriteriasManager = new CustomCriteriasManager()
    window.abwa.specific.customCriteriasManager.init(() => {

    })
    //
    //
    //
    
    //
  }

  //

  destroy(){
    //
  }
}

module.exports = specificContentScript